import { getLocalizedText, type LocalizedText } from "./messages";
import type { Locale } from "./config";

export type { LocalizedText };

export function text(zh: string, en: string): LocalizedText {
  return { zh, en };
}

export function pickText(locale: Locale, value: LocalizedText): string {
  return getLocalizedText(locale, value);
}

export function localeTag(locale: Locale): string {
  return locale === "zh" ? "zh-CN" : "en-US";
}
