import { brandConfig } from "@/lib/brand";

import type { Locale } from "./config";
import { createTranslator, type MessageKey } from "./messages";

export type LegalPageId = "privacy" | "terms";

export type LegalSectionCopy = {
  heading: string;
  paragraphs: string[];
};

export type LegalPageCopy = {
  eyebrow: string;
  title: string;
  summary: string;
  updatedAt: string;
  sections: LegalSectionCopy[];
  homeLabel: string;
  loginLabel: string;
};

const legalSectionOrder: Record<LegalPageId, readonly string[]> = {
  privacy: ["collect", "usage", "vendors", "retention"],
  terms: ["accounts", "acceptableUse", "aiContent", "liability", "contact"],
};

export function getLegalPageCopy(locale: Locale, page: LegalPageId): LegalPageCopy {
  const t = createTranslator(locale);
  const vars = {
    appName: brandConfig.appName,
    supportEmail: brandConfig.supportEmail,
  };

  return {
    eyebrow: t(`legal.${page}.eyebrow`),
    title: t(`legal.${page}.title`),
    summary: t(`legal.${page}.summary`, vars),
    updatedAt: t(`legal.${page}.updatedAt`),
    sections: legalSectionOrder[page].map((section) => ({
      heading: t(`legal.${page}.sections.${section}.heading` as MessageKey),
      paragraphs: [
        t(`legal.${page}.sections.${section}.paragraph1` as MessageKey, vars),
        (() => {
          try {
            return t(`legal.${page}.sections.${section}.paragraph2` as MessageKey, vars);
          } catch {
            return null;
          }
        })(),
      ].filter((paragraph): paragraph is string => Boolean(paragraph)),
    })),
    homeLabel: t("legal.terms.homeLabel"),
    loginLabel: t("legal.terms.loginLabel"),
  };
}
