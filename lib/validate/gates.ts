/**
 * The three mandatory validation gates.
 *
 *   Gate 1 — structural: does the output parse, are its tables coherent,
 *            and does an independent parser agree?
 *   Gate 2 — payload: every original encoded sample (video AND audio)
 *            is byte-identical in the output.
 *   Gate 3 — decoded frames: WebCodecs output of both files matches.
 *
 * ANY gate failing keeps `pass:false` — the UI must never offer a download
 * in that state (no exceptions, no "download anyway"). Each gate records
 * its own duration so reports can show measured times.
 */

import type { MediaContext } from "@/lib/mp4/inspect";
import { inspectMedia } from "@/lib/mp4/inspect";
import { type AudioReport, validateAudio } from "@/lib/validate/audio";
import { comparePayload, type PayloadReport } from "@/lib/validate/payload";
import {
  type DecodeCompareReport,
  compareDecodedFrames,
  emptyContent,
} from "@/lib/validate/decode";
import {
  type StructureReport,
  validateStructure,
} from "@/lib/validate/structure";

export type GateId = "structural" | "payload" | "decoded" | "audio";

export interface GateResult {
  id: GateId;
  label: string;
  pass: boolean;
  /** One-line evidence string (counts, metrics, or failure reason). */
  detail: string;
  ms: number;
}

export interface ValidationReport {
  pass: boolean;
  gates: GateResult[];
  structure: StructureReport;
  payload: { video: PayloadReport; audio: PayloadReport | null };
  audio: AudioReport | null;
  decoded: DecodeCompareReport | null;
  totalMs: number;
}

export interface ValidationOptions {
  /**
   * Run Gate 3 with WebCodecs. Requires a browser with VideoDecoder.
   * When false, Gate 3 fails with "not run" (fail closed).
   */
  runDecode?: boolean;
  /** Pre-computed decode report (tests / re-validation). */
  decoded?: DecodeCompareReport | null;
  /**
   * The engine declares that timestamps may legitimately change (timing
   * methods, or ghost-frame with timing flattening). Only then may Gate 3
   * pair frames by sample order instead of by timestamp.
   */
  timingMayChange?: boolean;
  onStage?: (stage: GateId | "done") => void;
}

async function timed<T>(fn: () => Promise<T>): Promise<[T, number]> {
  const t0 = performance.now();
  const value = await fn();
  return [value, Math.round(performance.now() - t0)];
}

export async function runValidation(
  original: Blob,
  patched: Blob,
  opts: ValidationOptions = {},
): Promise<ValidationReport> {
  const t0 = performance.now();
  const gates: GateResult[] = [];

  // --- Gate 1: structural ------------------------------------------------
  opts.onStage?.("structural");
  const [structure, ms1] = await timed(() => validateStructure(patched));
  const failed1 = structure.checks.filter((c) => !c.pass);
  gates.push({
    id: "structural",
    label: "Structural validity",
    pass: structure.pass,
    detail: structure.pass
      ? `${structure.checks.length} checks passed` +
        (structure.crossCheck.available
          ? "; independent parser (MP4Box) agrees"
          : `; independent parse not run (${structure.crossCheck.note})`)
      : failed1.map((c) => `${c.label}: ${c.detail}`).join(" | "),
    ms: ms1,
  });

  // --- Gate 2: payload preservation --------------------------------------
  opts.onStage?.("payload");
  const [payloadPair, ms2] = await timed(async () => {
    const video = await comparePayload(original, patched, "vide");
    const audio = await comparePayload(original, patched, "soun");
    return { video, audio };
  });
  const payloadPass = payloadPair.video.pass && payloadPair.audio.pass;
  gates.push({
    id: "payload",
    label: "Media payload preserved",
    pass: payloadPass,
    detail: payloadPass
      ? `${payloadPair.video.line}` +
        (payloadPair.audio.absent
          ? "; no audio track"
          : `; audio: ${payloadPair.audio.line}`)
      : [!payloadPair.video.pass && payloadPair.video.line,
         !payloadPair.audio.pass && payloadPair.audio.line]
          .filter(Boolean)
          .join(" | "),
    ms: ms2,
  });

  // --- Audio equivalence (gate 4, computed with the payload evidence) -----
  opts.onStage?.("audio");
  const [audioReport, msAudio] = await timed(() =>
    validateAudio(original, patched, payloadPair.audio),
  );

  // --- Gate 3: decoded-frame equivalence ---------------------------------
  let decoded: DecodeCompareReport | null = opts.decoded ?? null;
  let ms3 = 0;
  if (!decoded && opts.runDecode !== false) {
    opts.onStage?.("decoded");
    const t = performance.now();
    try {
      const originalCtx: MediaContext = (await inspectMedia(original as File)).context;
      const patchedCtx: MediaContext = (await inspectMedia(patched as File)).context;
      decoded = await compareDecodedFrames(
        original,
        originalCtx,
        patched,
        patchedCtx,
        undefined,
        { timingMayChange: opts.timingMayChange === true },
      );
    } catch (err) {
      decoded = {
        available: false,
        mode: "full",
        orig: {
          available: false, mode: "full", expectedFrames: 0, decodedFrames: 0,
          errors: 0, errorDetail: String(err), firstPtsUs: null, lastPtsUs: null,
          deltaMinUs: null, deltaMaxUs: null, deltaDistinct: 0,
          width: 0, height: 0, format: "", content: emptyContent(),
        },
        patched: {
          available: false, mode: "full", expectedFrames: 0, decodedFrames: 0,
          errors: 0, errorDetail: String(err), firstPtsUs: null, lastPtsUs: null,
          deltaMinUs: null, deltaMaxUs: null, deltaDistinct: 0,
          width: 0, height: 0, format: "", content: emptyContent(),
        },
        totalOriginalFrames: 0, selectedFrames: 0, comparedFrames: 0,
        exactMatches: 0, differentFrames: 0, unmatchedPairs: 0,
        syntheticOutputs: 0, minPsnr: null, avgPsnr: null,
        minSsim: null, avgSsim: null,
        pass: false,
        line: `Decoded-frame check could not run: ${String(err)}`,
        notes: [String(err)],
      };
    }
    ms3 = Math.round(performance.now() - t);
  } else if (decoded && opts.decoded) {
    ms3 = 0; // externally supplied; no measured time
  }

  const decodedPass = Boolean(decoded && decoded.pass);
  gates.push({
    id: "decoded",
    label: "Decoded frames verified",
    pass: decodedPass,
    detail: decoded
      ? decoded.line
      : "decoded-frame check was not run (fail closed)",
    ms: ms3,
  });

  gates.push({
    id: "audio",
    label: "Audio preserved",
    pass: audioReport.pass,
    detail: audioReport.line,
    ms: msAudio,
  });

  opts.onStage?.("done");
  return {
    pass: gates.every((g) => g.pass),
    gates,
    structure,
    payload: payloadPair,
    audio: audioReport,
    decoded,
    totalMs: Math.round(performance.now() - t0),
  };
}
