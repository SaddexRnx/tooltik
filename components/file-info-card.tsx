"use client";

import * as React from "react";
import type { ElementType } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  ArrowRight,
  Box,
  CalendarX,
  CheckCircle2,
  Clock,
  Copy,
  FileVideo,
  Film,
  Focus,
  Gauge,
  HardDrive,
  Minimize2,
  Monitor,
  Moon,
  Palette,
  RotateCcw,
  RotateCw,
  ScanSearch,
  Scissors,
  ShieldCheck,
  Sun,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertTitle } from "@/components/ui/alert";
import type { MediaInfo } from "@/lib/mp4/inspect";
import type { QualityFinding, QualityReport } from "@/lib/mp4/quality";
import type { PatchRunOptions } from "@/hooks/use-patcher";
import type { DecodeRunResult } from "@/lib/validate/decode";
import type { StructureReport } from "@/lib/validate/structure";
import { ENGINES } from "@/lib/engines/registry";
import {
  type EngineEligibility,
  eligibilityFor,
} from "@/lib/methods/eligibility";
import { useI18n, type TranslationKey } from "@/lib/i18n";
import { useDevMode } from "@/lib/dev-mode";
import {
  formatBytes,
  formatDuration,
  formatFps,
  formatResolution,
} from "@/lib/format";

const REASON_KEYS: Record<string, TranslationKey> = {
  "codec-not-avc": "method.reason.codec-not-avc",
  "fps-unsupported": "method.reason.fps-unsupported",
  "timescale-indivisible": "method.reason.timescale-indivisible",
  "already-has-edit-list": "method.reason.already-has-edit-list",
  "eligibility-error": "method.reason.eligibility-error",
  unsupported: "method.reason.unsupported",
};

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05, delayChildren: 0.08 } },
};

const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" as const } },
};

const FINDING_UI: Record<
  QualityFinding["id"],
  { icon: ElementType; key: TranslationKey; severityClass: string }
> = {
  ok: {
    icon: CheckCircle2,
    key: "report.finding.ok",
    severityClass: "text-foreground",
  },
  vfr: {
    icon: Activity,
    key: "report.finding.vfr",
    severityClass: "text-foreground",
  },
  metadata: { icon: CalendarX, key: "report.finding.metadata", severityClass: "text-muted-foreground" },
  "bitrate-high": { icon: Gauge, key: "report.finding.bitrate-high", severityClass: "text-muted-foreground" },
  "bitrate-low": {
    icon: Gauge,
    key: "report.finding.bitrate-low",
    severityClass: "text-foreground",
  },
  resolution: { icon: Minimize2, key: "report.finding.resolution", severityClass: "text-muted-foreground" },
  bitdepth: { icon: Palette, key: "report.finding.bitdepth", severityClass: "text-muted-foreground" },
  "audio-low": { icon: Volume2, key: "report.finding.audio-low", severityClass: "text-muted-foreground" },
  gop: { icon: Scissors, key: "report.finding.gop", severityClass: "text-muted-foreground" },
};

const SEVERITY_OVERRIDE: Partial<Record<QualityFinding["severity"], string>> = {
  good: "text-foreground",
  warn: "text-foreground",
};

function formatMbps(bps: number): string {
  return `${(bps / 1_000_000).toFixed(1)} Mbps`;
}

function formatKbps(bps: number): string {
  return `${Math.round(bps / 1000)} kbps`;
}

/** Hairline vertical divider used between inline metadata values. */
function MetaDivider() {
  return <span aria-hidden className="mx-2 inline-block h-3 w-px bg-border align-middle" />;
}

function ToggleRow({
  checked,
  onChange,
  label,
  desc,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  desc: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs leading-relaxed text-muted-foreground">{desc}</div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative mt-1 h-5 w-9 shrink-0 rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
          checked ? "border-foreground bg-foreground" : "border-border bg-background"
        }`}
      >
        <span
          className={`absolute top-1/2 size-3.5 -translate-y-1/2 rounded-full transition-[background-color,inset-inline-start] ${
            checked
              ? "start-[19px] bg-background"
              : "start-[3px] bg-muted-foreground"
          }`}
        />
      </button>
    </div>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
}: {
  icon: ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-w-0 items-start gap-2.5">
      <Icon className="mt-1 size-3.5 shrink-0 text-muted-foreground" strokeWidth={1.75} />
      <div className="min-w-0">
        <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </div>
        <div className="truncate font-mono text-[13px] font-medium tabular-nums" title={value}>
          {value}
        </div>
      </div>
    </div>
  );
}

export function FileInfoCard({
  info,
  report,
  baseline,
  inputStructure,
  engineId,
  onEngineChange,
  onPatch,
  onCompare,
  onReset,
  eligibility,
  normalizedFromFragmented,
}: {
  info: MediaInfo;
  report: QualityReport | null;
  baseline: DecodeRunResult | null;
  inputStructure: StructureReport | null;
  engineId: string;
  onEngineChange: (id: string) => void;
  onPatch: (opts?: PatchRunOptions) => void;
  onCompare: (opts?: PatchRunOptions) => void;
  onReset: () => void;
  eligibility: EngineEligibility[];
  normalizedFromFragmented: boolean;
}) {
  const { t } = useI18n();
  const video = info.video;
  const audio = info.audio;
  const devMode = useDevMode();
  const [scrub, setScrub] = React.useState(true);
  const [flatten, setFlatten] = React.useState(report?.isVfr ?? false);

  const selectedEligibility = eligibilityFor(eligibility, engineId);
  // No eligibility list (never computed) must not block the run.
  const selectedSupported =
    selectedEligibility === null || selectedEligibility.status === "supported";
  const runOptions: PatchRunOptions = {
    scrubMetadata: scrub,
    flattenFrameTiming: flatten,
  };

  // Warnings that matter to everyone even in simple mode.
  const hasImportantFinding =
    report !== null && report.findings.some((f) => f.id === "vfr" || f.id === "bitrate-low" || f.id === "audio-low");
  const decodedOk = Boolean(baseline && baseline.available && baseline.errors === 0 && baseline.decodedFrames > 0);
  const decodedFps =
    baseline && baseline.decodedFrames > 1 && baseline.firstPtsUs !== null && baseline.lastPtsUs !== null
      ? Math.round(((baseline.decodedFrames - 1) / ((baseline.lastPtsUs - baseline.firstPtsUs) / 1e6)) * 100) / 100
      : null;

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      exit={{ opacity: 0, y: -10, transition: { duration: 0.2 } }}
    >
      <Card className="border-border/70 bg-card/80 shadow-sm backdrop-blur">
        <CardHeader className="pb-4">
          <motion.div
            variants={item}
            className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3"
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-card text-foreground">
                <FileVideo className="size-4" />
              </span>
              <div className="min-w-0">
                <CardTitle className="truncate text-base" title={info.fileName}>
                  {info.fileName}
                </CardTitle>
                <CardDescription className="mt-0.5 flex flex-wrap items-center">
                  <span className="font-mono tabular-nums">{formatDuration(info.durationSec)}</span>
                  <MetaDivider />
                  <span className="font-mono tabular-nums">
                    {formatResolution(video.width, video.height)}
                  </span>
                  <MetaDivider />
                  <span className="font-mono tabular-nums">{formatFps(video.fps)} FPS</span>
                </CardDescription>
              </div>
            </div>
            <div className="flex shrink-0 flex-row items-center gap-1.5 sm:flex-col sm:items-end">
              <Badge variant="secondary" className="font-mono text-[11px] font-medium">
                {info.isQuickTime ? "MOV" : "MP4"}
              </Badge>
              <Badge
                variant="outline"
                className={`text-[11px] ${
                  info.fastStart
                    ? "border-foreground/40 text-foreground"
                    : "text-muted-foreground"
                }`}
              >
                {info.fastStart ? t("info.fastStart.yes") : t("info.fastStart.no")}
              </Badge>
              {baseline && baseline.available && baseline.decodedFrames > 0 && (
                <Badge variant="outline" className="text-[11px]">
                  {baseline.mode === "full"
                    ? t("info.decodeMode.full")
                    : t("info.decodeMode.sampled")}
                </Badge>
              )}
            </div>
          </motion.div>
        </CardHeader>

        <CardContent className="divide-y divide-border/60">
          <motion.div
            variants={item}
            className="grid grid-cols-2 gap-x-5 gap-y-3.5 pb-4 sm:grid-cols-3"
          >
            <StatTile
              icon={Monitor}
              label={t("info.resolution")}
              value={formatResolution(video.width, video.height)}
            />
            <StatTile icon={Gauge} label={t("info.fps")} value={formatFps(video.fps)} />
            <StatTile
              icon={Clock}
              label={t("info.duration")}
              value={formatDuration(info.durationSec)}
            />
            <StatTile
              icon={HardDrive}
              label={t("info.size")}
              value={formatBytes(info.fileSize)}
            />
            <StatTile icon={Box} label={t("info.videoCodec")} value={video.codecLabel} />
            <StatTile
              icon={audio ? Volume2 : VolumeX}
              label={t("info.audioCodec")}
              value={
                audio
                  ? `${audio.codecLabel} · ${audio.channels}ch`
                  : t("info.audioNone")
              }
            />
            {devMode && (
              <StatTile
                icon={Film}
                label={t("info.decoded")}
                value={
                  baseline && baseline.available
                    ? decodedOk && decodedFps !== null
                      ? `${baseline.decodedFrames}/${baseline.expectedFrames} · ${formatFps(decodedFps)}`
                      : `${baseline.decodedFrames}/${baseline.expectedFrames}` +
                        (baseline.errors > 0
                          ? ` · ${baseline.errors} ${t("info.decoded.errors")}`
                          : "")
                    : t("info.decoded.unavailable")
                }
              />
            )}
            {devMode && baseline?.content.measured ? (
              <>
                <StatTile
                  icon={Moon}
                  label={t("quality.black")}
                  value={`${baseline.content.blackFrames}/${baseline.content.measured}`}
                />
                <StatTile
                  icon={Copy}
                  label={t("quality.duplicates")}
                  value={`${baseline.content.duplicateFrames}/${baseline.content.measured}`}
                />
                <StatTile
                  icon={Sun}
                  label={t("quality.clipped")}
                  value={`${baseline.content.clippedFrames}/${baseline.content.measured}`}
                />
                <StatTile
                  icon={Focus}
                  label={t("quality.sharpness")}
                  value={
                    baseline.content.sharpnessAvg !== null
                      ? baseline.content.sharpnessAvg.toFixed(1)
                      : "-"
                  }
                />
              </>
            ) : null}
            {video.rotationDeg !== 0 && (
              <StatTile
                icon={RotateCw}
                label={t("info.rotation")}
                value={`${video.rotationDeg}°`}
              />
            )}
          </motion.div>

          {info.alreadyPatched && (
            <motion.div variants={item} className="py-4">
              <Alert className="border-border bg-muted/50">
                <AlertTitle className="text-foreground">
                  {t("info.alreadyPatched")}
                </AlertTitle>
              </Alert>
            </motion.div>
          )}

          {normalizedFromFragmented && (
            <motion.div variants={item} className="py-4">
              <Alert className="border-border bg-muted/50">
                <AlertTitle className="text-foreground">
                  {t("info.fragmentedNormalized")}
                </AlertTitle>
              </Alert>
            </motion.div>
          )}

          {inputStructure && (devMode || inputStructure.crossCheck.conflicts.length > 0) && (
            <motion.div variants={item} className="py-4">
              {inputStructure.crossCheck.conflicts.length > 0 ? (
                <Alert className="border-foreground/40 bg-foreground/[0.03]">
                  <AlertTitle className="text-foreground">
                    {t("info.crosscheck.conflict")}
                  </AlertTitle>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {inputStructure.crossCheck.conflicts.join("; ")}
                  </p>
                </Alert>
              ) : (
                <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
                  <ScanSearch className="size-3.5 shrink-0" />
                  <span>
                    {inputStructure.crossCheck.available
                      ? t("info.crosscheck.agree")
                      : t("info.crosscheck.notrun")}
                  </span>
                </div>
              )}
            </motion.div>
          )}

          {report && (devMode || hasImportantFinding) && (
            <motion.div variants={item} className="space-y-3 py-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                  <ShieldCheck className="size-3.5 text-muted-foreground" />
                  {t("report.title")}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {report.videoBitrateBps !== null && (
                    <Badge variant="outline" className="font-mono text-[11px] font-normal">
                      {t("report.chip.video", { value: formatMbps(report.videoBitrateBps) })}
                    </Badge>
                  )}
                  {report.audioBitrateBps !== null && (
                    <Badge variant="outline" className="font-mono text-[11px] font-normal">
                      {t("report.chip.audio", { value: formatKbps(report.audioBitrateBps) })}
                    </Badge>
                  )}
                  {report.keyframes > 0 && report.gopFrames !== null && (
                    <Badge variant="outline" className="font-mono text-[11px] font-normal">
                      {report.keyframes} × {report.gopFrames}
                    </Badge>
                  )}
                </div>
              </div>
              <ul className="space-y-1.5">
                {report.findings.map((finding) => {
                  const ui = FINDING_UI[finding.id];
                  const Icon = ui.icon;
                  const severityClass =
                    SEVERITY_OVERRIDE[finding.severity] ?? ui.severityClass;
                  return (
                    <li
                      key={finding.id}
                      className="flex items-start gap-2.5 text-sm text-muted-foreground"
                    >
                      <Icon className={`mt-0.5 size-3.5 shrink-0 ${severityClass}`} />
                      <span>
                        {t(ui.key, { value: finding.value ?? "" })}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </motion.div>
          )}

          {/* In simple mode: just a reassurance strip, method chooser stays. */}
          {!devMode && (
            <motion.div variants={item} className="flex flex-col gap-1.5 py-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-2">
                <ShieldCheck className="size-3.5 shrink-0" />
                {t("simple.videoSafe")}
              </span>
              <span className="flex items-center gap-2">
                <CheckCircle2 className="size-3.5 shrink-0" />
                {t("simple.checksDone")}
              </span>
            </motion.div>
          )}

          <motion.div variants={item} className="space-y-3 py-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
              {t("method.title")}
            </div>
            <ul className="space-y-2">
              {ENGINES.map((engine) => {
                const active = engine.id === engineId;
                const entry = eligibilityFor(eligibility, engine.id);
                const supported = entry === null || entry.status === "supported";
                const reasonKey = entry?.reason
                  ? (REASON_KEYS[entry.reason] ?? "method.reason.unsupported")
                  : null;
                return (
                  <li key={engine.id}>
                    <button
                      type="button"
                      aria-pressed={active}
                      onClick={() => onEngineChange(engine.id)}
                      className={`w-full rounded-md border px-3 py-2.5 text-start transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                        active
                          ? "border-foreground/50 bg-foreground/[0.04]"
                          : "border-border bg-background/40 hover:border-foreground/30"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-foreground">
                          {engine.name}
                        </span>
                        <span
                          aria-hidden
                          className={`size-3.5 shrink-0 rounded-full border-2 ${
                            active ? "border-foreground bg-foreground" : "border-border"
                          }`}
                        />
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        <Badge
                          variant="outline"
                          className={`text-[11px] font-normal ${
                            supported
                              ? "border-foreground/40 text-foreground"
                              : "text-muted-foreground"
                          }`}
                        >
                          {supported
                            ? t("method.eligible")
                            : t("method.notEligible")}
                        </Badge>
                        <Badge variant="outline" className="text-[11px] font-normal">
                          {engine.containerOnly
                            ? t("method.containerOnly")
                            : t("method.reencode")}
                        </Badge>
                        <Badge variant="outline" className="text-[11px] font-normal">
                          {engine.reencodesVideo
                            ? t("method.reencodesVideo")
                            : t("method.videoUntouched")}
                        </Badge>
                        <Badge variant="outline" className="text-[11px] font-normal">
                          {engine.reencodesAudio
                            ? t("method.reencodesAudio")
                            : t("method.audioUntouched")}
                        </Badge>
                        {devMode && (
                          <Badge variant="outline" className="font-mono text-[11px] font-normal">
                            {t("method.evidence", {
                              outcome: engine.outcomeEvidence,
                              mechanism: engine.mechanismEvidence,
                            })}
                          </Badge>
                        )}
                      </div>
                      {!supported && reasonKey && active && (
                        <p className="mt-1.5 text-xs text-muted-foreground">
                          {t(reasonKey)}
                        </p>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </motion.div>

          <motion.div variants={item} className="space-y-3 py-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
              {t("options.title")}
            </div>
            <ToggleRow
              checked={scrub}
              onChange={setScrub}
              label={t("option.scrub")}
              desc={t("option.scrub.desc")}
            />
            {report?.isVfr && engineId === "ghost-frame" && (
              <ToggleRow
                checked={flatten}
                onChange={setFlatten}
                label={t("option.flatten")}
                desc={t("option.flatten.desc")}
              />
            )}
          </motion.div>

          <motion.div
            variants={item}
            className="flex flex-col-reverse gap-2 pt-4 sm:flex-row sm:justify-end"
          >
            <Button variant="ghost" onClick={onReset} className="active:scale-[0.98] transition-transform">
              <RotateCcw className="size-4" />
              {t("action.reset")}
            </Button>
            <Button
              variant="outline"
              onClick={() => onCompare(runOptions)}
              className="gap-2 transition-[opacity,transform] hover:opacity-90 active:scale-[0.98]"
            >
              {t("method.runAll")}
            </Button>
            <Button
              disabled={!selectedSupported}
              onClick={() => onPatch(runOptions)}
              className="gap-2 shadow-sm transition-[opacity,transform] hover:opacity-90 active:scale-[0.98]"
            >
              {selectedSupported ? t("action.patch") : t("method.cannotRun")}
              <ArrowRight className="size-4 rtl:rotate-180" />
            </Button>
          </motion.div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
