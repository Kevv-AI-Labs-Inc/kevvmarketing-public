export type Locale = "zh" | "en";

export const DEFAULT_LOCALE: Locale = "zh";
export const LOCALE_STORAGE_KEY = "kevv-locale";
export const LOCALE_COOKIE_NAME = "kevv-locale";

export function isLocale(value: unknown): value is Locale {
  return value === "zh" || value === "en";
}
