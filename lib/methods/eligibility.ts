/**
 * Per-file method eligibility (spec 6/7): evaluated once per inspected
 * file, BEFORE any run, from the engine's own `supports` contract. The
 * result is shown next to each method with an explicit reason code that
 * the UI translates; unsupported methods are skipped by the runner and
 * never fail the run (they are reported as "unsupported").
 */

import type { MediaInfo } from "@/lib/mp4/inspect";
import {
  ENGINES,
  type EngineSupport,
  type PatchEngine,
} from "@/lib/engines/registry";

export type EligibilityStatus = "supported" | "unsupported";

export interface EngineEligibility {
  engineId: string;
  status: EligibilityStatus;
  /** Reason code for "unsupported" (i18n: method.reason.<code>). */
  reason: string | null;
}

export function computeEligibility(
  file: File,
  info: MediaInfo,
  engines: PatchEngine[] = ENGINES,
): EngineEligibility[] {
  return engines.map((engine) => {
    let support: EngineSupport;
    try {
      support = engine.supports({ file, info });
    } catch {
      support = { supported: false, reason: "eligibility-error" };
    }
    return {
      engineId: engine.id,
      status: support.supported ? "supported" : "unsupported",
      reason: support.supported ? null : support.reason ?? "unsupported",
    };
  });
}

export function eligibilityFor(
  list: EngineEligibility[],
  engineId: string,
): EngineEligibility | null {
  return list.find((e) => e.engineId === engineId) ?? null;
}

export function isEligible(list: EngineEligibility[], engineId: string): boolean {
  return eligibilityFor(list, engineId)?.status === "supported";
}
