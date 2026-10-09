"use client";

/**
 * Application providers: dark-mode theming (next-themes), instant
 * EN⇄AR language switching with RTL direction, and shadcn's tooltip layer.
 */

import * as React from "react";
import { ThemeProvider } from "next-themes";
import { MotionConfig } from "framer-motion";
import { LanguageProvider, useI18n } from "@/lib/i18n";
import { DirectionProvider } from "@/components/ui/direction";
import { TooltipProvider } from "@/components/ui/tooltip";

function DirectionLayer({ children }: { children: React.ReactNode }) {
  const { dir } = useI18n();
  return (
    <DirectionProvider dir={dir}>
      <TooltipProvider delayDuration={350}>{children}</TooltipProvider>
    </DirectionProvider>
  );
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      disableTransitionOnChange
    >
      <LanguageProvider>
        {/* Respect prefers-reduced-motion for every Framer Motion animation. */}
        <MotionConfig reducedMotion="user">
          <DirectionLayer>{children}</DirectionLayer>
        </MotionConfig>
      </LanguageProvider>
    </ThemeProvider>
  );
}
