import type { Locale } from "./config";

import zh from "./locales/zh.json";
import en from "./locales/en.json";

export type Messages = typeof zh;
interface MessageTree {
  [key: string]: string | MessageTree;
}
type StringKeyOf<T> = Extract<keyof T, string>;
type DotJoin<Left extends string, Right extends string> = Right extends ""
  ? Left
  : `${Left}.${Right}`;
type LeafPaths<T> = T extends string
  ? ""
  : {
      [Key in StringKeyOf<T>]: T[Key] extends string
        ? Key
        : T[Key] extends Record<string, unknown>
          ? DotJoin<Key, LeafPaths<T[Key]>>
          : never;
    }[StringKeyOf<T>];

export type MessageKey = Exclude<LeafPaths<Messages>, "">;

export const LOCALE_MAP: Record<Locale, Messages> = { zh, en };

function collectLeafPaths(tree: MessageTree, prefix = ""): string[] {
  return Object.entries(tree).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") {
      return [path];
    }
    return collectLeafPaths(value, path);
  });
}

function validateLocaleCatalogShape() {
  if (process.env.NODE_ENV === "production") {
    return;
  }

  const zhKeys = collectLeafPaths(zh as MessageTree);
  const enKeys = collectLeafPaths(en as MessageTree);
  const zhOnly = zhKeys.filter((key) => !enKeys.includes(key));
  const enOnly = enKeys.filter((key) => !zhKeys.includes(key));

  if (zhOnly.length === 0 && enOnly.length === 0) {
    return;
  }

  throw new Error(
    [
      "Locale catalogs are out of sync.",
      zhOnly.length > 0 ? `Missing in en.json: ${zhOnly.join(", ")}` : "",
      enOnly.length > 0 ? `Missing in zh.json: ${enOnly.join(", ")}` : "",
    ]
      .filter(Boolean)
      .join(" "),
  );
}

validateLocaleCatalogShape();

function lookupMessage(locale: Locale, key: MessageKey): string | null {
  const messages = LOCALE_MAP[locale] as unknown as MessageTree;
  const parts = key.split(".");
  let value: unknown = messages;

  for (const part of parts) {
    if (value && typeof value === "object" && part in (value as Record<string, unknown>)) {
      value = (value as Record<string, unknown>)[part];
      continue;
    }
    return null;
  }

  return typeof value === "string" ? value : null;
}

function formatVars(
  template: string,
  vars?: Record<string, string | number>,
): string {
  if (!vars) {
    return template;
  }

  return template.replace(/\{\{(\w+)\}\}/g, (_, varName) =>
    String(vars[varName] ?? `{{${varName}}}`),
  );
}

export function translateMessage(
  locale: Locale,
  key: MessageKey,
  vars?: Record<string, string | number>,
): string {
  const value = lookupMessage(locale, key);
  if (value === null) {
    throw new Error(`Missing i18n message: ${locale}.${key}`);
  }

  return formatVars(value, vars);
}

export function createTranslator(locale: Locale) {
  return (key: MessageKey, vars?: Record<string, string | number>) =>
    translateMessage(locale, key, vars);
}
