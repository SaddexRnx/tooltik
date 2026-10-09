"use client";

/**
 * Lightweight, instant language switching (English ⇄ Arabic) with RTL support.
 *
 * No network requests, no locale files fetched at runtime — both dictionaries
 * are bundled. The preference lives in localStorage and is exposed through
 * `useSyncExternalStore` so SSR and hydration stay consistent (server always
 * renders English, the client adopts the stored language right after
 * hydration without triggering a mismatch warning). The first visit follows
 * the browser language.
 */

import * as React from "react";
import { en, type Dictionary, type TranslationKey } from "./en";
import { ar } from "./ar";
import { fr } from "./fr";
import { es } from "./es";
import { pt } from "./pt";
import { hi } from "./hi";
import { zh } from "./zh";
import { ru } from "./ru";
import { ja } from "./ja";

export type Language = "en" | "ar" | "fr" | "es" | "pt" | "hi" | "zh" | "ru" | "ja";
export const LANGUAGES: { value: Language; label: string; short: string }[] = [
  { value: "en", label: "English", short: "EN" },
  { value: "es", label: "Español", short: "ES" },
  { value: "pt", label: "Português", short: "PT" },
  { value: "fr", label: "Français", short: "FR" },
  { value: "ar", label: "العربية", short: "ع" },
  { value: "hi", label: "हिन्दी", short: "हि" },
  { value: "zh", label: "中文", short: "中" },
  { value: "ru", label: "Русский", short: "РУ" },
  { value: "ja", label: "日本語", short: "日" },
];

const dictionaries: Record<Language, Dictionary> = { en, ar, fr, es, pt, hi, zh, ru, ja };
const STORAGE_KEY = "toolt-lang";
const RTL_LANGUAGES: Language[] = ["ar"];

export function directionOf(lang: Language): "rtl" | "ltr" {
  return RTL_LANGUAGES.includes(lang) ? "rtl" : "ltr";
}

/* --------------------------------------------------------------------------
 * External store: one listener set shared by every subscriber; writing the
 * language notifies React outside of render (the sanctioned pattern instead
 * of calling setState inside an effect).
 * ------------------------------------------------------------------------ */

const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notify(): void {
  for (const listener of listeners) listener();
}

function normalize(value: string | null): Language | undefined {
  if (
    value === "en" || value === "ar" || value === "fr" ||
    value === "es" || value === "pt" || value === "hi" ||
    value === "zh" || value === "ru" || value === "ja"
  ) return value;
  return undefined;
}

function readStoredLanguage(): string {
  try {
    const stored = normalize(window.localStorage.getItem(STORAGE_KEY));
    if (stored) return stored;
  } catch {
    // storage unavailable — fall through to browser language
  }
  try {
    return browserLanguage();
  } catch {
    // navigator unavailable
  }
  return "en";
}

// Order matters: more specific prefixes first (pt-BR vs pt, zh variants).
function browserLanguage(): Language {
  const nav = navigator.language.toLowerCase();
  if (nav.startsWith("en")) return "en";
  if (nav.startsWith("ar")) return "ar";
  if (nav.startsWith("fr")) return "fr";
  if (nav.startsWith("es")) return "es";
  if (nav.startsWith("pt")) return "pt";
  if (nav.startsWith("hi")) return "hi";
  if (nav.startsWith("zh")) return "zh";
  if (nav.startsWith("ru")) return "ru";
  if (nav.startsWith("ja")) return "ja";
  return "en";
}

function readServerLanguage(): string {
  return "en";
}

type TranslateVars = Record<string, string | number>;

interface I18nContextValue {
  lang: Language;
  dir: "rtl" | "ltr";
  setLang: (lang: Language) => void;
  t: (key: TranslationKey, vars?: TranslateVars) => string;
}

const I18nContext = React.createContext<I18nContextValue | null>(null);

function interpolate(template: string, vars?: TranslateVars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : match,
  );
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const stored = React.useSyncExternalStore(
    subscribe,
    readStoredLanguage,
    readServerLanguage,
  );
  const lang: Language = normalize(stored) ?? "en";

  const setLang = React.useCallback((next: Language) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // storage unavailable — still switch for this session
    }
    notify();
  }, []);

  // Synchronize the document with the language (external system): lang + dir.
  React.useEffect(() => {
    const root = document.documentElement;
    root.lang = lang;
    root.dir = directionOf(lang);
  }, [lang]);

  const value = React.useMemo<I18nContextValue>(() => {
    const dict = dictionaries[lang];
    return {
      lang,
      dir: directionOf(lang),
      setLang,
      t: (key, vars) => interpolate(dict[key] ?? en[key] ?? key, vars),
    };
  }, [lang, setLang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = React.useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside <LanguageProvider>");
  return ctx;
}

export type { TranslationKey };
