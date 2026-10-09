"use client";

import { motion } from "framer-motion";
import {
  AudioLines,
  CheckCircle2,
  FileCode2,
  Film,
  Layers,
  ScanSearch,
  Sparkles,
  Volume2,
} from "lucide-react";
import type { ElementType } from "react";
import { Card, CardContent } from "@/components/ui/card";
import type { PatchProgress } from "@/lib/mp4/transform";
import type { GateId } from "@/lib/validate/gates";
import { useI18n, type TranslationKey } from "@/lib/i18n";
import { Logo } from "@/components/logo";

const STAGE_ICONS: Record<PatchProgress["stage"], ElementType> = {
  validate: ScanSearch,
  "first-sample": Sparkles,
  audio: AudioLines,
  metadata: FileCode2,
  assemble: Layers,
  done: CheckCircle2,
};

const VALIDATION_ICONS: Record<GateId, ElementType> = {
  structural: FileCode2,
  payload: AudioLines,
  decoded: Film,
  audio: Volume2,
};

const VALIDATION_PERCENT: Record<GateId | "done", number> = {
  structural: 84,
  payload: 90,
  audio: 94,
  decoded: 98,
  done: 100,
};

const RING_RADIUS = 44;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export function PatchProgress({
  progress,
  fileName,
  validationStage = null,
}: {
  progress: PatchProgress;
  fileName: string;
  /** Non-null while the three validation gates are running. */
  validationStage?: GateId | "done" | null;
}) {
  const { t } = useI18n();
  const validating = validationStage !== null;
  const Icon = validating
    ? (VALIDATION_ICONS[validationStage as GateId] ?? ScanSearch)
    : (STAGE_ICONS[progress.stage] ?? ScanSearch);
  const rawPercent = validating
    ? VALIDATION_PERCENT[validationStage]
    : progress.percent * 0.8; // reserve the last 20% for validation
  const percent = Math.min(100, Math.max(0, Math.round(rawPercent)));
  const stageKey = (
    validating
      ? `progress.validating.${validationStage}`
      : `progress.stage.${progress.stage}`
  ) as TranslationKey;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.985 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      <Card className="relative overflow-hidden border-border/70 bg-card/80 shadow-sm backdrop-blur">
        <CardContent className="flex flex-col items-center gap-6 px-4 py-7 sm:px-6 sm:py-8">
          {/* Circular progress with orbiting satellites and the cat in the center */}
          <div className="relative size-36 sm:size-44">
            {/* Track + progress ring */}
            <svg
              viewBox="0 0 100 100"
              className="absolute inset-0 size-full -rotate-90 text-foreground"
              aria-hidden
            >
              <circle
                cx="50"
                cy="50"
                r={RING_RADIUS}
                fill="none"
                stroke="currentColor"
                strokeOpacity="0.12"
                strokeWidth="5"
              />
              <motion.circle
                cx="50"
                cy="50"
                r={RING_RADIUS}
                fill="none"
                stroke="currentColor"
                strokeWidth="5"
                strokeLinecap="round"
                strokeDasharray={RING_CIRCUMFERENCE}
                initial={{ strokeDashoffset: RING_CIRCUMFERENCE }}
                animate={{
                  strokeDashoffset:
                    RING_CIRCUMFERENCE * (1 - percent / 100),
                }}
                transition={{ duration: 0.6, ease: "easeOut" }}
              />
            </svg>

            {/* Two counter-rotating satellites */}
            <motion.div
              className="absolute inset-0"
              animate={{ rotate: 360 }}
              transition={{ duration: 7, repeat: Infinity, ease: "linear" }}
            >
              <span className="absolute left-1/2 top-0 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground shadow-[0_0_10px_2px_color-mix(in_oklch,var(--foreground)_40%,transparent)]" />
            </motion.div>
            <motion.div
              className="absolute inset-4"
              animate={{ rotate: -360 }}
              transition={{ duration: 11, repeat: Infinity, ease: "linear" }}
            >
              <span className="absolute left-1/2 top-0 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-muted-foreground" />
            </motion.div>

            {/* Soft breathing halo */}
            <span
              aria-hidden
              className="animate-pulse-ring absolute inset-6 rounded-full"
            />

            {/* Center: the mascot + percentage */}
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
              <motion.div
                animate={{ y: [0, -5, 0] }}
                transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
              >
                <Logo className="size-9 text-foreground" />
              </motion.div>
              <div className="font-mono text-2xl font-semibold tabular-nums">
                {percent}%
              </div>
            </div>
          </div>

          {/* Stage label with icon */}
          <div className="flex flex-col items-center gap-1.5 text-center">
            <motion.span
              key={stageKey}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              aria-live="polite"
              className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/60 px-3 py-1.5 text-sm font-medium"
            >
              <Icon className="size-3.5" />
              {t(stageKey)}
            </motion.span>
            <span className="text-xs text-muted-foreground">{fileName}</span>
            <span className="text-xs text-muted-foreground">
              {t("progress.hint")}
            </span>
          </div>

          {/* Thin determinate bar */}
          <div
            className="h-1.5 w-full max-w-sm overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-label={t("progress.title")}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
          >
            <motion.div
              className="h-full rounded-full bg-foreground"
              initial={{ width: "0%" }}
              animate={{ width: `${percent}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
