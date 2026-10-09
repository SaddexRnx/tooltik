/**
 * Builds a progressive MP4 (`ftyp + moov + mdat`) from re-encoded video
 * samples plus the untouched audio track of the source file.
 *
 * Layout: all video samples first (one chunk each), then the original audio
 * chunks. The audio tables are copied verbatim except for the chunk offsets,
 * so audio stays bit-identical to the input.
 */

import {
  type BoxRef,
  PatchError,
  findBox,
  findBoxPath,
  findTrackByHandler,
} from "@/lib/mp4/boxes";
import {
  buildBtrt,
  buildBox,
  buildCtts,
  buildDinf,
  buildFtyp,
  buildMdhd,
  buildMvhd,
  buildSmhd,
  buildStco,
  buildStsc,
  buildStsdVideo,
  buildStss,
  buildStsz,
  buildStts,
  buildTkhd,
  buildVmhd,
  concat,
  scrubTimestamps,
  u32,
} from "@/lib/mp4/build";
import type { MediaContext } from "@/lib/mp4/inspect";
import { type DemuxedAudio, type DemuxedVideo } from "./demux";

export interface MuxVideoSample {
  ptsUs: number;
  isKey: boolean;
  data: Uint8Array;
}

export interface MuxProgressiveOptions {
  context: MediaContext;
  video: DemuxedVideo;
  /** Encoder output (any arrival order; mux sorts by pts). */
  encoded: MuxVideoSample[];
  /** `avcC` payload produced by the encoder. */
  description: Uint8Array;
  width: number;
  height: number;
  audio: DemuxedAudio | null;
}

function strToBytes(text: string): Uint8Array {
  const b = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) b[i] = text.charCodeAt(i) & 0xff;
  return b;
}

function setU16(buf: Uint8Array, offset: number, value: number): void {
  buf[offset] = (value >> 8) & 0xff;
  buf[offset + 1] = value & 0xff;
}

function setU32(buf: Uint8Array, offset: number, value: number): void {
  const v = value >>> 0;
  buf[offset] = (v >>> 24) & 0xff;
  buf[offset + 1] = (v >>> 16) & 0xff;
  buf[offset + 2] = (v >>> 8) & 0xff;
  buf[offset + 3] = v & 0xff;
}

function readU32Safe(buf: Uint8Array, offset: number): number {
  return (
    ((buf[offset] << 24) | (buf[offset + 1] << 16) | (buf[offset + 2] << 8) | buf[offset + 3]) >>> 0
  );
}

function stcoPlaceholder(count: number): Uint8Array {
  return buildBox("stco", concat([u32(0), u32(count), new Uint8Array(count * 4)]));
}

/** tkhd duration in movie-timescale ticks (header-included box bytes). */
function readTkhdDuration(box: Uint8Array): number {
  if (box[8] === 1) {
    return readU32Safe(box, 36) * 0x1_0000_0000 + readU32Safe(box, 40);
  }
  return readU32Safe(box, 28);
}

function modalDelta(deltas: number[]): number {
  const counts = new Map<number, number>();
  let best = 0;
  let bestCount = -1;
  for (const d of deltas) {
    const n = (counts.get(d) ?? 0) + 1;
    counts.set(d, n);
    if (n > bestCount) {
      best = d;
      bestCount = n;
    }
  }
  return best;
}

function moovLocalOf(context: MediaContext): BoxRef {
  return {
    type: "moov",
    start: 0,
    size: context.moovBytes.length,
    headerSize: context.topLevel.moov.headerSize,
    end: context.moovBytes.length,
  };
}

function requireBox(moov: Uint8Array, ref: BoxRef | null): BoxRef {
  if (!ref) throw new PatchError("unsupported-boxes");
  return ref;
}

export function muxProgressive(opts: MuxProgressiveOptions): File {
  const { context, video, encoded, description, width, height, audio } = opts;
  if (encoded.length === 0) throw new PatchError("reencode-failed");
  const moov = context.moovBytes;
  const moovLocal = moovLocalOf(context);

  // --- timeline: presentation (µs) and decode time -------------------------
  // Samples stay in arrival order: that IS decode order (mp4 stores frames
  // in decode order; B-frames simply present out of order via ctts).
  const samples = encoded;
  const n = samples.length;
  let minPtsUs = Infinity;
  for (const s of samples) if (s.ptsUs < minPtsUs) minPtsUs = s.ptsUs;
  const ptsTicks = samples.map((s) =>
    Math.round(((s.ptsUs - minPtsUs) * video.timescale) / 1_000_000),
  );
  let minTick = 0;
  for (const t of ptsTicks) if (t < minTick) minTick = t;
  if (minTick !== 0) for (let i = 0; i < n; i++) ptsTicks[i] -= minTick;

  // Decode interval: modal gap between presentation times, stable even when
  // B-frames make decode and presentation order differ.
  const sortedPts = [...ptsTicks].sort((a, b) => a - b);
  const gaps: number[] = [];
  for (let i = 0; i + 1 < n; i++) {
    const g = sortedPts[i + 1] - sortedPts[i];
    if (g > 0) gaps.push(g);
  }
  const fallbackDelta = Math.max(1, Math.round(video.timescale / 30));
  const delta = gaps.length > 0 ? modalDelta(gaps) : fallbackDelta;
  const sttsEntries = [{ count: n, delta }];

  let maxPts = 0;
  for (const t of ptsTicks) if (t > maxPts) maxPts = t;
  const totalTicks = Math.max((n - 1) * delta, maxPts) + delta;
  const durationSec = video.timescale > 0 ? totalTicks / video.timescale : 0;

  // ctts: only when presentation time differs from decode time (B-frames).
  let cttsBox: Uint8Array | null = null;
  {
    const offsets = ptsTicks.map((t, i) => t - i * delta);
    if (offsets.some((o) => o !== 0)) {
      const runs: { count: number; offset: number }[] = [];
      for (const o of offsets) {
        const last = runs[runs.length - 1];
        if (last && last.offset === o) last.count++;
        else runs.push({ count: 1, offset: o });
      }
      cttsBox = buildCtts(runs, offsets.some((o) => o < 0) ? 1 : 0);
    }
  }

  const sizes = samples.map((s) => s.data.length);
  const videoBytes = sizes.reduce((a, b) => a + b, 0);
  const syncSamples: number[] = [];
  samples.forEach((s, i) => {
    if (s.isKey) syncSamples.push(i + 1);
  });
  const includeStss = syncSamples.length > 0 && syncSamples.length < n;

  const audioBytes = audio ? audio.chunks.reduce((a, c) => a + c.size, 0) : 0;
  const mdatContentLen = videoBytes + audioBytes;
  if (mdatContentLen + 8 > 0xffff_ffff) throw new PatchError("too-large");

  // --- source boxes --------------------------------------------------------
  const videoTrack = requireBox(moov, findTrackByHandler(moov, moovLocal, "vide"));
  const mvhdRef = requireBox(moov, findBox(moov, "mvhd", moovLocal.start, moovLocal.end));
  const vTkhdRef = requireBox(moov, findBox(moov, "tkhd", videoTrack.start, videoTrack.end));
  const vMdhdRef = requireBox(
    moov,
    findBoxPath(moov, ["mdia", "mdhd"], videoTrack.start, videoTrack.end),
  );
  const mvhdBody = moov.slice(mvhdRef.start + mvhdRef.headerSize, mvhdRef.end);
  const mvTimescale = readU32Safe(mvhdBody, mvhdBody[0] === 1 ? 20 : 12);

  const ftyp = buildFtyp();

  // --- video track ---------------------------------------------------------
  const fixedEntry = video.fixedEntry.slice();
  setU16(fixedEntry, 24, width);
  setU16(fixedEntry, 26, height);
  const avgVideoBitrate = durationSec > 0 ? Math.floor((videoBytes * 8) / durationSec) : 0;
  const videoStsd = buildStsdVideo(
    fixedEntry,
    [buildBox("avcC", description), buildBtrt(0, avgVideoBitrate, avgVideoBitrate)],
    "avc1",
  );
  const videoStts = buildStts(sttsEntries);
  const videoStss = includeStss ? buildStss(syncSamples) : null;
  const videoStsc = buildStsc([{ firstChunk: 1, samplesPerChunk: 1, descriptionIndex: 1 }]);
  const videoStsz = buildStsz(sizes);

  const videoTkhdDur =
    mvTimescale > 0 && video.timescale > 0
      ? Math.round((totalTicks * mvTimescale) / video.timescale)
      : 0;
  const videoTkhdBase = scrubTimestamps(moov.slice(vTkhdRef.start, vTkhdRef.end));
  // Width/height (16.16) follow the matrix: v0 @84/@88, v1 @96/@100.
  const wh = videoTkhdBase[8] === 1 ? [96, 100] : [84, 88];
  setU32(videoTkhdBase, wh[0], width * 65536);
  setU32(videoTkhdBase, wh[1], height * 65536);
  const videoTkhd = buildTkhd(videoTkhdBase, videoTkhdDur);
  const videoMdhd = scrubTimestamps(
    buildMdhd(moov.slice(vMdhdRef.start + vMdhdRef.headerSize, vMdhdRef.end), {
      duration: totalTicks,
    }),
  );
  const videoVmhdRef = findBoxPath(moov, ["mdia", "minf", "vmhd"], videoTrack.start, videoTrack.end);
  const videoDinfRef = findBoxPath(moov, ["mdia", "minf", "dinf"], videoTrack.start, videoTrack.end);
  const videoVmhd = video.vmhd.length > 0
    ? video.vmhd
    : videoVmhdRef
      ? moov.slice(videoVmhdRef.start, videoVmhdRef.end)
      : buildVmhd();
  const videoDinf = video.dinf.length > 0
    ? video.dinf
    : videoDinfRef
      ? moov.slice(videoDinfRef.start, videoDinfRef.end)
      : buildDinf();

  const buildVideoTrak = (stco: Uint8Array): Uint8Array =>
    buildBox(
      "trak",
      concat([
        videoTkhd,
        buildBox(
          "mdia",
          concat([
            videoMdhd,
            video.hdlr,
            buildBox(
              "minf",
              concat([
                videoVmhd,
                videoDinf,
                buildBox(
                  "stbl",
                  concat([
                    videoStsd,
                    videoStts,
                    ...(cttsBox ? [cttsBox] : []),
                    ...(videoStss ? [videoStss] : []),
                    videoStsc,
                    videoStsz,
                    stco,
                  ]),
                ),
              ]),
            ),
          ]),
        ),
      ]),
    );

  // --- audio track (tables copied, offsets rebased) ------------------------
  const buildAudioTrak: ((stco: Uint8Array) => Uint8Array) | null = audio
    ? (stco) =>
        buildBox(
          "trak",
          concat([
            scrubTimestamps(audio.tkhd),
            audio.edts ?? new Uint8Array(0),
            buildBox(
              "mdia",
              concat([
                scrubTimestamps(audio.mdhd),
                audio.hdlr,
                buildBox(
                  "minf",
                  concat([
                    audio.smhd.length > 0 ? audio.smhd : buildSmhd(),
                    audio.dinf.length > 0 ? audio.dinf : buildDinf(),
                    buildBox(
                      "stbl",
                      concat([
                        audio.stsd,
                        audio.stts,
                        audio.stsc,
                        audio.stsz,
                        stco,
                        ...(audio.sgpd ? [audio.sgpd] : []),
                        ...(audio.sbgp ? [audio.sbgp] : []),
                      ]),
                    ),
                  ]),
                ),
              ]),
            ),
          ]),
        )
    : null;

  const audioTkhdDur = audio ? readTkhdDuration(audio.tkhd) : 0;
  const mvhd = scrubTimestamps(buildMvhd(mvhdBody, Math.max(videoTkhdDur, audioTkhdDur)));

  const assembleMoov = (videoStco: Uint8Array, audioStco: Uint8Array): Uint8Array =>
    buildBox(
      "moov",
      concat([
        mvhd,
        buildVideoTrak(videoStco),
        buildAudioTrak ? buildAudioTrak(audioStco) : new Uint8Array(0),
      ]),
    );

  let moovOut = assembleMoov(
    stcoPlaceholder(n),
    stcoPlaceholder(audio ? audio.chunks.length : 0),
  );
  const moovSize = moovOut.length;

  // --- real offsets --------------------------------------------------------
  const mdatHeaderSize = 8;
  const newMdatStart = ftyp.length + moovSize + mdatHeaderSize;
  const videoOffsets: number[] = [];
  let cum = newMdatStart;
  for (const s of sizes) {
    videoOffsets.push(cum);
    cum += s;
  }
  const audioOffsets: number[] = [];
  if (audio) {
    let aCum = newMdatStart + videoBytes;
    for (const c of audio.chunks) {
      audioOffsets.push(aCum);
      aCum += c.size;
    }
  }
  moovOut = assembleMoov(buildStco(videoOffsets), buildStco(audioOffsets));
  if (moovOut.length !== moovSize) throw new PatchError("corrupt");

  const mdatHeader = concat([u32(mdatContentLen + 8), strToBytes("mdat")]);

  const parts: BlobPart[] = [ftyp as BlobPart, moovOut as BlobPart, mdatHeader as BlobPart];
  for (const s of samples) parts.push(s.data as BlobPart);
  if (audio) {
    for (const c of audio.chunks) {
      parts.push(context.file.slice(c.offset, c.offset + c.size));
    }
  }
  return new File(parts, context.file.name, { type: "video/mp4" });
}
