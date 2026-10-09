"use client";

import { motion } from "framer-motion";
import { Languages, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useI18n, LANGUAGES, type Language } from "@/lib/i18n";

export function LanguageToggle() {
  const { lang, setLang, t, dir } = useI18n();
  const current = LANGUAGES.find((l) => l.value === lang);

  return (
    <DropdownMenu dir={dir}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          aria-label={`${t("nav.language")}: ${current?.label ?? lang}`}
          title={`${t("nav.language")}: ${current?.label ?? lang}`}
          className="gap-1.5 px-2.5 text-muted-foreground hover:text-foreground"
        >
          <Languages className="size-4" />
          <motion.span
            key={lang}
            initial={{ y: -6, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.18 }}
            className="text-xs font-semibold tracking-wide"
          >
            {current?.short ?? "EN"}
          </motion.span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        {LANGUAGES.map((l) => (
          <DropdownMenuItem
            key={l.value}
            onClick={() => setLang(l.value as Language)}
            className="gap-2"
          >
            <span className="w-6 text-xs font-semibold text-muted-foreground">
              {l.short}
            </span>
            <span className="flex-1">{l.label}</span>
            {l.value === lang && <Check className="size-4" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
