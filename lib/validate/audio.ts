/**
 * Audio-equivalence check (the fourth gate).
 *
 * Rule (explicit for the no-audio case): when the source has no audio
 * track, the gate passes with "nothing to preserve". When it does, the
 * output must keep the same track presence, codec, sample rate, channel
 * layout and sample count, and the payload gate must show every audio
 * sample byte-identical. Audio timing tables may be legitimately realigned
 * by the container rewrite (edit-list based trim, reported as
 * stats.audioAdjusted), so stts/mdhd equality is deliberately not required;
 * sample bytes, count, codec and layout are.
 */

import {
  findBox,
  findBoxPath,
  findTrackByHandler,
  readStszCount,
} from "@/lib/mp4/boxes";
import { type MediaContext, type MediaInfo, inspectMedia } from "@/lib/mp4/inspect";
import type { PayloadReport } from "@/lib/validate/payload";

export interface AudioCheck {
  id: string;
  label: string;
  pass: boolean;
  detail: string;
}

export interface AudioReport {
  /** True when the source has an audio track. */
  present: boolean;
  pass: boolean;
  /** One-line evidence string for the gate row. */
  line: string;
  checks: AudioCheck[];
}

function moovLocalOf(context: MediaContext) {
  return {
    type: "moov",
    start: 0,
    size: context.moovBytes.length,
    headerSize: context.topLevel.moov.headerSize,
    end: context.moovBytes.length,
  };
}

/** Audio sample count from stsz, or null when the track/table is missing. */
function audioSampleCount(context: MediaContext): number | null {
  const moov = context.moovBytes;
  const track = findTrackByHandler(moov, moovLocalOf(context), "soun");
  if (!track) return null;
  const stbl = findBoxPath(moov, ["mdia", "minf", "stbl"], track.start, track.end);
  if (!stbl) return null;
  const stsz = findBox(moov, "stsz", stbl.start, stbl.end);
  if (!stsz) return null;
  return readStszCount(moov, stsz);
}

export async function validateAudio(
  original: Blob,
  patched: Blob,
  payloadAudio: PayloadReport,
): Promise<AudioReport> {
  const [orig, out] = await Promise.all([
    inspectMedia(original as File),
    inspectMedia(patched as File),
  ]);
  const ia: MediaInfo["audio"] = orig.info.audio;
  const ib: MediaInfo["audio"] = out.info.audio;
  const checks: AudioCheck[] = [];

  const presentBoth = ia !== null && ib !== null;
  const absentBoth = ia === null && ib === null;

  checks.push({
    id: "presence",
    label: "Audio track presence",
    pass: presentBoth || absentBoth,
    detail:
      ia === null && ib === null
        ? "no audio track on either side"
        : ia === null
          ? "source has no audio track but output does"
          : ib === null
            ? "output lost the source audio track"
            : "audio track on both sides",
  });

  if (absentBoth) {
    return {
      present: false,
      pass: checks.every((c) => c.pass),
      line: "No audio track in source or output; nothing to preserve",
      checks,
    };
  }

  const counts = { orig: audioSampleCount(orig.context), out: audioSampleCount(out.context) };

  checks.push({
    id: "codec",
    label: "Audio codec",
    pass: ia !== null && ib !== null && ia.codecId === ib.codecId && ia.codecLabel === ib.codecLabel,
    detail:
      ia === null || ib === null
        ? "track missing on one side"
        : `${ia.codecLabel} -> ${ib.codecLabel}`,
  });
  checks.push({
    id: "sample-rate",
    label: "Audio sample rate",
    pass: ia !== null && ib !== null && ia.sampleRate === ib.sampleRate,
    detail:
      ia === null || ib === null
        ? "track missing on one side"
        : `${ia.sampleRate} Hz -> ${ib.sampleRate} Hz`,
  });
  checks.push({
    id: "channels",
    label: "Audio channels",
    pass: ia !== null && ib !== null && ia.channels === ib.channels,
    detail:
      ia === null || ib === null
        ? "track missing on one side"
        : `${ia.channels} -> ${ib.channels}`,
  });
  checks.push({
    id: "sample-count",
    label: "Audio sample count",
    pass: counts.orig !== null && counts.orig === counts.out,
    detail:
      counts.orig === null || counts.out === null
        ? "audio sample table missing on one side"
        : `${counts.orig} -> ${counts.out}`,
  });
  checks.push({
    id: "payload",
    label: "Audio bytes preserved",
    pass: payloadAudio.pass,
    detail: payloadAudio.line,
  });

  const pass = checks.every((c) => c.pass);
  const first = ia ?? ib;
  const line = pass
    ? presentBoth && first
      ? `Audio preserved: ${first.codecLabel}, ${first.sampleRate} Hz, ${first.channels} ch, ${counts.out ?? 0} samples byte-identical`
      : "No audio track in source or output; nothing to preserve"
    : checks
        .filter((c) => !c.pass)
        .map((c) => `${c.label}: ${c.detail}`)
        .join(" | ");

  return { present: ia !== null, pass, line, checks };
}
