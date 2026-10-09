"use client";

/**
 * Multi-method comparison table (spec 16): one row per method, live
 * per-method stage while running, gate-by-gate pass/fail cells once each
 * independent validation finishes, and a "use this result" action that
 * promotes a row to the main result (subject to the same download gate).
 */

import * as React from "react";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  CircleDashed,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { getEngine } from "@/lib/engines/registry";
import type {
  MethodRunResult,
  MethodRunStage,
} from "@/lib/methods/runner";
import type { EngineEligibility } from "@/lib/methods/eligibility";
import type { GateId, ValidationReport } from "@/lib/validate/gates";
import { useI18n, type TranslationKey } from "@/lib/i18n";
import { useDevMode } from "@/lib/dev-mode";

const STAGE_KEYS: Record<MethodRunStage, TranslationKey> = {
  queued: "compare.stage.queued",
  patching: "compare.stage.patching",
  structural: "compare.stage.structural",
  payload: "compare.stage.payload",
  decoded: "compare.stage.decoded",
  audio: "compare.stage.audio",
  done: "compare.stage.done",
};

const STATUS_KEYS: Record<MethodRunResult["status"], TranslationKey> = {
  passed: "compare.status.passed",
  failed: "compare.status.failed",
  unsupported: "compare.status.unsupported",
  skipped: "compare.status.skipped",
};

const GATE_COLUMNS: { id: GateId; key: TranslationKey }[] = [
  { id: "structural", key: "compare.col.structural" },
  { id: "payload", key: "compare.col.payload" },
  { id: "decoded", key: "compare.col.frames" },
  { id: "audio", key: "compare.col.audio" },
];

function gatePass(validation: ValidationReport | null, id: GateId): boolean | null {
  if (!validation) return null;
  const gate = validation.gates.find((g) => g.id === id);
  return gate ? gate.pass : null;
}

function GateCell({ value }: { value: boolean | null }) {
  if (value === null) {
    return <span className="text-muted-foreground/60">-</span>;
  }
  return value ? (
    <CheckCircle2 aria-hidden className="mx-auto size-4 text-foreground" />
  ) : (
    <XCircle aria-hidden className="mx-auto size-4 text-muted-foreground" />
  );
}

export function MethodComparisonCard({
  running,
  runs,
  methodStage,
  eligibility,
  onCancel,
  onSelect,
}: {
  running: boolean;
  runs: MethodRunResult[] | null;
  methodStage: Record<string, MethodRunStage>;
  eligibility: EngineEligibility[];
  onCancel: () => void;
  onSelect: (engineId: string) => void;
}) {
  const { t } = useI18n();
  const devMode = useDevMode();

  // Before the first result arrives, build rows from the eligibility list
  // so the table shows exactly the methods that will run (or be skipped).
  const rows: {
    engineId: string;
    name: string;
    run: MethodRunResult | null;
    eligibility: EngineEligibility | null;
  }[] = runs
    ? runs.map((run) => ({
        engineId: run.engineId,
        name: run.engineName,
        run,
        eligibility: eligibility.find((e) => e.engineId === run.engineId) ?? null,
      }))
    : eligibility.map((entry) => ({
        engineId: entry.engineId,
        name: getEngine(entry.engineId).name,
        run: null,
        eligibility: entry,
      }));

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="border-border/70 bg-card/80 shadow-sm backdrop-blur">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
            <div>
              <CardTitle className="text-base">{t("compare.title")}</CardTitle>
              <CardDescription className="mt-1">{t("compare.desc")}</CardDescription>
            </div>
            {running && (
              <Button variant="outline" size="sm" onClick={onCancel} className="shrink-0">
                {t("compare.cancel")}
              </Button>
            )}
          </div>
          {running && (
            <p aria-live="polite" className="text-sm text-muted-foreground">
              {t("compare.running")}
            </p>
          )}
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border/70 text-start">
                  <th className="px-2 py-2 text-start text-xs font-semibold text-foreground">
                    {t("method.title")}
                  </th>
                  <th className="px-2 py-2 text-start text-xs font-semibold text-foreground">
                    {t("compare.col.status")}
                  </th>
                  {devMode && (
                    <th className="px-2 py-2 text-end text-xs font-semibold text-foreground">
                      {t("compare.col.patch")}
                    </th>
                  )}
                  {devMode &&
                    GATE_COLUMNS.map((col) => (
                      <th
                        key={col.id}
                        className="px-2 py-2 text-center text-xs font-semibold text-foreground"
                      >
                        {t(col.key)}
                      </th>
                    ))}
                  {devMode && (
                    <th className="px-2 py-2 text-center text-xs font-semibold text-foreground">
                      {t("compare.col.overall")}
                    </th>
                  )}
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const stage = methodStage[row.engineId];
                  const run = row.run;
                  const canUse = Boolean(run && run.output && run.validation);
                  return (
                    <tr
                      key={row.engineId}
                      className="border-b border-border/50 last:border-0"
                    >
                      <td className="px-2 py-2.5 text-start">
                        <span className="text-sm font-medium text-foreground">
                          {row.name}
                        </span>
                      </td>
                      <td className="px-2 py-2.5 text-start">
                        {run ? (
                          <span className="inline-flex flex-col gap-0.5">
                            <Badge
                              variant="outline"
                              className="w-fit text-[11px] font-normal"
                            >
                              {t(STATUS_KEYS[run.status])}
                            </Badge>
                            {run.reason && (
                              <span className="text-[11px] text-muted-foreground">
                                {t(
                                  (`method.reason.${run.reason}`) as TranslationKey,
                                )}
                              </span>
                            )}
                            {run.error && (
                              <span className="text-[11px] text-muted-foreground">
                                {t(`error.${run.error}` as TranslationKey)}
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                            <CircleDashed className="size-3.5 animate-spin [animation-duration:2.5s]" />
                            {t(STAGE_KEYS[stage ?? "queued"])}
                          </span>
                        )}
                      </td>
                      {devMode && (
                        <td className="px-2 py-2.5 text-end font-mono text-xs tabular-nums text-muted-foreground">
                          {run ? `${run.patchMs} ms` : "-"}
                        </td>
                      )}
                      {devMode &&
                        GATE_COLUMNS.map((col) => (
                          <td key={col.id} className="px-2 py-2.5 text-center">
                            <GateCell value={gatePass(run?.validation ?? null, col.id)} />
                          </td>
                        ))}
                      {devMode && (
                        <td className="px-2 py-2.5 text-center">
                          {run ? (
                            run.status === "passed" ? (
                              <CheckCircle2
                                aria-label={t("compare.status.passed")}
                                className="mx-auto size-4 text-foreground"
                              />
                            ) : run.status === "failed" ? (
                              <XCircle
                                aria-label={t("compare.status.failed")}
                                className="mx-auto size-4 text-muted-foreground"
                              />
                            ) : (
                              <span className="text-muted-foreground/60">-</span>
                            )
                          ) : (
                            <span className="text-muted-foreground/60">-</span>
                          )}
                        </td>
                      )}
                      <td className="px-2 py-2.5 text-end">
                        {canUse && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onSelect(row.engineId)}
                            className="h-7 text-xs"
                          >
                            {t("compare.use")}
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!running && (
            <p className={cn("mt-3 text-xs text-muted-foreground")}>
              {t("compare.selectHint")}
            </p>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
