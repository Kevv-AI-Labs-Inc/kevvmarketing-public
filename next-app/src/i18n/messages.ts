import type { Locale } from "./config";

import zh from "./locales/zh.json";
import en from "./locales/en.json";

export type Messages = typeof zh;
export type LocalizedText = {
  zh: string;
  en: string;
};

export const LOCALE_MAP: Record<Locale, Messages> = { zh, en };

export function getLocalizedText(locale: Locale, text: LocalizedText): string {
  return text[locale];
}

export function translateMessage(
  locale: Locale,
  key: string,
  vars?: Record<string, string | number>,
): string {
  const messages = LOCALE_MAP[locale];
  const parts = key.split(".");
  let value: unknown = messages;

  for (const part of parts) {
    if (value && typeof value === "object" && part in value) {
      value = (value as Record<string, unknown>)[part];
    } else {
      return key;
    }
  }

  if (typeof value !== "string") return key;

  if (!vars) return value;

  return value.replace(/\{\{(\w+)\}\}/g, (_, varName) =>
    String(vars[varName] ?? `{{${varName}}}`),
  );
}
