import type { Locale } from "./config";

export type LocalizedText = {
  zh: string;
  en: string;
};

export function text(zh: string, en: string): LocalizedText {
  return { zh, en };
}

export function pickText(locale: Locale, value: LocalizedText): string {
  return value[locale];
}

export function localeTag(locale: Locale): string {
  return locale === "zh" ? "zh-CN" : "en-US";
}
