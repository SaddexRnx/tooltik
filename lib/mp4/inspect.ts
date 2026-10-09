/**
 * Media inspection: reads only what is needed to describe a file.
 *
 * Instead of loading a potentially huge video into memory, we walk the
 * top-level box headers (16-byte reads) and load only the `moov` metadata
 * box (typically < 1 MB). The patching step later streams the media data
 * straight from the original `File` via `Blob` slices — the pixels are
 * never copied into JavaScript memory.
 */

import {
  type BoxRef,
  PatchError,
  findBox,
  findBoxPath,
  findTrackByHandler,
  fullBoxVersion,
  iterBoxes,
  parseStts,
  parseStsz,
  readStszCount,
  readFourCC,
  readU16,
  readU32,
  readU64,
} from "./boxes";
import { parseChunkOffsets } from "./boxes";

export interface VideoTrackInfo {
  /** Sample-entry fourcc: avc1, hvc1, av01, ... */
  codecId: string;
  /** Human-readable codec, e.g. "H.264 High L4.1". */
  codecLabel: string;
  width: number;
  height: number;
  /** Average frames per second (rounded for display). */
  fps: number;
  frames: number;
  timescale: number;
  /** Media duration in mdhd-timescale ticks. */
  durationTicks: number;
  /** True when the video track already carries an edit list (`edts`/`elst`). */
  hasEditList: boolean;
  /**
   * Display rotation from the tkhd matrix, degrees clockwise (0/90/180/270
   * for normal files; other values mean a non-standard matrix).
   */
  rotationDeg: number;
}

export interface AudioTrackInfo {
  codecId: string;
  codecLabel: string;
  sampleRate: number;
  channels: number;
}

export interface MediaInfo {
  fileName: string;
  fileSize: number;
  lastModified: number;
  /** True when the file is QuickTime (.mov) rather than MP4. */
  isQuickTime: boolean;
  /** Original `ftyp` major brand, e.g. "isom", "mp42", "qt  ". */
  ftypBrand: string;
  /** True when `moov` precedes `mdat` (fast-start). */
  fastStart: boolean;
  /** True when our/Enhancer signature comment is already present. */
  alreadyPatched: boolean;
  /** True when the patching pipeline supports this codec (H.264/AVC). */
  supported: boolean;
  durationSec: number;
  video: VideoTrackInfo;
  audio: AudioTrackInfo | null;
}

/** Everything the patcher needs, loaded once during inspection. */
export interface MediaContext {
  file: File;
  /** Top-level boxes with absolute file offsets. */
  topLevel: { ftyp: BoxRef; moov: BoxRef; mdat: BoxRef };
  /** The `moov` box bytes (header included), offsets relative to itself. */
  moovBytes: Uint8Array;
  /** Trimmed `ftyp` major brand of the input file. */
  ftypBrand: string;
}

/** Signature comment written by the TikTok Enhancer server / reference tool. */
export const PATCH_SIGNATURE = "TK8vY5VqBA6hUlo1yuGvNA";

async function readSlice(file: File, start: number, end: number): Promise<Uint8Array> {
  return new Uint8Array(await file.slice(start, end).arrayBuffer());
}

/** Walks top-level box headers with minimal reads (16 bytes per box). */
export async function scanTopLevel(file: File, guardLimit = 4096): Promise<BoxRef[]> {
  const boxes: BoxRef[] = [];
  let pos = 0;
  let guard = 0;
  while (pos + 8 <= file.size && guard++ < guardLimit) {
    const head = await readSlice(file, pos, Math.min(pos + 16, file.size));
    if (head.length < 8) break;
    // Downloads may carry an ID3v2 audio tag before the first box.
    if (
      boxes.length === 0 &&
      head.length >= 10 &&
      head[0] === 0x49 && head[1] === 0x44 && head[2] === 0x33 && // "ID3"
      head[3] < 0xff &&
      (head[6] & 0x80) === 0 && (head[7] & 0x80) === 0 &&
      (head[8] & 0x80) === 0 && (head[9] & 0x80) === 0
    ) {
      const tagSize =
        ((head[6] & 0x7f) << 21) |
        ((head[7] & 0x7f) << 14) |
        ((head[8] & 0x7f) << 7) |
        (head[9] & 0x7f);
      const skip = 10 + tagSize + (head[5] & 0x10 ? 10 : 0); // + footer when present
      if (skip >= 10 && pos + skip < file.size) {
        pos += skip;
        continue;
      }
    }
    let size = readU32(head, 0);
    const type = readFourCC(head, 4);
    let headerSize = 8;
    if (size === 1) {
      if (head.length < 16) break;
      size = readU64(head, 8);
      headerSize = 16;
    } else if (size === 0) {
      size = file.size - pos;
    }
    if (size < headerSize || pos + size > file.size) {
      throw new PatchError("corrupt");
    }
    boxes.push({ type, start: pos, size, headerSize, end: pos + size });
    pos += size;
  }
  return boxes;
}

/** True when `needle` (ASCII) appears in `haystack`. */
export function includesAscii(haystack: Uint8Array, needle: string): boolean {
  if (needle.length === 0 || haystack.length < needle.length) return false;
  const first = needle.charCodeAt(0);
  outer: for (let i = 0; i <= haystack.length - needle.length; i++) {
    if (haystack[i] !== first) continue;
    for (let j = 1; j < needle.length; j++) {
      if (haystack[i + j] !== needle.charCodeAt(j)) continue outer;
    }
    return true;
  }
  return false;
}

const AVC_PROFILES: Record<number, string> = {
  66: "Baseline",
  77: "Main",
  88: "Extended",
  100: "High",
  110: "High 10",
  122: "High 4:2:2",
  244: "High 4:4:4",
};

function avcCodecLabel(avcCContent: Uint8Array): string {
  if (avcCContent.length < 4) return "H.264";
  const profileIdc = avcCContent[1];
  const levelIdc = avcCContent[3];
  const profile = AVC_PROFILES[profileIdc] ?? `Profile ${profileIdc}`;
  const major = Math.floor(levelIdc / 10);
  const minor = levelIdc % 10;
  return `H.264 ${profile} L${major}.${minor}`;
}

function levelCodecLabel(codecId: string): string {
  switch (codecId) {
    case "hvc1":
    case "hev1":
      return "H.265 (HEVC)";
    case "av01":
      return "AV1";
    case "vp09":
      return "VP9";
    case "mp4v":
      return "MPEG-4 Visual";
    default:
      return codecId;
  }
}

function audioCodecLabel(codecId: string): string {
  switch (codecId) {
    case "mp4a":
      return "AAC";
    case "opus":
      return "Opus";
    case "ac-3":
      return "AC-3";
    case "ec-3":
      return "E-AC-3";
    case "alac":
      return "ALAC";
    case ".mp3":
      return "MP3";
    default:
      return codecId;
  }
}

interface SampleEntryInfo {
  fourcc: string;
  width: number;
  height: number;
  /** Child boxes after the fixed fields (avcC, colr, pasp, btrt, ...). */
  children: BoxRef[];
  avcC: BoxRef | null;
  // audio fields
  channels: number;
  sampleRate: number;
}

function parseStsd(
  moov: Uint8Array,
  stbl: BoxRef,
  kind: "video" | "audio",
): { stsd: BoxRef; entries: SampleEntryInfo[] } {
  const stsd = findBox(moov, "stsd", stbl.start, stbl.end);
  if (!stsd) throw new PatchError("unsupported-boxes");
  const entries: SampleEntryInfo[] = [];
  const contentStart = stsd.start + stsd.headerSize + 8; // version/flags + entry_count
  for (const entry of iterBoxes(moov, contentStart, stsd.end)) {
    const fixedStart = entry.start + entry.headerSize;
    const info: SampleEntryInfo = {
      fourcc: entry.type,
      width: 0,
      height: 0,
      children: [],
      avcC: null,
      channels: 0,
      sampleRate: 0,
    };
    if (kind === "video") {
      // VisualSampleEntry: width at fixed+24, height at fixed+26, 78 fixed bytes.
      info.width = readU16(moov, fixedStart + 24);
      info.height = readU16(moov, fixedStart + 26);
      info.children = [...iterBoxes(moov, fixedStart + 78, entry.end)];
    } else {
      // AudioSampleEntry: channels at fixed+16, samplerate (16.16) at fixed+24,
      // 28 fixed bytes.
      info.channels = readU16(moov, fixedStart + 16);
      info.sampleRate = readU32(moov, fixedStart + 24) >>> 16;
      info.children = [...iterBoxes(moov, fixedStart + 28, entry.end)];
    }
    info.avcC = info.children.find((c) => c.type === "avcC") ?? null;
    entries.push(info);
  }
  return { stsd, entries };
}

function readMdhdTiming(moov: Uint8Array, track: BoxRef): {
  timescale: number;
  duration: number;
} {
  const mdhd = findBoxPath(moov, ["mdia", "mdhd"], track.start, track.end);
  if (!mdhd) throw new PatchError("unsupported-boxes");
  const content = mdhd.start + mdhd.headerSize;
  const v1 = fullBoxVersion(moov, mdhd) === 1;
  const timescale = readU32(moov, content + (v1 ? 20 : 12));
  const duration = v1 ? readU64(moov, content + 24) : readU32(moov, content + 16);
  return { timescale, duration };
}

/** Computes average FPS from the sample table and media timescale. */
function computeFps(moov: Uint8Array, stbl: BoxRef, timescale: number): {
  fps: number;
  frames: number;
} {
  const sttsRef = findBox(moov, "stts", stbl.start, stbl.end);
  const stszRef = findBox(moov, "stsz", stbl.start, stbl.end);
  if (!sttsRef || !stszRef) throw new PatchError("unsupported-boxes");
  const entries = parseStts(moov, sttsRef);
  let frames = 0;
  let totalDelta = 0;
  for (const e of entries) {
    frames += e.count;
    totalDelta += e.count * e.delta;
  }
  if (frames === 0) frames = parseStsz(moov, stszRef).length;
  const fps =
    frames > 0 && totalDelta > 0 && timescale > 0
      ? (frames * timescale) / totalDelta
      : 0;
  return { fps, frames };
}

/**
 * Inspects a user-selected file: locates `moov`, loads it and derives all
 * display information (resolution, FPS, duration, codecs, ...).
 *
 * Throws {@link PatchError} with a stable code when the file is not a
 * processable MP4/MOV.
 */
export async function inspectMedia(file: File): Promise<{
  info: MediaInfo;
  context: MediaContext;
}> {
  const topLevelBoxes = await scanTopLevel(file);
  const ftyp = topLevelBoxes.find((b) => b.type === "ftyp");
  const moov = topLevelBoxes.find((b) => b.type === "moov");
  const mdat = topLevelBoxes.find((b) => b.type === "mdat");
  if (!moov) throw new PatchError("no-moov");
  if (!mdat) throw new PatchError("no-mdat");
  if (!ftyp) throw new PatchError("no-moov");

  // Streamed/segmented recordings (moof/sidx/styp/mfra) carry their samples
  // outside the moov sample tables and cannot be patched.
  const hasFragmentBoxes = topLevelBoxes.some(
    (b) =>
      b.type === "moof" || b.type === "sidx" || b.type === "styp" || b.type === "mfra",
  );

  const moovBytes = await readSlice(file, moov.start, moov.end);
  const moovLocal: BoxRef = {
    type: "moov",
    start: 0,
    size: moovBytes.length,
    headerSize: moov.headerSize,
    end: moovBytes.length,
  };

  const ftypBytes = await readSlice(
    file,
    ftyp.start,
    Math.min(ftyp.end, ftyp.start + 128),
  );
  const ftypBrand = readFourCC(ftypBytes, ftyp.headerSize);
  const isQuickTime = ftypBrand === "qt  ";

  // --- video track -------------------------------------------------------
  const videoTrack = findTrackByHandler(moovBytes, moovLocal, "vide");
  if (!videoTrack) throw new PatchError("no-video");
  const videoStbl = findBoxPath(
    moovBytes,
    ["mdia", "minf", "stbl"],
    videoTrack.start,
    videoTrack.end,
  );
  if (!videoStbl) {
    throw new PatchError(hasFragmentBoxes ? "fragmented" : "unsupported-boxes");
  }

  const vStsd = findBox(moovBytes, "stsd", videoStbl.start, videoStbl.end);
  const vStts = findBox(moovBytes, "stts", videoStbl.start, videoStbl.end);
  const vStsz = findBox(moovBytes, "stsz", videoStbl.start, videoStbl.end);
  const vStsc = findBox(moovBytes, "stsc", videoStbl.start, videoStbl.end);
  const vStco =
    findBox(moovBytes, "stco", videoStbl.start, videoStbl.end) ??
    findBox(moovBytes, "co64", videoStbl.start, videoStbl.end);
  if (!vStsd || !vStts || !vStsz || !vStsc || !vStco) {
    throw new PatchError(hasFragmentBoxes ? "fragmented" : "unsupported-boxes");
  }
  if (
    parseChunkOffsets(moovBytes, videoStbl).length === 0 ||
    parseStsz(moovBytes, vStsz).length === 0
  ) {
    throw new PatchError(hasFragmentBoxes ? "fragmented" : "unsupported-boxes");
  }

  const { entries: videoEntries } = parseStsd(moovBytes, videoStbl, "video");
  const vEntry =
    videoEntries.find((e) => e.fourcc === "avc1" || e.fourcc === "avc3") ??
    videoEntries[0];
  if (!vEntry) {
    throw new PatchError(hasFragmentBoxes ? "fragmented" : "unsupported-boxes");
  }

  const { timescale: vTimescale, duration: vDuration } = readMdhdTiming(
    moovBytes,
    videoTrack,
  );
  const { fps, frames } = computeFps(moovBytes, videoStbl, vTimescale);
  const frameCount = readStszCount(moovBytes, vStsz);

  const isAvc =
    (vEntry.fourcc === "avc1" || vEntry.fourcc === "avc3") &&
    vEntry.avcC !== null;
  let codecLabel: string;
  if (isAvc && vEntry.avcC) {
    const avcC = vEntry.avcC;
    const content = moovBytes.subarray(
      avcC.start + avcC.headerSize,
      avcC.end,
    );
    codecLabel = avcCodecLabel(content);
  } else {
    codecLabel = levelCodecLabel(vEntry.fourcc);
  }

  // Display rotation: tkhd transform matrix (9 × 16.16 fixed point).
  // Matrix starts at box offset 48 (v0) / 60 (v1); entries [0]=a, [1]=b.
  let rotationDeg = 0;
  const vTkhd = findBox(moovBytes, "tkhd", videoTrack.start, videoTrack.end);
  if (vTkhd) {
    const matrixAt = vTkhd.start + (fullBoxVersion(moovBytes, vTkhd) === 1 ? 60 : 48);
    if (matrixAt + 8 <= vTkhd.end) {
      const rawA = readU32(moovBytes, matrixAt);
      const rawB = readU32(moovBytes, matrixAt + 4);
      const a = (rawA > 0x7fff_ffff ? rawA - 0x1_0000_0000 : rawA) / 65536;
      const b = (rawB > 0x7fff_ffff ? rawB - 0x1_0000_0000 : rawB) / 65536;
      let deg = (Math.atan2(b, a) * 180) / Math.PI;
      if (deg < 0) deg += 360;
      rotationDeg = Math.round(deg * 10) / 10;
    }
  }

  const video: VideoTrackInfo = {
    codecId: vEntry.fourcc,
    codecLabel,
    width: vEntry.width,
    height: vEntry.height,
    fps: Math.round(fps * 100) / 100,
    frames: frameCount || frames,
    timescale: vTimescale,
    durationTicks: vDuration,
    hasEditList:
      findBox(moovBytes, "edts", videoTrack.start, videoTrack.end) !== null,
    rotationDeg,
  };

  // --- audio track (optional) -------------------------------------------
  let audio: AudioTrackInfo | null = null;
  const audioTrack = findTrackByHandler(moovBytes, moovLocal, "soun");
  if (audioTrack) {
    const audioStbl = findBoxPath(
      moovBytes,
      ["mdia", "minf", "stbl"],
      audioTrack.start,
      audioTrack.end,
    );
    if (audioStbl) {
      try {
        const { entries } = parseStsd(moovBytes, audioStbl, "audio");
        const aEntry = entries[0];
        if (aEntry) {
          audio = {
            codecId: aEntry.fourcc,
            codecLabel: audioCodecLabel(aEntry.fourcc),
            sampleRate: aEntry.sampleRate,
            channels: aEntry.channels,
          };
        }
      } catch {
        audio = null;
      }
    }
  }

  // --- duration ----------------------------------------------------------
  let durationSec = 0;
  if (vTimescale > 0 && vDuration > 0) {
    durationSec = vDuration / vTimescale;
  } else {
    const mvhd = findBox(moovBytes, "mvhd", moovLocal.start, moovLocal.end);
    if (mvhd) {
      const content = mvhd.start + mvhd.headerSize;
      const v1 = fullBoxVersion(moovBytes, mvhd) === 1;
      const mvTimescale = readU32(moovBytes, content + (v1 ? 20 : 12));
      const mvDuration = v1
        ? readU64(moovBytes, content + 24)
        : readU32(moovBytes, content + 16);
      if (mvTimescale > 0) durationSec = mvDuration / mvTimescale;
    }
  }

  const info: MediaInfo = {
    fileName: file.name,
    fileSize: file.size,
    lastModified: file.lastModified,
    isQuickTime,
    ftypBrand: ftypBrand.trim(),
    fastStart: moov.start < mdat.start,
    alreadyPatched: includesAscii(moovBytes, PATCH_SIGNATURE),
    supported: isAvc,
    durationSec,
    video,
    audio,
  };

  return {
    info,
    context: {
      file,
      topLevel: { ftyp, moov, mdat },
      moovBytes,
      ftypBrand: ftypBrand.trim(),
    },
  };
}

/** Exposed for the transform step: video stbl ref inside `moovBytes`. */
export function videoStblOf(context: MediaContext): BoxRef {
  const moovLocal: BoxRef = {
    type: "moov",
    start: 0,
    size: context.moovBytes.length,
    headerSize: context.topLevel.moov.headerSize,
    end: context.moovBytes.length,
  };
  const track = findTrackByHandler(context.moovBytes, moovLocal, "vide");
  if (!track) throw new PatchError("no-video");
  const stbl = findBoxPath(
    context.moovBytes,
    ["mdia", "minf", "stbl"],
    track.start,
    track.end,
  );
  if (!stbl) throw new PatchError("unsupported-boxes");
  return stbl;
}

/** Exposed for the transform step: audio track (or null). */
export function audioTrackOf(context: MediaContext): BoxRef | null {
  const moovLocal: BoxRef = {
    type: "moov",
    start: 0,
    size: context.moovBytes.length,
    headerSize: context.topLevel.moov.headerSize,
    end: context.moovBytes.length,
  };
  return findTrackByHandler(context.moovBytes, moovLocal, "soun");
}

/** Verifies chunk offsets addressable + tables present before patching. */
export function assertPatchable(context: MediaContext): void {
  const moov = context.moovBytes;
  const stbl = videoStblOf(context);
  const stsz = findBox(moov, "stsz", stbl.start, stbl.end);
  const stsc = findBox(moov, "stsc", stbl.start, stbl.end);
  const stts = findBox(moov, "stts", stbl.start, stbl.end);
  if (!stsz || !stsc || !stts) throw new PatchError("unsupported-boxes");
  const offsets = parseChunkOffsets(moov, stbl);
  if (offsets.length === 0) throw new PatchError("unsupported-boxes");
  const first = offsets[0];
  const sizes = parseStsz(moov, stsz);
  if (sizes.length === 0) throw new PatchError("unsupported-boxes");
  if (first + sizes[0] > context.file.size) throw new PatchError("corrupt");
}
