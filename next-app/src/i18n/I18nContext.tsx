"use client";

/**
 * i18n — lightweight internationalization via React Context.
 *
 * Usage:
 *   const { t, locale, setLocale } = useT();
 *   t("sidebar.overview") → "概览" / "Overview"
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import {
  DEFAULT_LOCALE,
  isLocale,
  LOCALE_COOKIE_NAME,
  LOCALE_STORAGE_KEY,
  type Locale,
} from "./config";
import { translateMessage, type MessageKey } from "./messages";

// ─── Types ─────────────────────────────────────────────────

// ─── Context ───────────────────────────────────────────────

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: MessageKey, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

// ─── Provider ──────────────────────────────────────────────

export function I18nProvider({
  children,
  defaultLocale = DEFAULT_LOCALE,
}: {
  children: ReactNode;
  defaultLocale?: Locale;
}) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    try {
      // 1. Explicit user preference from localStorage
      const saved = localStorage.getItem(LOCALE_STORAGE_KEY);
      if (isLocale(saved)) return saved;

      // 2. Browser / device language
      const browserLang = navigator.language?.toLowerCase() ?? "";
      if (browserLang.startsWith("zh")) return "zh";
      if (browserLang.startsWith("en")) return "en";
    } catch { /* noop — SSR or restricted environment */ }
    return defaultLocale;
  });

  useEffect(() => {
    setLocaleState(defaultLocale);
  }, [defaultLocale]);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, newLocale);
    } catch { /* noop */ }

    document.cookie = `${LOCALE_COOKIE_NAME}=${newLocale}; path=/; max-age=31536000; samesite=lax`;
  }, []);

  // Set html lang attribute for accessibility
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const t = useCallback(
    (key: MessageKey, vars?: Record<string, string | number>): string => {
      return translateMessage(locale, key, vars);
    },
    [locale],
  );

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

// ─── Hook ──────────────────────────────────────────────────

export function useT(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useT must be used within <I18nProvider>");
  return ctx;
}

export type { Messages } from "./messages";
