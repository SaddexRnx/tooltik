/**
 * Multi-method comparison runner (spec 6): every eligible engine runs
 * INDEPENDENTLY from the same original file (outputs are never chained),
 * each producing its own three-gate + audio validation report. A failure
 * or exception in one method never affects another; unsupported methods
 * are reported with their eligibility reason and skipped.
 *
 * Progress is reported per method and per measurable stage only (gate
 * stages come from the validator itself; no invented sub-progress).
 * Cancellation is checked between stages and between methods: the run
 * stops at the next safe point (a decode already in flight completes).
 */

import { asPatchError } from "@/lib/mp4/boxes";
import type { MediaInfo } from "@/lib/mp4/inspect";
import type { PatchStats } from "@/lib/mp4/transform";
import { ENGINES, type PatchEngine, getEngine } from "@/lib/engines/registry";
import {
  type EngineEligibility,
  computeEligibility,
} from "@/lib/methods/eligibility";
import { webCodecsAvailable } from "@/lib/validate/decode";
import { type GateId, type ValidationReport, runValidation } from "@/lib/validate/gates";

export type MethodRunStage = "queued" | "patching" | GateId | "done";

export type MethodRunStatus = "passed" | "failed" | "unsupported" | "skipped";

export interface MethodRunResult {
  engineId: string;
  engineName: string;
  status: MethodRunStatus;
  /** Eligibility or cancellation reason (unsupported/skipped methods). */
  reason: string | null;
  /** Failure detail (PatchError code or message) when a stage threw. */
  error: string | null;
  patchMs: number;
  validation: ValidationReport | null;
  /** Output blob for "use this result" (null when no output was produced). */
  output: Blob | null;
  stats: PatchStats | null;
  /** The engine (or its flatten option) declared a decoded-timing change. */
  timingChanged: boolean;
}

export interface MethodRunnerOptions {
  /** From computeEligibility for this file; missing entries are computed. */
  eligibility?: EngineEligibility[];
  info: MediaInfo;
  /** Run Gate 3 (WebCodecs) during each validation. */
  runDecode?: boolean;
  scrubMetadata?: boolean;
  flattenFrameTiming?: boolean;
  onProgress?: (update: { engineId: string; stage: MethodRunStage }) => void;
  /** Checked between stages/methods; true stops the remaining work. */
  shouldCancel?: () => boolean;
}

function skipped(
  engine: PatchEngine,
  reason: string,
  extra: Partial<MethodRunResult> = {},
): MethodRunResult {
  return {
    engineId: engine.id,
    engineName: engine.name,
    status: "skipped",
    reason,
    error: null,
    patchMs: 0,
    validation: null,
    output: null,
    stats: null,
    timingChanged: false,
    ...extra,
  };
}

export async function runAllMethods(
  original: File,
  opts: MethodRunnerOptions,
): Promise<MethodRunResult[]> {
  const eligibility = opts.eligibility ?? computeEligibility(original, opts.info);
  const results: MethodRunResult[] = [];

  // Registry order for the listed engines; every eligibility entry gets a
  // row even when it is not in the registry order (table completeness).
  const ordered = ENGINES.map((e) => e.id).filter((id) =>
    eligibility.some((entry) => entry.engineId === id),
  );
  for (const entry of eligibility) {
    if (!ordered.includes(entry.engineId)) ordered.push(entry.engineId);
  }

  for (const engineId of ordered) {
    const entry = eligibility.find((e) => e.engineId === engineId);
    const engine = getEngine(engineId);
    if (entry?.status === "unsupported") {
      results.push({
        engineId,
        engineName: engine.name,
        status: "unsupported",
        reason: entry.reason,
        error: null,
        patchMs: 0,
        validation: null,
        output: null,
        stats: null,
        timingChanged: false,
      });
      continue;
    }
    if (opts.shouldCancel?.()) {
      results.push(skipped(engine, "cancelled"));
      continue;
    }
    results.push(await runOne(original, engine, opts));
  }

  return results;
}

async function runOne(
  original: File,
  engine: PatchEngine,
  opts: MethodRunnerOptions,
): Promise<MethodRunResult> {
  const progress = (stage: MethodRunStage) =>
    opts.onProgress?.({ engineId: engine.id, stage });
  progress("patching");
  const timingChanged = engine.timingMayChange({
    flattenFrameTiming: opts.flattenFrameTiming,
  });
  const t0 = performance.now();
  let output: Blob;
  let stats: PatchStats;
  try {
    const out = await engine.process(original, {
      scrubMetadata: opts.scrubMetadata,
      flattenFrameTiming: opts.flattenFrameTiming,
    });
    output = out.blob;
    stats = out.stats;
  } catch (err) {
    return {
      engineId: engine.id,
      engineName: engine.name,
      status: "failed",
      reason: null,
      error: asPatchError(err).code,
      patchMs: Math.round(performance.now() - t0),
      validation: null,
      output: null,
      stats: null,
      timingChanged,
    };
  }
  const patchMs = Math.round(performance.now() - t0);

  if (opts.shouldCancel?.()) {
    return skipped(engine, "cancelled", { patchMs, stats });
  }

  let validation: ValidationReport;
  try {
    const outFile = new File([output], `method-${engine.id}.mp4`, {
      type: "video/mp4",
    });
    validation = await runValidation(original, outFile, {
      runDecode: opts.runDecode !== false && webCodecsAvailable(),
      timingMayChange: timingChanged,
      onStage: (stage) => {
        if (stage !== "done") progress(stage);
      },
    });
  } catch (err) {
    return {
      engineId: engine.id,
      engineName: engine.name,
      status: "failed",
      reason: null,
      error: asPatchError(err).code,
      patchMs,
      validation: null,
      output: null,
      stats: null,
      timingChanged,
    };
  }

  progress("done");
  return {
    engineId: engine.id,
    engineName: engine.name,
    status: validation.pass ? "passed" : "failed",
    reason: null,
    error: null,
    patchMs,
    validation,
    output,
    stats,
    timingChanged,
  };
}
