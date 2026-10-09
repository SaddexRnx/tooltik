/**
 * The patching pipeline.
 *
 * A faithful TypeScript port of `transform.py` from
 * github.com/BastienGimbert/tiktok-quality (MIT), reproducing the container
 * manipulation performed by the "TikTok Enhancer" server:
 *
 *  1. `ftyp` rebranded to `isom`, fast-start layout (moov before mdat)
 *  2. `avcC` extended with High-profile bytes
 *  3. "Ghost frames": declared frame count inflated 10x, every ghost frame
 *     pointing at one shared 8-byte filler NAL — +8 bytes of media total,
 *     no pixels are re-encoded or modified
 *  4. Audio handler renamed to "SoundHandler", language set to `und`,
 *     timing realigned (payload bytes untouched)
 *  5. iTunes-style comment tag (reference signature)
 *  6. Bitrates recalculated for both tracks
 *
 * Every encoded media sample (video and audio) is copied byte-for-byte:
 * the output payload is validated against the original by
 * `lib/validate/payload.ts` (Gate 2). Only container tables are rewritten.
 *
 * 100% client-side: media data streams from the original `File` through
 * `Blob` slices and is never copied into JavaScript memory.
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
  parseStsc,
  parseStsz,
  parseStts,
  readU32,
} from "./boxes";
import {
  buildAvcc,
  buildBtrt,
  buildBox,
  buildDinf,
  buildFree,
  buildFtyp,
  buildHdlr,
  buildMdhd,
  buildMvhd,
  buildSmhd,
  buildStco,
  buildStsc,
  buildStsz,
  buildStsdVideo,
  buildStts,
  buildTkhd,
  buildUdtaComment,
  buildVmhd,
  concat,
  scrubTimestamps,
  u32,
} from "./build";
import { type MediaContext, PATCH_SIGNATURE, audioTrackOf } from "./inspect";

/** 8-byte filler NAL: length=4, AVC NAL type 0 (unspecified), empty payload. */
const PADDING_NAL = new Uint8Array([0, 0, 0, 4, 0, 0, 0, 0]);
const PADDING_SIZE = PADDING_NAL.length;

/** ISO 639-2/T packed language code for "und". */
const LANG_UND = 0x55c4;

/** Declared-frame-count multiplier (the reference tool uses 10x). */
export const FRAME_MULTIPLIER = 10;

export type PatchStage =
  | "validate"
  | "first-sample"
  | "audio"
  | "metadata"
  | "assemble"
  | "done";

export interface PatchProgress {
  stage: PatchStage;
  /** Overall completion, 0–100. */
  percent: number;
}

export interface PatchStats {
  inputSize: number;
  outputSize: number;
  sizeDelta: number;
  originalFrames: number;
  declaredFrames: number;
  ghostFrames: number;
  multiplier: number;
  /** SEI bytes removed from the first frame. */
  seiBytesRemoved: number;
  /** Fast-start status of the input file (output is always fast-start). */
  inputFastStart: boolean;
  /** Input `ftyp` brand (output is always `isom`). */
  inputBrand: string;
  /** Non-AV tracks (timecode, subtitles, metadata ...) removed from output. */
  droppedTracks: number;
  /** Audio timing was realigned (edit-list based trim). */
  audioAdjusted: boolean;
  /** Variable frame timing was collapsed to a single delta. */
  frameTimingFlattened: boolean;
  /** Creation dates were zeroed in the output headers. */
  timestampsScrubbed: boolean;
  videoBitrateBps: number | null;
  audioBitrateBps: number | null;
  durationSec: number;
  comment: string;
}

export interface PatchOutcome {
  blob: Blob;
  stats: PatchStats;
}

export interface PatchOptions {
  onProgress?: (progress: PatchProgress) => void;
  /** Metadata comment/signature. Defaults to the reference signature. */
  comment?: string;
  /** Zero creation dates in the output headers (privacy). Default true. */
  scrubMetadata?: boolean;
  /** Collapse variable frame timing to a single delta. Default false. */
  flattenFrameTiming?: boolean;
  /**
   * Ghost-frame sample-table multiplier: each real frame gains
   * `frameMultiplier - 1` padding samples. 1 disables padding (hygiene,
   * timescale and edit-list methods rewrite the container only). Default 10.
   */
  frameMultiplier?: number;
  /**
   * Divide the video track's `mdhd` timescale and duration by this integer
   * (timing-header method). Timescale and duration must both be divisible;
   * otherwise the transform fails with `timescale-indivisible`.
   */
  timescaleDivider?: number;
  /**
   * Insert an identity `edts`/`elst` (media_time 0, rate 1.0) on the video
   * track when it has none. Fails with `already-has-edit-list` otherwise.
   */
  insertIdentityElst?: boolean;
}

function yieldToUi(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => resolve());
    } else {
      setTimeout(resolve, 0);
    }
  });
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

function videoTrackOf(context: MediaContext): BoxRef {
  const track = findTrackByHandler(context.moovBytes, moovLocalOf(context), "vide");
  if (!track) throw new PatchError("no-video");
  return track;
}

function trackStbl(moov: Uint8Array, track: BoxRef): BoxRef {
  const stbl = findBoxPath(moov, ["mdia", "minf", "stbl"], track.start, track.end);
  if (!stbl) throw new PatchError("unsupported-boxes");
  return stbl;
}

/** Reads the `tkhd` duration (movie-timescale ticks). */
function readTkhdDuration(moov: Uint8Array, tkhd: BoxRef): number {
  if (fullBoxVersion(moov, tkhd) === 1) {
    const at = tkhd.start + 36;
    if (at + 8 > tkhd.end) return 0;
    return readU32(moov, at) * 0x1_0000_0000 + readU32(moov, at + 4);
  }
  return readU32(moov, tkhd.start + 28);
}

/** The AVC sample entry inside an `stsd` (first avc1/avc3, else first). */
function firstSampleEntry(moov: Uint8Array, stsd: BoxRef): BoxRef {
  const entries = [
    ...iterBoxes(moov, stsd.start + stsd.headerSize + 8, stsd.end),
  ];
  const entry =
    entries.find((e) => e.type === "avc1" || e.type === "avc3") ?? entries[0];
  if (!entry) throw new PatchError("unsupported-boxes");
  return entry;
}

function boxBody(buf: Uint8Array, ref: BoxRef): Uint8Array {
  return buf.subarray(ref.start + ref.headerSize, ref.end);
}

/** Copies a whole box (header included) or returns null when absent. */
function copyBox(buf: Uint8Array, ref: BoxRef | null): Uint8Array | null {
  return ref ? buf.slice(ref.start, ref.end) : null;
}

function requireBox(buf: Uint8Array, ref: BoxRef | null): Uint8Array {
  if (!ref) throw new PatchError("unsupported-boxes");
  return buf.slice(ref.start, ref.end);
}

function asciiBytes(text: string): Uint8Array {
  const b = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) b[i] = text.charCodeAt(i) & 0xff;
  return b;
}

function u64Bytes(value: number): Uint8Array {
  const b = new Uint8Array(8);
  const dv = new DataView(b.buffer);
  dv.setUint32(0, Math.floor(value / 0x1_0000_0000), false);
  dv.setUint32(4, value >>> 0, false);
  return b;
}

/** An all-zero `stco` box of the right size, filled in on the second pass. */
function stcoPlaceholder(chunkCount: number): Uint8Array {
  const box = new Uint8Array(16 + chunkCount * 4);
  box.set(u32(16 + chunkCount * 4), 0);
  box.set(asciiBytes("stco"), 4);
  box.set(u32(chunkCount), 8); // version/flags = 0 already
  return box;
}

interface AudioTiming {
  /** New audio duration in movie-timescale ticks (for tkhd). */
  newTrackDuration: number;
  /** New audio media duration in media-timescale ticks (for mdhd). */
  newMediaDuration: number;
  newStts: { count: number; delta: number }[];
  oldBitrate: number;
  newBitrate: number;
  adjusted: boolean;
}

/**
 * Computes the audio timing adjustment: trims the final audio sample so the
 * audio lines up with the video, mirroring the reference implementation.
 * Falls back to the original timing when the edit list is missing/odd.
 */
function computeAudioTiming(
  moov: Uint8Array,
  track: BoxRef,
  stbl: BoxRef,
): AudioTiming {
  const sttsRef = findBox(moov, "stts", stbl.start, stbl.end);
  const stszRef = findBox(moov, "stsz", stbl.start, stbl.end);
  const mdhd = findBoxPath(moov, ["mdia", "mdhd"], track.start, track.end);
  if (!sttsRef || !stszRef || !mdhd) throw new PatchError("unsupported-boxes");

  const stts = parseStts(moov, sttsRef);
  const sizes = parseStsz(moov, stszRef);
  const mdhdContent = mdhd.start + mdhd.headerSize;
  const mdhdV1 = fullBoxVersion(moov, mdhd) === 1;
  const timescale = readU32(moov, mdhdContent + (mdhdV1 ? 20 : 12));
  const mediaDuration = mdhdV1
    ? readU32(moov, mdhdContent + 24) * 0x1_0000_0000 +
      readU32(moov, mdhdContent + 28)
    : readU32(moov, mdhdContent + 16);

  const totalBytes = sizes.reduce((a, b) => a + b, 0);
  const oldTicks = stts.reduce((a, e) => a + e.count * e.delta, 0);
  const oldBitrate =
    oldTicks > 0 && timescale > 0
      ? Math.floor((totalBytes * 8 * timescale) / oldTicks)
      : 0;

  const fallback: AudioTiming = {
    newTrackDuration: 0, // caller substitutes the original tkhd duration
    newMediaDuration: mediaDuration,
    newStts: stts,
    oldBitrate,
    newBitrate: oldBitrate,
    adjusted: false,
  };

  if (stts.length === 0 || sizes.length === 0 || timescale === 0) return fallback;

  const elst = findBoxPath(moov, ["edts", "elst"], track.start, track.end);
  if (!elst) return fallback;
  const elstContent = elst.start + elst.headerSize;
  const elstV1 = fullBoxVersion(moov, elst) === 1;
  if (readU32(moov, elstContent + 4) < 1) return fallback;

  let segmentDuration: number;
  let mediaTime: number;
  if (elstV1) {
    segmentDuration =
      readU32(moov, elstContent + 8) * 0x1_0000_0000 +
      readU32(moov, elstContent + 12);
    mediaTime =
      readU32(moov, elstContent + 16) * 0x1_0000_0000 +
      readU32(moov, elstContent + 20);
  } else {
    segmentDuration = readU32(moov, elstContent + 8);
    mediaTime = readU32(moov, elstContent + 12);
  }
  // mediaTime -1 (0xFFFFFFFF) means an empty edit → keep original timing.
  if (mediaTime > 0x7fff_ffff) return fallback;

  const newMediaDuration = Math.floor((segmentDuration * timescale) / 1000);
  const targetTicks = newMediaDuration + mediaTime;
  const delta = stts[0].delta;
  const mainCount = sizes.length - 1;
  const lastDelta = targetTicks - mainCount * delta;
  if (lastDelta <= 0 || lastDelta > delta) return fallback;

  const newStts =
    mainCount > 0
      ? [
          { count: mainCount, delta },
          { count: 1, delta: lastDelta },
        ]
      : [{ count: 1, delta: lastDelta }];
  const newTicks = newStts.reduce((a, e) => a + e.count * e.delta, 0);

  return {
    newTrackDuration: segmentDuration,
    newMediaDuration,
    newStts,
    oldBitrate,
    newBitrate: newTicks > 0 ? Math.floor((totalBytes * 8 * timescale) / newTicks) : 0,
    adjusted: true,
  };
}

function indexOfBytes(haystack: Uint8Array, needle: Uint8Array, from: number): number {
  if (needle.length === 0) return from;
  outer: for (let i = from; i <= haystack.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) continue outer;
    }
    return i;
  }
  return -1;
}

/** Replaces every big-endian occurrence of `from` with `to` (bitrate patch). */
function replaceU32(buf: Uint8Array, from: number, to: number): Uint8Array {
  if (from === to || from === 0) return buf;
  const out = buf.slice();
  const needle = new Uint8Array([(from >>> 24) & 0xff, (from >>> 16) & 0xff, (from >>> 8) & 0xff, from & 0xff]);
  const repl = new Uint8Array([(to >>> 24) & 0xff, (to >>> 16) & 0xff, (to >>> 8) & 0xff, to & 0xff]);
  let idx = indexOfBytes(out, needle, 0);
  while (idx !== -1) {
    out.set(repl, idx);
    idx = indexOfBytes(out, needle, idx + 4);
  }
  return out;
}

function countTracks(moov: Uint8Array, moovHeaderSize: number): number {
  let count = 0;
  for (const box of iterBoxes(moov, moovHeaderSize, moov.length)) {
    if (box.type === "trak") count++;
  }
  return count;
}

/** The delta covered by the most frames (ties broken by table order). */
function modalDelta(stts: { count: number; delta: number }[]): number {
  let best = stts[0].delta;
  let bestCount = -1;
  for (const e of stts) {
    if (e.count > bestCount) {
      best = e.delta;
      bestCount = e.count;
    }
  }
  return best;
}

function writeU32At(buf: Uint8Array, at: number, value: number): void {
  const v = value >>> 0;
  buf[at] = (v >>> 24) & 0xff;
  buf[at + 1] = (v >>> 16) & 0xff;
  buf[at + 2] = (v >>> 8) & 0xff;
  buf[at + 3] = v & 0xff;
}

/**
 * Returns a copy of an `mdhd` box with timescale and duration divided by an
 * exact integer divisor. Both values must divide without a remainder so the
 * declared duration in seconds is unchanged; otherwise `timescale-indivisible`.
 */
function divideMdhdBox(mdhd: Uint8Array, headerSize: number, divider: number): Uint8Array {
  const out = mdhd.slice();
  const content = headerSize;
  if (out.length < content + 4) throw new PatchError("unsupported-boxes");
  const v1 = out[content] === 1;
  if (out.length < content + (v1 ? 32 : 20)) {
    throw new PatchError("unsupported-boxes");
  }
  const tsAt = content + (v1 ? 20 : 12);
  const durAt = content + (v1 ? 24 : 16);
  const ts = readU32(out, tsAt);
  if (ts % divider !== 0) throw new PatchError("timescale-indivisible");
  if (v1) {
    const dur = readU32(out, durAt) + readU32(out, durAt + 4) * 0x1_0000_0000;
    if (dur % divider !== 0) throw new PatchError("timescale-indivisible");
    const q = dur / divider;
    writeU32At(out, durAt, Math.floor(q / 0x1_0000_0000));
    writeU32At(out, durAt + 4, q >>> 0);
  } else {
    const dur = readU32(out, durAt);
    if (dur % divider !== 0) throw new PatchError("timescale-indivisible");
    writeU32At(out, durAt, dur / divider);
  }
  writeU32At(out, tsAt, ts / divider);
  return out;
}

/**
 * Identity edit list: play the whole track from its first media sample at
 * 1x rate. `segmentDuration` is in movie-timescale ticks (tkhd duration).
 */
function buildIdentityEdts(segmentDuration: number): Uint8Array {
  const useV1 = segmentDuration > 0xffff_ffff;
  const parts: Uint8Array[] = [
    u32(useV1 ? 0x0100_0000 : 0), // version + flags
    u32(1), // entry_count
  ];
  if (useV1) {
    parts.push(u64Bytes(segmentDuration));
    parts.push(u32(0), u32(0)); // media_time = 0 (i64)
  } else {
    parts.push(u32(segmentDuration), u32(0)); // media_time = 0 (i32)
  }
  parts.push(u32(0x0001_0000)); // rate = 1.0 (16.16 fixed)
  return buildBox("edts", buildBox("elst", concat(parts)));
}

/**
 * Applies the metadata/container patch. No pixels are re-encoded — the
 * output media data is byte-for-byte identical to the input, plus one shared
 * 8-byte filler NAL and rebuilt metadata tables.
 */
export async function transformMedia(
  context: MediaContext,
  options: PatchOptions = {},
): Promise<PatchOutcome> {
  const {
    onProgress,
    comment = PATCH_SIGNATURE,
    scrubMetadata = true,
    flattenFrameTiming = false,
    frameMultiplier = FRAME_MULTIPLIER,
    timescaleDivider = 1,
    insertIdentityElst = false,
  } = options;
  if (!Number.isInteger(frameMultiplier) || frameMultiplier < 1) {
    throw new PatchError("unknown", "frameMultiplier must be an integer >= 1");
  }
  if (!Number.isInteger(timescaleDivider) || timescaleDivider < 1) {
    throw new PatchError("unknown", "timescaleDivider must be an integer >= 1");
  }
  const report = (stage: PatchStage, percent: number) => onProgress?.({ stage, percent });

  const moov = context.moovBytes;
  const { moov: moovAbs, mdat: mdatAbs } = context.topLevel;
  const file = context.file;
  const mdatDataStart = mdatAbs.start + mdatAbs.headerSize;
  const mdatEnd = mdatAbs.end;

  // -------------------------------------------------------------------------
  // 1. Validate + read video tables
  // -------------------------------------------------------------------------
  report("validate", 8);
  await yieldToUi();

  const videoTrack = videoTrackOf(context);
  const videoStbl = trackStbl(moov, videoTrack);

  const sttsRef = findBox(moov, "stts", videoStbl.start, videoStbl.end);
  const stszRef = findBox(moov, "stsz", videoStbl.start, videoStbl.end);
  const stscRef = findBox(moov, "stsc", videoStbl.start, videoStbl.end);
  const stsdRef = findBox(moov, "stsd", videoStbl.start, videoStbl.end);
  if (!sttsRef || !stszRef || !stscRef || !stsdRef) {
    throw new PatchError("unsupported-boxes");
  }

  const videoChunks = parseChunkOffsets(moov, videoStbl);
  const videoSizes = parseStsz(moov, stszRef);
  const videoStsc = parseStsc(moov, stscRef);
  const videoStts = parseStts(moov, sttsRef);
  if (videoChunks.length === 0 || videoSizes.length === 0 || videoStts.length === 0) {
    throw new PatchError("unsupported-boxes");
  }

  const origFrames = videoSizes.length;
  // Opt-in: collapse uneven sample durations to the most common delta.
  // Some upload pipelines mishandle variable frame timing.
  const distinctDeltas = new Set(videoStts.map((e) => e.delta)).size;
  const flatten = flattenFrameTiming && distinctDeltas > 1;
  const timeDelta = flatten ? modalDelta(videoStts) : videoStts[0].delta;
  const effectiveStts = flatten ? [{ count: origFrames, delta: timeDelta }] : videoStts;
  const padCount = origFrames * (frameMultiplier - 1);
  const declaredFrames = origFrames + padCount;

  const vMdhd = findBoxPath(moov, ["mdia", "mdhd"], videoTrack.start, videoTrack.end);
  if (!vMdhd) throw new PatchError("unsupported-boxes");
  const vMdhdContent = vMdhd.start + vMdhd.headerSize;
  const vMdhdV1 = fullBoxVersion(moov, vMdhd) === 1;
  const vTimescale = readU32(moov, vMdhdContent + (vMdhdV1 ? 20 : 12));
  const vDuration = vMdhdV1
    ? readU32(moov, vMdhdContent + 24) * 0x1_0000_0000 + readU32(moov, vMdhdContent + 28)
    : readU32(moov, vMdhdContent + 16);
  // With flattened timing the video headers are rebuilt from the new delta
  // (ghost frames stay out of header durations, matching the original).
  const flatTicks = flatten ? origFrames * timeDelta : 0;
  const durationSec = vTimescale > 0 ? (flatten ? flatTicks : vDuration) / vTimescale : 0;
  // Timing-header method: timescale and duration must both divide exactly so
  // the declared duration in seconds stays bit-for-bit identical.
  if (timescaleDivider > 1) {
    const effectiveTicks = flatten ? flatTicks : vDuration;
    if (
      vTimescale % timescaleDivider !== 0 ||
      effectiveTicks % timescaleDivider !== 0
    ) {
      throw new PatchError("timescale-indivisible");
    }
  }

  // -------------------------------------------------------------------------
  // 2. Validate the first sample location (payload is copied verbatim;
  //    Gate 2 later proves every encoded sample is byte-identical)
  // -------------------------------------------------------------------------
  report("first-sample", 25);
  await yieldToUi();

  const firstOff = videoChunks[0];
  const firstSize = videoSizes[0];
  if (firstOff < mdatDataStart || firstOff + firstSize > file.size) {
    throw new PatchError("corrupt");
  }
  const seiBytesRemoved = 0;

  // -------------------------------------------------------------------------
  // 3. Audio track timing + bitrate
  // -------------------------------------------------------------------------
  report("audio", 40);
  await yieldToUi();

  const audioTrack = audioTrackOf(context);
  let audioStbl: BoxRef | null = null;
  let audioTiming: AudioTiming | null = null;
  let audioChunks: number[] = [];
  if (audioTrack) {
    audioStbl = trackStbl(moov, audioTrack);
    audioChunks = parseChunkOffsets(moov, audioStbl);
    audioTiming = computeAudioTiming(moov, audioTrack, audioStbl);
    if (audioTiming.newTrackDuration === 0) {
      const aTkhd = findBox(moov, "tkhd", audioTrack.start, audioTrack.end);
      audioTiming.newTrackDuration = aTkhd ? readTkhdDuration(moov, aTkhd) : 0;
    }
  }

  // -------------------------------------------------------------------------
  // 4. Rebuild metadata (pass 1: real sizes, placeholder chunk offsets)
  // -------------------------------------------------------------------------
  report("metadata", 60);
  await yieldToUi();

  const ftyp = buildFtyp();
  const free = buildFree();

  const mvhdRef = findBox(moov, "mvhd", 0, moov.length);
  const vTkhd = findBox(moov, "tkhd", videoTrack.start, videoTrack.end);
  if (!mvhdRef || !vTkhd) throw new PatchError("unsupported-boxes");
  const maybeScrub = (b: Uint8Array): Uint8Array =>
    scrubMetadata ? scrubTimestamps(b) : b;
  const mvhdBody = boxBody(moov, mvhdRef);
  const mvTimescale = readU32(mvhdBody, mvhdBody[0] === 1 ? 20 : 12);
  const vTkhdDuration = readTkhdDuration(moov, vTkhd);
  const newVTkhdDuration =
    flatten && vTimescale > 0 && mvTimescale > 0
      ? Math.round((flatTicks * mvTimescale) / vTimescale)
      : vTkhdDuration;
  const newMvhdDuration = audioTiming
    ? Math.max(newVTkhdDuration, audioTiming.newTrackDuration)
    : newVTkhdDuration;
  const mvhd = maybeScrub(buildMvhd(mvhdBody, newMvhdDuration));

  // --- video track --------------------------------------------------------
  const videoTkhd = maybeScrub(
    flatten
      ? buildTkhd(moov.slice(vTkhd.start, vTkhd.end), newVTkhdDuration)
      : moov.slice(vTkhd.start, vTkhd.end),
  );
  const existingVideoEdts = findBox(moov, "edts", videoTrack.start, videoTrack.end);
  if (insertIdentityElst && existingVideoEdts) {
    throw new PatchError("already-has-edit-list");
  }
  const videoEdts = insertIdentityElst
    ? buildIdentityEdts(newVTkhdDuration)
    : copyBox(moov, existingVideoEdts);
  const videoMdhdBase = flatten
    ? buildMdhd(boxBody(moov, vMdhd), { duration: flatTicks })
    : moov.slice(vMdhd.start, vMdhd.end);
  const videoMdhd = maybeScrub(
    timescaleDivider > 1
      ? divideMdhdBox(videoMdhdBase, vMdhd.headerSize, timescaleDivider)
      : videoMdhdBase,
  );
  const videoHdlr = requireBox(moov, findBoxPath(moov, ["mdia", "hdlr"], videoTrack.start, videoTrack.end));
  const videoVmhdRef = findBoxPath(moov, ["mdia", "minf", "vmhd"], videoTrack.start, videoTrack.end);
  const videoVmhd = videoVmhdRef ? moov.slice(videoVmhdRef.start, videoVmhdRef.end) : buildVmhd();
  const videoDinfRef = findBoxPath(moov, ["mdia", "minf", "dinf"], videoTrack.start, videoTrack.end);
  const videoDinf = videoDinfRef ? moov.slice(videoDinfRef.start, videoDinfRef.end) : buildDinf();

  const videoEntry = firstSampleEntry(moov, stsdRef);
  const fixedFields = moov.slice(
    videoEntry.start + videoEntry.headerSize,
    videoEntry.start + videoEntry.headerSize + 78,
  );
  const totalVideoBytes = videoSizes.reduce((a, b) => a + b, 0);
  const newVideoAvgBitrate = durationSec > 0 ? Math.floor((totalVideoBytes * 8) / durationSec) : 0;

  const stsdChildren: Uint8Array[] = [];
  let hasBtrt = false;
  const childrenStart = videoEntry.start + videoEntry.headerSize + 78;
  for (const child of iterBoxes(moov, childrenStart, videoEntry.end)) {
    if (child.type === "avcC") {
      stsdChildren.push(buildAvcc(boxBody(moov, child)));
    } else if (child.type === "btrt") {
      hasBtrt = true;
      const maxBitrate = readU32(moov, child.start + 12) || newVideoAvgBitrate;
      stsdChildren.push(buildBtrt(0, maxBitrate, newVideoAvgBitrate));
    } else {
      stsdChildren.push(moov.slice(child.start, child.end));
    }
  }
  if (!hasBtrt) stsdChildren.push(buildBtrt(0, newVideoAvgBitrate, newVideoAvgBitrate));
  const videoStsdNew = buildStsdVideo(fixedFields, stsdChildren, videoEntry.type);

  const videoSttsNew = buildStts(
    padCount === 0
      ? effectiveStts
      : effectiveStts.length === 1
        ? [
            { count: origFrames, delta: timeDelta },
            { count: padCount, delta: timeDelta },
          ]
        : [...effectiveStts, { count: padCount, delta: timeDelta }],
  );
  const videoStss = copyBox(moov, findBox(moov, "stss", videoStbl.start, videoStbl.end));
  const videoSdtp = copyBox(moov, findBox(moov, "sdtp", videoStbl.start, videoStbl.end));
  const videoCtts = copyBox(moov, findBox(moov, "ctts", videoStbl.start, videoStbl.end));
  const videoStscNew = buildStsc(
    padCount > 0
      ? [
          ...videoStsc,
          { firstChunk: videoChunks.length + 1, samplesPerChunk: 1, descriptionIndex: 1 },
        ]
      : videoStsc,
  );
  const videoStszNew = buildStsz([
    ...videoSizes,
    ...new Array<number>(padCount).fill(PADDING_SIZE),
  ]);

  const buildVideoTrak = (stco: Uint8Array): Uint8Array =>
    buildBox(
      "trak",
      concat([
        videoTkhd,
        videoEdts ?? new Uint8Array(0),
        buildBox(
          "mdia",
          concat([
            videoMdhd,
            videoHdlr,
            buildBox(
              "minf",
              concat([
                videoVmhd,
                videoDinf,
                buildBox(
                  "stbl",
                  concat([
                    videoStsdNew,
                    videoSttsNew,
                    ...(videoStss ? [videoStss] : []),
                    ...(videoSdtp ? [videoSdtp] : []),
                    ...(videoCtts ? [videoCtts] : []),
                    videoStscNew,
                    videoStszNew,
                    stco,
                  ]),
                ),
              ]),
            ),
          ]),
        ),
      ]),
    );

  // --- audio track --------------------------------------------------------
  let buildAudioTrak: ((stco: Uint8Array) => Uint8Array) | null = null;
  if (audioTrack && audioStbl && audioTiming) {
    const aTkhd = findBox(moov, "tkhd", audioTrack.start, audioTrack.end);
    const aMdhd = findBoxPath(moov, ["mdia", "mdhd"], audioTrack.start, audioTrack.end);
    const aStsd = findBox(moov, "stsd", audioStbl.start, audioStbl.end);
    const aStsc = findBox(moov, "stsc", audioStbl.start, audioStbl.end);
    const aStsz = findBox(moov, "stsz", audioStbl.start, audioStbl.end);
    const aStts = findBox(moov, "stts", audioStbl.start, audioStbl.end);
    if (!aTkhd || !aMdhd || !aStsd || !aStsc || !aStsz || !aStts) {
      throw new PatchError("unsupported-boxes");
    }

    const audioTkhd = maybeScrub(
      buildTkhd(moov.slice(aTkhd.start, aTkhd.end), audioTiming.newTrackDuration),
    );
    const audioEdts = copyBox(moov, findBox(moov, "edts", audioTrack.start, audioTrack.end));
    const audioMdhd = maybeScrub(
      buildMdhd(boxBody(moov, aMdhd), {
        duration: audioTiming.newMediaDuration,
        language: LANG_UND,
      }),
    );
    const audioHdlr = buildHdlr("soun", "SoundHandler");
    const audioSmhdRef = findBoxPath(moov, ["mdia", "minf", "smhd"], audioTrack.start, audioTrack.end);
    const audioSmhd = audioSmhdRef ? moov.slice(audioSmhdRef.start, audioSmhdRef.end) : buildSmhd();
    const audioDinfRef = findBoxPath(moov, ["mdia", "minf", "dinf"], audioTrack.start, audioTrack.end);
    const audioDinf = audioDinfRef ? moov.slice(audioDinfRef.start, audioDinfRef.end) : buildDinf();
    const audioStsd = replaceU32(
      moov.slice(aStsd.start, aStsd.end),
      audioTiming.oldBitrate,
      audioTiming.newBitrate,
    );
    const audioSttsNew = buildStts(audioTiming.newStts);
    const audioStscBytes = moov.slice(aStsc.start, aStsc.end);
    const audioStszBytes = moov.slice(aStsz.start, aStsz.end);
    const audioSgpd = copyBox(moov, findBox(moov, "sgpd", audioStbl.start, audioStbl.end));
    const audioSbgp = copyBox(moov, findBox(moov, "sbgp", audioStbl.start, audioStbl.end));

    buildAudioTrak = (stco: Uint8Array) =>
      buildBox(
        "trak",
        concat([
          audioTkhd,
          audioEdts ?? new Uint8Array(0),
          buildBox(
            "mdia",
            concat([
              audioMdhd,
              audioHdlr,
              buildBox(
                "minf",
                concat([
                  audioSmhd,
                  audioDinf,
                  buildBox(
                    "stbl",
                    concat([
                      audioStsd,
                      audioSttsNew,
                      audioStscBytes,
                      audioStszBytes,
                      stco,
                      ...(audioSgpd ? [audioSgpd] : []),
                      ...(audioSbgp ? [audioSbgp] : []),
                    ]),
                  ),
                ]),
              ),
            ]),
          ),
        ]),
      );
  }

  const udta = buildUdtaComment(comment);

  const assembleMoov = (videoStco: Uint8Array, audioStco: Uint8Array): Uint8Array =>
    buildBox(
      "moov",
      concat([
        mvhd,
        buildVideoTrak(videoStco),
        buildAudioTrak ? buildAudioTrak(audioStco) : new Uint8Array(0),
        udta,
      ]),
    );

  let moovOut = assembleMoov(
    stcoPlaceholder(videoChunks.length + padCount),
    stcoPlaceholder(audioChunks.length),
  );
  const moovSizePass1 = moovOut.length;

  // -------------------------------------------------------------------------
  // 5. Second pass: real chunk offsets (identical sizes, asserted)
  // -------------------------------------------------------------------------
  report("assemble", 78);
  await yieldToUi();

  const beforeLen = firstOff - mdatDataStart;
  const afterLen = mdatEnd - (firstOff + firstSize);
  // The filler NAL only exists when padding samples are actually written.
  const padBytes = padCount > 0 ? PADDING_SIZE : 0;
  const mdatContentLen = beforeLen + firstSize + afterLen + padBytes;
  const mdatHeaderSize = mdatContentLen + 8 > 0xffff_ffff ? 16 : 8;
  const newMdatStart = ftyp.length + free.length + moovSizePass1 + mdatHeaderSize;
  // Chunk offsets are 32-bit (stco): the output must stay below 4 GiB.
  if (newMdatStart + mdatContentLen > 0xffff_ffff) {
    throw new PatchError("too-large");
  }
  const padAbs = newMdatStart + mdatContentLen - padBytes;

  // The whole mdat body is copied verbatim, so every offset shifts by the
  // same constant (the new header layout) with no per-sample adjustment.
  const rebase = (offset: number): number => newMdatStart + (offset - mdatDataStart);

  const videoOffsets = videoChunks.map(rebase);
  for (let i = 0; i < padCount; i++) videoOffsets.push(padAbs);
  const audioOffsets = audioChunks.map(rebase);

  moovOut = assembleMoov(buildStco(videoOffsets), buildStco(audioOffsets));
  if (moovOut.length !== moovSizePass1) throw new PatchError("corrupt");

  // -------------------------------------------------------------------------
  // 6. Assemble output — media streams straight from the original file
  // -------------------------------------------------------------------------
  const mdatHeader =
    mdatHeaderSize === 16
      ? concat([u32(1), asciiBytes("mdat"), u64Bytes(mdatContentLen + 16)])
      : concat([u32(mdatContentLen + 8), asciiBytes("mdat")]);

  const blob = new Blob(
    [
      ftyp as BlobPart,
      free as BlobPart,
      moovOut as BlobPart,
      mdatHeader as BlobPart,
      file.slice(mdatDataStart, mdatEnd),
      ...(padCount > 0 ? [PADDING_NAL as BlobPart] : []),
    ],
    { type: "video/mp4" },
  );

  const outputSize = blob.size;
  const stats: PatchStats = {
    inputSize: file.size,
    outputSize,
    sizeDelta: outputSize - file.size,
    originalFrames: origFrames,
    declaredFrames,
    ghostFrames: padCount,
    multiplier: frameMultiplier,
    seiBytesRemoved,
    inputFastStart: moovAbs.start < mdatAbs.start,
    inputBrand: context.ftypBrand,
    droppedTracks: Math.max(0, countTracks(moov, moovAbs.headerSize) - (audioTrack ? 2 : 1)),
    audioAdjusted: audioTiming?.adjusted ?? false,
    frameTimingFlattened: flatten,
    timestampsScrubbed: scrubMetadata,
    videoBitrateBps: newVideoAvgBitrate > 0 ? newVideoAvgBitrate : null,
    audioBitrateBps: audioTiming && audioTiming.newBitrate > 0 ? audioTiming.newBitrate : null,
    durationSec,
    comment,
  };

  report("done", 100);
  return { blob, stats };
}
