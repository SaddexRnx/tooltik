"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n, type TranslationKey } from "@/lib/i18n";
import type { PatcherPhase } from "@/hooks/use-patcher";

const STEP_KEYS: TranslationKey[] = [
  "step.drop",
  "step.inspect",
  "step.prepare",
  "step.download",
];

function currentIndex(phase: PatcherPhase): number {
  switch (phase) {
    case "idle":
      return 0;
    case "inspecting":
    case "ready":
    case "error":
      return 1;
    case "patching":
    case "validating":
    case "comparing":
    case "comparison":
      return 2;
    case "done":
      return 3;
  }
}

export function Stepper({ phase }: { phase: PatcherPhase }) {
  const { t } = useI18n();
  const current = currentIndex(phase);

  return (
    <motion.nav
      aria-label={t("step.label")}
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="mx-auto w-fit max-w-full"
    >
      <ol className="flex items-center gap-1 rounded-full border border-border/70 bg-card/70 px-2 py-1.5 shadow-sm backdrop-blur sm:gap-2 sm:px-3">
        {STEP_KEYS.map((key, i) => {
          const complete = i < current;
          const active = i === current;
          return (
            <li
              key={key}
              aria-current={active ? "step" : undefined}
              className="flex items-center gap-1.5 sm:gap-2"
            >
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-medium transition-colors duration-300",
                  complete && "bg-foreground text-background",
                  active &&
                    "border-2 border-foreground text-foreground",
                  !complete &&
                    !active &&
                    "border border-border text-muted-foreground",
                )}
              >
                {complete ? (
                  <Check className="size-3.5" strokeWidth={3} />
                ) : (
                  <span className="font-mono tabular-nums">{i + 1}</span>
                )}
              </span>
              <span
                className={cn(
                  "sr-only text-xs font-medium sm:not-sr-only",
                  active
                    ? "text-foreground"
                    : complete
                      ? "text-muted-foreground"
                      : "text-muted-foreground/60",
                )}
              >
                {t(key)}
              </span>
              {i < STEP_KEYS.length - 1 && (
                <span className="relative mx-0.5 h-px w-5 bg-border sm:mx-1 sm:w-8">
                  <motion.span
                    aria-hidden
                    className="absolute inset-0 origin-left bg-foreground rtl:origin-right"
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: complete ? 1 : 0 }}
                    transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                  />
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </motion.nav>
  );
}
