"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Separator } from "@/components/ui/separator";
import { useI18n } from "@/lib/i18n";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageToggle } from "@/components/language-toggle";
import { DevModeToggle } from "@/components/dev-mode-toggle";
import { Logo } from "@/components/logo";

export function SiteHeader() {
  const { t } = useI18n();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4 sm:px-6">
        <Link
          href="/"
          className="group flex items-center gap-2.5"
          aria-label={t("brand.name")}
        >
          <motion.span
            whileHover={{ rotate: -8, scale: 1.08 }}
            transition={{ type: "spring", stiffness: 400, damping: 18 }}
            className="flex size-8 items-center justify-center rounded-lg border border-border/70 bg-card text-foreground shadow-sm"
          >
            <Logo className="size-5" />
          </motion.span>
          <span className="text-base font-semibold tracking-tight">
            {t("brand.name")}
          </span>
        </Link>

        <div className="flex items-center gap-0.5">
          <LanguageToggle />
          <Separator orientation="vertical" className="mx-1 h-5" />
          <ThemeToggle />
          <Separator orientation="vertical" className="mx-1 h-5" />
          <DevModeToggle />
        </div>
      </div>
    </header>
  );
}
