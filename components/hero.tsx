"use client";

import type { ElementType } from "react";
import { motion } from "framer-motion";
import { Lock, Zap, Infinity as InfinityIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useI18n, type TranslationKey } from "@/lib/i18n";

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
};

const item = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: "easeOut" as const } },
};

const BADGES: { key: TranslationKey; icon: ElementType }[] = [
  { key: "hero.badge.local", icon: Lock },
  { key: "hero.badge.noUpload", icon: Zap },
  { key: "hero.badge.noAccount", icon: InfinityIcon },
];

export function Hero() {
  const { t } = useI18n();
  const after = t("hero.title.after");

  return (
    <section className="relative overflow-hidden pb-6 pt-8 sm:pt-14">
      {/* Blueprint grid fading out toward the fold */}
      <div
        aria-hidden
        className="bg-grid bg-grid-fade pointer-events-none absolute inset-x-0 -top-24 h-[420px]"
      />
      {/* Monochrome spotlight behind the headline */}
      <div
        aria-hidden
        className="glow-hero pointer-events-none absolute left-1/2 top-0 h-72 w-[min(560px,100vw)] -translate-x-1/2"
      />
      {/* Soft drifting color aurora (order-of-foreground; pointer-events none). */}
      <div aria-hidden className="bg-aurora pointer-events-none absolute inset-0" />

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="relative mx-auto w-full max-w-3xl text-center"
      >
        <motion.h1
          variants={item}
          className="text-balance text-3xl font-semibold leading-[1.08] tracking-tight sm:text-4xl md:text-5xl"
        >
          <span>{t("hero.title.before")} </span>
          <span className="underline decoration-2 underline-offset-[6px] decoration-foreground/40">
            {t("hero.title.highlight")}
          </span>
          {after ? <span> {after}</span> : null}
        </motion.h1>

        <motion.p
          variants={item}
          className="mx-auto mt-4 max-w-2xl text-balance text-sm leading-relaxed text-muted-foreground sm:text-base"
        >
          {t("hero.subtitle")}
        </motion.p>

        <motion.div
          variants={item}
          className="mt-6 flex flex-wrap items-center justify-center gap-2"
        >
          {BADGES.map(({ key, icon: Icon }) => (
            <Badge
              key={key}
              variant="secondary"
              className="gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium"
            >
              <Icon className="size-3.5" />
              {t(key)}
            </Badge>
          ))}
        </motion.div>
      </motion.div>
    </section>
  );
}
