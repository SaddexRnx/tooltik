"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Moon, Sun, Sparkles, Check } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useI18n, type TranslationKey } from "@/lib/i18n";

const emptySubscribe = () => () => {};
const getMounted = () => true;
const getServerNotMounted = () => false;

type ThemeChoice = "light" | "dark" | "tint";

const CHOICES: {
  value: ThemeChoice;
  storage: string;
  icon: React.ComponentType<{ className?: string }>;
  labelKey: TranslationKey;
}[] = [
  { value: "light", storage: "light", icon: Sun, labelKey: "nav.theme.light" },
  { value: "dark", storage: "dark", icon: Moon, labelKey: "nav.theme.dark" },
  {
    value: "tint",
    storage: "tint",
    icon: Sparkles,
    labelKey: "nav.theme.tint",
  },
];

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const { t } = useI18n();
  // Hydration-safe "mounted" flag without setState-in-effect:
  // server snapshot is false, client snapshot is true.
  const mounted = React.useSyncExternalStore(
    emptySubscribe,
    getMounted,
    getServerNotMounted,
  );

  // The "tint" option maps to the .dark-tint palette: next-themes handles
  // "light"/"dark", and a small class toggle applies/removes the tint on top.
  // Stored preference is read through useSyncExternalStore (no setState-in-effect).
  const storageTheme = (resolvedTheme ?? "dark") as "light" | "dark";

  function readTint(): boolean {
    try {
      return window.localStorage.getItem("toolt-theme-tint") === "1";
    } catch {
      return false;
    }
  }
  const tintListeners = React.useRef(new Set<() => void>());
  const tinted = React.useSyncExternalStore(
    React.useCallback((listener: () => void) => {
      tintListeners.current.add(listener);
      return () => {
        tintListeners.current.delete(listener);
      };
    }, []),
    readTint,
    () => false,
  );

  function setTinted(next: boolean) {
    try {
      window.localStorage.setItem("toolt-theme-tint", next ? "1" : "0");
    } catch {
      // storage unavailable - apply for this render only
    }
    document.documentElement.classList.toggle("dark-tint", next);
    for (const listener of tintListeners.current) listener();
  }

  React.useEffect(() => {
    // Sync the class once after mount (covers navigation and same-tab restore).
    document.documentElement.classList.toggle("dark-tint", readTint());
  }, []);

  const current: ThemeChoice = tinted && storageTheme === "dark" ? "tint" : storageTheme;
  const active = CHOICES.find((c) => c.value === current) ?? CHOICES[1];
  const ActiveIcon = active.icon;

  function choose(next: ThemeChoice) {
    if (next === "tint") {
      setTinted(true);
      setTheme("dark");
      return;
    }
    setTinted(false);
    setTheme(next);
  }

  const label = `${t("nav.theme")}: ${t(active.labelKey)}`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={label}
          title={label}
          className="text-muted-foreground hover:text-foreground"
        >
          {/* Render a stable icon until mounted to avoid a hydration mismatch. */}
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={mounted ? active.value : "moon"}
              initial={{ rotate: -90, opacity: 0, scale: 0.6 }}
              animate={{ rotate: 0, opacity: 1, scale: 1 }}
              exit={{ rotate: 90, opacity: 0, scale: 0.6 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="flex"
            >
              {mounted ? <ActiveIcon className="size-4" /> : <Moon className="size-4" />}
            </motion.span>
          </AnimatePresence>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-40">
        {CHOICES.map(({ value, icon: Icon, labelKey }) => (
          <DropdownMenuItem
            key={value}
            onClick={() => choose(value)}
            className="gap-2"
          >
            <Icon className="size-4 text-muted-foreground" />
            <span className="flex-1">{t(labelKey)}</span>
            {current === value && <Check className="size-4" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
