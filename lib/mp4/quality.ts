/**
 * Quality report: honest, read-only analysis of the input file.
 *
 * Everything is derived from the `moov` tables that inspection already
 * loaded: no pixels are decoded and no numbers are guessed. Findings are
 * phrased for the UI (see `lib/i18n` keys `report.*`) and never promise
 * what the tool cannot do.
 */

import {
  type BoxRef,
  findBox,
  findBoxPath,
  findTrackByHandler,
  fullBoxVersion,
  iterBoxes,
  parseStss,
  parseStsz,
  parseStts,
  readU32,
  readU64,
} from "./boxes";
import type { MediaContext, MediaInfo } from "./inspect";

export type FindingSeverity = "good" | "info" | "warn";

export interface QualityFinding {
  id:
    | "ok"
    | "vfr"
    | "metadata"
    | "bitrate-high"
    | "bitrate-low"
    | "resolution"
    | "bitdepth"
    | "audio-low"
    | "gop";
  severity: FindingSeverity;
  /** Pre-formatted value appended to the sentence (e.g. "14.2 Mbps"). */
  value?: string;
}

export interface QualityReport {
  videoBitrateBps: number | null;
  audioBitrateBps: number | null;
  /** True when the frame timing has more than one distinct sample delta. */
  isVfr: boolean;
  /** Number of distinct stts deltas (1 = constant frame timing). */
  distinctDeltas: number;
  /** Frames between sync samples (1 when every frame is a keyframe). */
  gopFrames: number | null;
  keyframes: number;
  /** 8, 10, ... (null when the codec does not expose it). */
  bitDepth: number | null;
  /** Creation date baked into the movie header. */
  hasCreationTime: boolean;
  /** Extra `udta` metadata (tags, location, device info ...) in the source. */
  hasExtraMetadata: boolean;
  findings: QualityFinding[];
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

function stblOf(moov: Uint8Array, moovLocal: BoxRef, handler: string): BoxRef | null {
  const track = findTrackByHandler(moov, moovLocal, handler);
  if (!track) return null;
  return findBoxPath(moov, ["mdia", "minf", "stbl"], track.start, track.end);
}

function sumSampleBytes(moov: Uint8Array, stbl: BoxRef): number {
  const stsz = findBox(moov, "stsz", stbl.start, stbl.end);
  if (!stsz) return 0;
  return parseStsz(moov, stsz).reduce((a, b) => a + b, 0);
}

/** Max bit depth (8/10/12) an `avcC` payload advertises, if derivable. */
function avcBitDepth(moov: Uint8Array, stbl: BoxRef): number | null {
  const stsd = findBox(moov, "stsd", stbl.start, stbl.end);
  if (!stsd) return null;
  for (const entry of iterBoxes(moov, stsd.start + stsd.headerSize + 8, stsd.end)) {
    if (entry.type !== "avc1" && entry.type !== "avc3") continue;
    const avcC = findBox(moov, "avcC", entry.start + entry.headerSize + 78, entry.end);
    if (!avcC) return null;
    const c = avcC.start + avcC.headerSize;
    if (avcC.end - c < 4) return null;
    const profile = moov[c + 1];
    const extended = new Set([100, 110, 122, 244, 44, 83, 86, 118, 128, 138, 139, 134, 135]);
    if (!extended.has(profile)) return 8;
    if (avcC.end - c < 7) return 8;
    return 8 + (moov[c + 6] & 0x07);
  }
  return null;
}

function creationTimePresent(moov: Uint8Array, moovLocal: BoxRef): boolean {
  const mvhd = findBox(moov, "mvhd", moovLocal.start, moovLocal.end);
  if (!mvhd) return false;
  const c = mvhd.start + mvhd.headerSize;
  if (fullBoxVersion(moov, mvhd) === 1) {
    return readU64(moov, c + 4) !== 0;
  }
  return readU32(moov, c + 4) !== 0;
}

function formatMbps(bps: number): string {
  return `${(bps / 1_000_000).toFixed(1)} Mbps`;
}

function formatKbps(bps: number): string {
  return `${Math.round(bps / 1000)} kbps`;
}

/**
 * Builds the quality report for an inspected file. Purely descriptive:
 * severity only reflects well-understood upload behaviour, not a fake score.
 */
export function buildQualityReport(context: MediaContext, info: MediaInfo): QualityReport {
  const moov = context.moovBytes;
  const moovLocal = moovLocalOf(context);
  const videoStbl = stblOf(moov, moovLocal, "vide");
  const audioStbl = stblOf(moov, moovLocal, "soun");

  const duration = info.durationSec;

  // --- frame timing -------------------------------------------------------
  let isVfr = false;
  let distinctDeltas = 1;
  if (videoStbl) {
    const sttsRef = findBox(moov, "stts", videoStbl.start, videoStbl.end);
    if (sttsRef) {
      const deltas = new Set(parseStts(moov, sttsRef).map((e) => e.delta));
      distinctDeltas = deltas.size;
      isVfr = deltas.size > 1;
    }
  }

  // --- keyframes / GOP ----------------------------------------------------
  let keyframes = 0;
  let gopFrames: number | null = null;
  if (videoStbl) {
    const stssRef = findBox(moov, "stss", videoStbl.start, videoStbl.end);
    const frames = info.video.frames;
    if (stssRef) {
      const syncs = parseStss(moov, stssRef);
      keyframes = syncs.length;
      let maxGap = syncs.length > 0 ? syncs[0] : 1;
      for (let i = 1; i < syncs.length; i++) maxGap = Math.max(maxGap, syncs[i] - syncs[i - 1]);
      if (syncs.length > 0) maxGap = Math.max(maxGap, frames - syncs[syncs.length - 1]);
      gopFrames = Math.max(1, maxGap);
    } else if (frames > 0) {
      // No stss box means every sample is a sync sample.
      keyframes = frames;
      gopFrames = 1;
    }
  }

  // --- bitrates -----------------------------------------------------------
  let videoBitrateBps: number | null = null;
  if (videoStbl && duration > 0) {
    const bytes = sumSampleBytes(moov, videoStbl);
    if (bytes > 0) videoBitrateBps = Math.floor((bytes * 8) / duration);
  }
  let audioBitrateBps: number | null = null;
  if (audioStbl && duration > 0) {
    const bytes = sumSampleBytes(moov, audioStbl);
    if (bytes > 0) audioBitrateBps = Math.floor((bytes * 8) / duration);
  }

  // --- color depth --------------------------------------------------------
  const bitDepth = videoStbl ? avcBitDepth(moov, videoStbl) : null;

  // --- privacy signals ----------------------------------------------------
  const hasCreationTime = creationTimePresent(moov, moovLocal);
  const hasExtraMetadata = findBox(moov, "udta", moovLocal.start, moovLocal.end) !== null;

  // --- findings -----------------------------------------------------------
  const findings: QualityFinding[] = [];
  if (isVfr) findings.push({ id: "vfr", severity: "warn" });
  if (hasCreationTime || hasExtraMetadata) {
    findings.push({ id: "metadata", severity: "info" });
  }
  if (videoBitrateBps !== null) {
    if (videoBitrateBps > 16_000_000) {
      findings.push({
        id: "bitrate-high",
        severity: "info",
        value: formatMbps(videoBitrateBps),
      });
    } else if (videoBitrateBps < 2_500_000 && Math.min(info.video.width, info.video.height) >= 1080) {
      findings.push({
        id: "bitrate-low",
        severity: "warn",
        value: formatMbps(videoBitrateBps),
      });
    }
  }
  if (Math.min(info.video.width, info.video.height) > 1080) {
    findings.push({ id: "resolution", severity: "info" });
  }
  if (bitDepth !== null && bitDepth > 8) {
    findings.push({ id: "bitdepth", severity: "info", value: `${bitDepth}-bit` });
  }
  if (audioBitrateBps !== null && audioBitrateBps < 96_000) {
    findings.push({ id: "audio-low", severity: "info", value: formatKbps(audioBitrateBps) });
  }
  if (gopFrames !== null && info.video.fps > 0 && gopFrames > info.video.fps * 5) {
    findings.push({ id: "gop", severity: "info", value: String(gopFrames) });
  }
  if (findings.length === 0) findings.push({ id: "ok", severity: "good" });

  return {
    videoBitrateBps,
    audioBitrateBps,
    isVfr,
    distinctDeltas,
    gopFrames,
    keyframes,
    bitDepth,
    hasCreationTime,
    hasExtraMetadata,
    findings,
  };
}
