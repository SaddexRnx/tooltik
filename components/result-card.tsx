"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  Download,
  FileCog,
  FileJson,
  RefreshCcw,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import type { ElementType } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { MediaInfo } from "@/lib/mp4/inspect";
import type { PatcherResult } from "@/hooks/use-patcher";
import { getEngine } from "@/lib/engines/registry";
import { buildReport, serializeReport } from "@/lib/reports/build-report";
import type { GateId } from "@/lib/validate/gates";
import { useI18n, type TranslationKey } from "@/lib/i18n";
import { useDevMode } from "@/lib/dev-mode";
import { formatBytes, formatDelta, formatDuration } from "@/lib/format";

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05, delayChildren: 0.1 } },
};

const item = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" as const } },
};

const GATE_KEYS: Record<GateId, TranslationKey> = {
  structural: "result.gate.structural",
  payload: "result.gate.payload",
  decoded: "result.gate.decoded",
  audio: "result.gate.audio",
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h3 className="text-xs font-semibold text-foreground">{children}</h3>;
}

function FlagRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono text-xs font-medium tabular-nums text-foreground">
        {value}
      </span>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div
        className="mt-0.5 truncate font-mono text-sm font-semibold tabular-nums"
        title={value}
      >
        {value}
      </div>
    </div>
  );
}

export function ResultCard({
  result,
  info,
  engineId,
  onReset,
}: {
  result: PatcherResult;
  info: MediaInfo;
  engineId: string;
  onReset: () => void;
}) {
  const { t } = useI18n();
  const devMode = useDevMode();
  const s = result.stats;
  const duration = formatDuration(s.durationSec || info.durationSec);
  const verified = result.integrity === "verified";
  const shortHash = result.sourceHash ? result.sourceHash.slice(0, 12) : null;
  const engine = getEngine(engineId);
  const validation = result.validation;
  const validationPass = validation.pass;
  const canDownload = verified && validationPass;
  const integrityShownInBox = !verified && validationPass;
  const audio = info.audio;
  const video = info.video;
  const [exporting, setExporting] = React.useState(false);

  // JSON evidence report: gate results, patch stats, hashes, and the
  // method's evidence entry, downloaded verbatim (no server involved).
  const exportReport = React.useCallback(async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const report = await buildReport({
        info,
        engine: getEngine(engineId),
        stats: result.stats,
        validation: result.validation,
        sourceHash: result.sourceHash,
        sourceSize: result.sourceSize,
        integrity: result.integrity,
        timingChanged: result.timingChanged,
        outputBlob: result.blob,
        outputFileName: result.fileName,
        options: result.runOptions,
        normalizedFromFragmented: result.normalizedFromFragmented,
        comparison: result.comparison,
      });
      const url = URL.createObjectURL(
        new Blob([serializeReport(report)], { type: "application/json" }),
      );
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${result.fileName.replace(/\.[^.]+$/, "")}.report.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 5_000);
    } finally {
      setExporting(false);
    }
  }, [exporting, info, engineId, result]);

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      exit={{ opacity: 0, y: -10, transition: { duration: 0.2 } }}
      className="mx-auto max-w-2xl"
    >
      <Card className="relative overflow-hidden border-border/70 bg-card/80 shadow-sm backdrop-blur">
        {/* Subtle spotlight behind the success icon */}
        <div
          aria-hidden
          className="glow-hero pointer-events-none absolute -top-24 left-1/2 h-44 w-80 -translate-x-1/2"
        />

        <CardHeader className="relative pb-4">
          <motion.div variants={item} className="flex items-center gap-3">
            <motion.span
              initial={{ scale: 0, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 320, damping: 16, delay: 0.15 }}
              className="flex size-10 shrink-0 items-center justify-center rounded-full border border-foreground/30 bg-background text-foreground"
            >
              {canDownload ? (
                <ShieldCheck className="size-5" />
              ) : (
                <ShieldAlert className="size-5" />
              )}
            </motion.span>
            <div>
              <CardTitle className="text-lg">{t("result.title")}</CardTitle>
              <CardDescription>{t("result.subtitle")}</CardDescription>
            </div>
          </motion.div>
        </CardHeader>

        <CardContent className="relative divide-y divide-border/60">
          <motion.div variants={item} className="grid grid-cols-2 gap-4 pb-4 sm:grid-cols-4">
            <StatTile label={t("result.stat.input")} value={formatBytes(result.sourceSize)} />
            <StatTile label={t("result.stat.output")} value={formatBytes(s.outputSize)} />
            <StatTile
              label={t("result.stat.delta")}
              value={formatDelta(s.outputSize - result.sourceSize)}
            />
            <StatTile label={t("result.stat.duration")} value={duration} />
          </motion.div>

          {/* SOURCE: codec/container internals only in dev mode. */}
          <motion.div variants={item} className="space-y-2 py-4">
            <SectionLabel>{t("result.section.source")}</SectionLabel>
            <div className="grid grid-cols-2 gap-x-5 gap-y-3">
              <StatTile
                label={t("result.source.resolution")}
                value={`${video.width}×${video.height}`}
              />
              <StatTile label={t("result.source.duration")} value={duration} />
              {devMode && (
                <StatTile label={t("result.source.codec")} value={video.codecLabel} />
              )}
              <StatTile
                label={t("result.source.audio")}
                value={audio ? `${audio.codecLabel} · ${audio.channels}ch` : t("info.audioNone")}
              />
              {devMode && (
                <StatTile
                  label={t("result.source.container")}
                  value={`${info.isQuickTime ? "MOV" : "MP4"} · ${info.ftypBrand || "-"}`}
                />
              )}
              <StatTile label={t("result.source.size")} value={formatBytes(info.fileSize)} />
            </div>
          </motion.div>

          {/* METHOD */}
          <motion.div variants={item} className="space-y-2 py-4">
            <div className="flex items-center justify-between gap-2">
              <SectionLabel>{t("result.section.method")}</SectionLabel>
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground">
                <FileCog className="size-3.5 text-muted-foreground" />
                {engine.name}
              </span>
            </div>
            {devMode && (
              <>
                <div className="divide-y divide-border/50">
                  <FlagRow
                    label={t("method.containerOnly")}
                    value={engine.containerOnly ? t("flag.yes") : t("flag.no")}
                  />
                  <FlagRow
                    label={t("method.videoLabel")}
                    value={t(
                      engine.reencodesVideo ? "method.reencodesVideo" : "method.videoUntouched",
                    )}
                  />
                  <FlagRow
                    label={t("method.audioLabel")}
                    value={t(
                      engine.reencodesAudio ? "method.reencodesAudio" : "method.audioUntouched",
                    )}
                  />
                </div>
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <Badge variant="outline" className="font-mono text-[11px] font-normal">
                    {t("method.evidence", {
                      outcome: engine.outcomeEvidence,
                      mechanism: engine.mechanismEvidence,
                    })}
                  </Badge>
                  <Badge variant="outline" className="font-mono text-[11px] font-normal">
                    {engine.sourceRepo}@{engine.sourceCommit} · {engine.license}
                  </Badge>
                </div>
              </>
            )}
          </motion.div>

          {/* VALIDATION: the three mandatory gates */}
          <motion.div variants={item} className="space-y-2.5 py-4">
            <div className="flex items-center justify-between gap-2">
              <SectionLabel>{t("result.section.validation")}</SectionLabel>
              {devMode && (
                <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                  {t("result.validation.total", { ms: String(validation.totalMs) })}
                </span>
              )}
            </div>
            <ul className="space-y-2">
              {validation.gates.map((gate) => {
                const Icon: ElementType = gate.pass ? CheckCircle2 : XCircle;
                return (
                  <li key={gate.id} className="flex items-start gap-2.5">
                    <Icon className="mt-0.5 size-4 shrink-0 text-foreground" strokeWidth={2} />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="font-medium text-foreground">
                          {t(GATE_KEYS[gate.id])}
                        </span>
                        {devMode && (
                          <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                            {gate.ms} ms
                          </span>
                        )}
                        {!gate.pass && (
                          <Badge variant="outline" className="text-[11px]">
                            {t("flag.failed")}
                          </Badge>
                        )}
                      </div>
                      {devMode && (
                        <p className="break-words text-xs leading-relaxed text-muted-foreground">
                          {gate.detail}
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
            {devMode && validation.decoded && validation.decoded.notes.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {validation.decoded.notes[0]}
              </p>
            )}
          </motion.div>

          {/* STATUS */}
          <motion.div variants={item} className="space-y-3 py-4">
            <div
              className={
                canDownload
                  ? "flex items-center justify-center gap-2 rounded-md border border-foreground/40 bg-foreground/[0.04] px-3 py-2.5"
                  : "flex items-start justify-center gap-2 rounded-md border border-foreground/30 bg-foreground/[0.03] px-3 py-2.5"
              }
            >
              {canDownload ? (
                <ShieldCheck className="size-3.5 shrink-0 text-foreground" strokeWidth={1.75} />
              ) : (
                <ShieldAlert className="mt-0.5 size-3.5 shrink-0 text-foreground" strokeWidth={1.75} />
              )}
              <span className="text-xs font-semibold tracking-wide text-foreground">
                {canDownload
                  ? t("result.status.verified")
                  : !validationPass
                    ? t("result.status.failed")
                    : t(
                        result.integrity === "failed"
                          ? "result.integrity.failed"
                          : "result.integrity.unverified",
                      )}
              </span>
              {canDownload && devMode && shortHash && (
                <span className="font-mono text-xs text-muted-foreground">{shortHash}</span>
              )}
            </div>

            {!integrityShownInBox && (
              <p className="text-center text-xs leading-relaxed text-muted-foreground">
                {t(
                  verified
                    ? "result.integrity.verified"
                    : result.integrity === "failed"
                      ? "result.integrity.failed"
                      : "result.integrity.unverified",
                )}
              </p>
            )}

            {result.timingChanged && (
              <div className="flex items-start gap-2.5 rounded-md border border-border bg-muted/40 px-3 py-2.5">
                <ShieldAlert className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {t("result.timingWarning")}
                </p>
              </div>
            )}

            <div className="flex items-start gap-2.5 rounded-md border border-border bg-muted/40 px-3 py-2.5">
              <ShieldAlert className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
              <p className="text-xs leading-relaxed text-muted-foreground">
                {t("result.localOnly")}
              </p>
            </div>

            <div className="flex items-start gap-2.5 rounded-md border border-border bg-muted/40 px-3 py-2.5">
              <ShieldAlert className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
              <p className="text-xs leading-relaxed text-muted-foreground">
                {t("result.tiktok.notTested")}
              </p>
            </div>

            <div className="flex flex-col-reverse items-stretch gap-2 sm:flex-row sm:items-center sm:justify-end">
              <Button
                variant="ghost"
                onClick={onReset}
                className="gap-2 transition-transform active:scale-[0.98]"
              >
                <RefreshCcw className="size-4" />
                {t("action.another")}
              </Button>
              <Button
                variant="outline"
                onClick={() => void exportReport()}
                disabled={exporting}
                className="gap-2 transition-[opacity,transform] hover:opacity-90 active:scale-[0.98]"
              >
                <FileJson className="size-4" />
                {t("action.exportReport")}
              </Button>
              {canDownload ? (
                <motion.a
                  href={result.url}
                  download={result.fileName}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-[opacity,box-shadow] hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  <Download className="size-4" />
                  {t("action.download")}
                </motion.a>
              ) : (
                <span
                  aria-disabled="true"
                  className="inline-flex cursor-not-allowed items-center justify-center gap-2 rounded-md border border-border bg-muted px-4 py-2 text-sm font-medium text-muted-foreground opacity-60"
                >
                  <Download className="size-4" />
                  {t("action.download")}
                </span>
              )}
            </div>

            <p className="break-all text-center font-mono text-xs text-muted-foreground">
              {t("action.downloadHint", { name: result.fileName })}
            </p>
          </motion.div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
