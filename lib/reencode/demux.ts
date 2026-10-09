/**
 * Extracts what the re-encode pipeline needs from a progressive MP4:
 * video samples with presentation timestamps and the raw pieces of the
 * audio track so its bytes can be copied into the new file untouched.
 *
 * Works purely off the `moov` tables that inspection already loaded; sample
 * payloads are referenced by (offset, size) and only read when encoded.
 */

import {
  type BoxRef,
  PatchError,
  findBox,
  findBoxPath,
  findTrackByHandler,
  fullBoxVersion,
  iterBoxes,
  parseChunkOffsets,
  parseCtts,
  parseStsc,
  parseStsz,
  parseStss,
  parseStts,
  readU32,
} from "@/lib/mp4/boxes";
import type { MediaContext } from "@/lib/mp4/inspect";

export interface DemuxedSample {
  /** Presentation time in microseconds (composition time). */
  ptsUs: number;
  isKey: boolean;
  /** Absolute offset in the source file. */
  offset: number;
  size: number;
}

export interface DemuxedVideo {
  /** Decoder codec string, e.g. "avc1.640028". */
  codec: string;
  /** `avcC` payload (decoder description). */
  description: Uint8Array;
  width: number;
  height: number;
  timescale: number;
  /** Average frames per second derived from the stts table. */
  avgFps: number;
  samples: DemuxedSample[];
  /** Raw boxes reused for the rebuilt track. */
  tkhd: Uint8Array;
  hdlr: Uint8Array;
  vmhd: Uint8Array;
  dinf: Uint8Array;
  /** The 78 fixed bytes of the visual sample entry (width/height inside). */
  fixedEntry: Uint8Array;
}

export interface DemuxedAudioChunk {
  offset: number;
  size: number;
}

export interface DemuxedAudio {
  tkhd: Uint8Array;
  mdhd: Uint8Array;
  hdlr: Uint8Array;
  smhd: Uint8Array;
  dinf: Uint8Array;
  stsd: Uint8Array;
  stts: Uint8Array;
  stsc: Uint8Array;
  stsz: Uint8Array;
  edts: Uint8Array | null;
  sgpd: Uint8Array | null;
  sbgp: Uint8Array | null;
  /** Byte ranges of the audio chunks in the source file (chunk order). */
  chunks: DemuxedAudioChunk[];
  sampleCount: number;
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

function requireBox(moov: Uint8Array, ref: BoxRef | null): Uint8Array {
  if (!ref) throw new PatchError("unsupported-boxes");
  return moov.slice(ref.start, ref.end);
}

function mdhdTiming(moov: Uint8Array, track: BoxRef): { timescale: number; duration: number } {
  const mdhd = findBoxPath(moov, ["mdia", "mdhd"], track.start, track.end);
  if (!mdhd) throw new PatchError("unsupported-boxes");
  const content = mdhd.start + mdhd.headerSize;
  const v1 = fullBoxVersion(moov, mdhd) === 1;
  const timescale = readU32(moov, content + (v1 ? 20 : 12));
  const duration = v1 ? readU32(moov, content + 24) * 0x1_0000_0000 + readU32(moov, content + 28) : readU32(moov, content + 16);
  return { timescale, duration };
}

function hex2(value: number): string {
  return value.toString(16).padStart(2, "0");
}

/** Maps a sample index to its stsc samples-per-chunk value. */
function stscMapper(entries: { firstChunk: number; samplesPerChunk: number }[]): (chunkNo: number) => number {
  return (chunkNo: number) => {
    let spc = entries[0]?.samplesPerChunk ?? 1;
    for (const e of entries) {
      if (e.firstChunk <= chunkNo) spc = e.samplesPerChunk;
      else break;
    }
    return spc;
  };
}

export function demuxVideo(context: MediaContext): DemuxedVideo {
  const moov = context.moovBytes;
  const track = findTrackByHandler(moov, moovLocalOf(context), "vide");
  if (!track) throw new PatchError("no-video");
  const stbl = findBoxPath(moov, ["mdia", "minf", "stbl"], track.start, track.end);
  if (!stbl) throw new PatchError("unsupported-boxes");

  const stsdRef = findBox(moov, "stsd", stbl.start, stbl.end);
  const sttsRef = findBox(moov, "stts", stbl.start, stbl.end);
  const stszRef = findBox(moov, "stsz", stbl.start, stbl.end);
  const stscRef = findBox(moov, "stsc", stbl.start, stbl.end);
  const stcoRef =
    findBox(moov, "stco", stbl.start, stbl.end) ??
    findBox(moov, "co64", stbl.start, stbl.end);
  if (!stsdRef || !sttsRef || !stszRef || !stscRef || !stcoRef) {
    throw new PatchError("unsupported-boxes");
  }

  const { timescale } = mdhdTiming(moov, track);
  const sizes = parseStsz(moov, stszRef);
  const offsets = parseChunkOffsets(moov, stbl);
  const stscEntries = parseStsc(moov, stscRef);
  const sttsEntries = parseStts(moov, sttsRef);
  if (sizes.length === 0 || offsets.length === 0 || sttsEntries.length === 0) {
    throw new PatchError("unsupported-boxes");
  }

  // Decode timestamps: expand stts into per-sample deltas.
  const dts = new Float64Array(sizes.length);
  let cursor = 0;
  let totalTicks = 0;
  for (const e of sttsEntries) {
    for (let i = 0; i < e.count && cursor < sizes.length; i++, cursor++) {
      dts[cursor] = totalTicks;
      totalTicks += e.delta;
    }
    if (cursor >= sizes.length) break;
  }
  while (cursor < sizes.length) {
    const delta = sttsEntries[sttsEntries.length - 1].delta;
    dts[cursor] = totalTicks;
    totalTicks += delta;
    cursor++;
  }

  // Composition offsets: expand ctts by sample index when present.
  const cts = new Float64Array(sizes.length);
  const cttsRef = findBox(moov, "ctts", stbl.start, stbl.end);
  if (cttsRef) {
    const { entries } = parseCtts(moov, cttsRef);
    let idx = 0;
    for (const e of entries) {
      for (let i = 0; i < e.count && idx < sizes.length; i++, idx++) cts[idx] = e.offset;
      if (idx >= sizes.length) break;
    }
  }

  const stssRef = findBox(moov, "stss", stbl.start, stbl.end);
  const syncSet = stssRef ? new Set(parseStss(moov, stssRef)) : null;

  const spc = stscMapper(stscEntries);
  const samples: DemuxedSample[] = [];
  let sampleIdx = 0;
  for (let chunk = 1; chunk <= offsets.length && sampleIdx < sizes.length; chunk++) {
    let pos = offsets[chunk - 1];
    const perChunk = spc(chunk);
    for (let j = 0; j < perChunk && sampleIdx < sizes.length; j++, sampleIdx++) {
      const size = sizes[sampleIdx];
      if (pos < 0 || pos + size > context.file.size) throw new PatchError("corrupt");
      const ptsTicks = dts[sampleIdx] + cts[sampleIdx];
      samples.push({
        ptsUs: Math.round((ptsTicks * 1_000_000) / timescale),
        isKey: syncSet === null ? true : syncSet.has(sampleIdx + 1),
        offset: pos,
        size,
      });
      pos += size;
    }
  }
  if (sampleIdx !== sizes.length) throw new PatchError("corrupt");

  // Codec + description from stsd.
  const entries = [...iterBoxes(moov, stsdRef.start + stsdRef.headerSize + 8, stsdRef.end)];
  const entry = entries.find((e) => e.type === "avc1" || e.type === "avc3") ?? entries[0];
  if (!entry) throw new PatchError("unsupported-boxes");
  const avcC = findBox(moov, "avcC", entry.start + entry.headerSize + 78, entry.end);
  if (!avcC) throw new PatchError("unsupported-codec");
  const description = moov.slice(avcC.start + avcC.headerSize, avcC.end);
  if (description.length < 4) throw new PatchError("unsupported-codec");
  const codec = `avc1.${hex2(description[1])}${hex2(description[2])}${hex2(description[3])}`;
  const fixedEntry = moov.slice(
    entry.start + entry.headerSize,
    entry.start + entry.headerSize + 78,
  );
  const width = (fixedEntry[24] << 8) | fixedEntry[25];
  const height = (fixedEntry[26] << 8) | fixedEntry[27];

  const vmhdRef = findBoxPath(moov, ["mdia", "minf", "vmhd"], track.start, track.end);
  const dinfRef = findBoxPath(moov, ["mdia", "minf", "dinf"], track.start, track.end);

  const avgFps = timescale > 0 && totalTicks > 0 ? (sizes.length * timescale) / totalTicks : 0;

  return {
    codec,
    description,
    width,
    height,
    timescale,
    avgFps,
    samples,
    tkhd: requireBox(moov, findBox(moov, "tkhd", track.start, track.end)),
    hdlr: requireBox(moov, findBoxPath(moov, ["mdia", "hdlr"], track.start, track.end)),
    vmhd: vmhdRef ? moov.slice(vmhdRef.start, vmhdRef.end) : new Uint8Array(0),
    dinf: dinfRef ? moov.slice(dinfRef.start, dinfRef.end) : new Uint8Array(0),
    fixedEntry,
  };
}

export function demuxAudio(context: MediaContext): DemuxedAudio | null {
  const moov = context.moovBytes;
  const track = findTrackByHandler(moov, moovLocalOf(context), "soun");
  if (!track) return null;
  const stbl = findBoxPath(moov, ["mdia", "minf", "stbl"], track.start, track.end);
  if (!stbl) return null;

  const stszRef = findBox(moov, "stsz", stbl.start, stbl.end);
  const stscRef = findBox(moov, "stsc", stbl.start, stbl.end);
  const stcoRef =
    findBox(moov, "stco", stbl.start, stbl.end) ??
    findBox(moov, "co64", stbl.start, stbl.end);
  const stsdRef = findBox(moov, "stsd", stbl.start, stbl.end);
  const sttsRef = findBox(moov, "stts", stbl.start, stbl.end);
  const tkhdRef = findBox(moov, "tkhd", track.start, track.end);
  const mdhdRef = findBoxPath(moov, ["mdia", "mdhd"], track.start, track.end);
  const hdlrRef = findBoxPath(moov, ["mdia", "hdlr"], track.start, track.end);
  if (!stszRef || !stscRef || !stcoRef || !stsdRef || !sttsRef || !tkhdRef || !mdhdRef || !hdlrRef) {
    return null;
  }

  const sizes = parseStsz(moov, stszRef);
  const offsets = parseChunkOffsets(moov, stbl);
  const stscEntries = parseStsc(moov, stscRef);
  if (sizes.length === 0 || offsets.length === 0) return null;

  const spc = stscMapper(stscEntries);
  const chunks: DemuxedAudioChunk[] = [];
  let sampleIdx = 0;
  for (let chunk = 1; chunk <= offsets.length; chunk++) {
    const perChunk = spc(chunk);
    let byteLen = 0;
    for (let j = 0; j < perChunk && sampleIdx < sizes.length; j++, sampleIdx++) {
      byteLen += sizes[sampleIdx];
    }
    if (byteLen > 0) chunks.push({ offset: offsets[chunk - 1], size: byteLen });
  }

  const smhdRef = findBoxPath(moov, ["mdia", "minf", "smhd"], track.start, track.end);
  const dinfRef = findBoxPath(moov, ["mdia", "minf", "dinf"], track.start, track.end);

  return {
    tkhd: moov.slice(tkhdRef.start, tkhdRef.end),
    mdhd: moov.slice(mdhdRef.start, mdhdRef.end),
    hdlr: moov.slice(hdlrRef.start, hdlrRef.end),
    smhd: smhdRef ? moov.slice(smhdRef.start, smhdRef.end) : new Uint8Array(0),
    dinf: dinfRef ? moov.slice(dinfRef.start, dinfRef.end) : new Uint8Array(0),
    stsd: moov.slice(stsdRef.start, stsdRef.end),
    stts: moov.slice(sttsRef.start, sttsRef.end),
    stsc: moov.slice(stscRef.start, stscRef.end),
    stsz: moov.slice(stszRef.start, stszRef.end),
    edts: (() => {
      const edts = findBox(moov, "edts", track.start, track.end);
      return edts ? moov.slice(edts.start, edts.end) : null;
    })(),
    sgpd: (() => {
      const b = findBox(moov, "sgpd", stbl.start, stbl.end);
      return b ? moov.slice(b.start, b.end) : null;
    })(),
    sbgp: (() => {
      const b = findBox(moov, "sbgp", stbl.start, stbl.end);
      return b ? moov.slice(b.start, b.end) : null;
    })(),
    chunks,
    sampleCount: sizes.length,
  };
}
