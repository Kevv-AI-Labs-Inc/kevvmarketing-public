import { brandConfig } from "@/lib/brand";

import type { Locale } from "./config";
import { createTranslator } from "./messages";

const pillarConfig = [
  { id: "ai-engine", key: "aiEngine", gradient: "from-amber-500 to-orange-600" },
  { id: "cross-border", key: "crossBorder", gradient: "from-blue-500 to-cyan-600" },
  { id: "intelligence", key: "intelligence", gradient: "from-emerald-500 to-teal-600" },
] as const;

const toolConfig = [
  { id: "content-factory", key: "contentFactory" },
  { id: "flyer-studio", key: "flyerStudio" },
  { id: "cma-studio", key: "cmaStudio" },
  { id: "smart-match", key: "smartMatch" },
  { id: "magic-share", key: "magicShare" },
  { id: "showing-tour", key: "showingTour" },
  { id: "ads", key: "ads" },
  { id: "drip", key: "drip" },
  { id: "neighborhood", key: "neighborhood" },
  { id: "listing-management", key: "listingManagement" },
  { id: "wechat", key: "wechat" },
  { id: "cultural", key: "cultural" },
  { id: "cross-border-tools", key: "crossBorderTools" },
] as const;

const crossBorderCardConfig = [
  {
    id: "wechat",
    key: "wechat",
    color: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  {
    id: "cultural",
    key: "cultural",
    color: "bg-amber-50 text-amber-700 border-amber-200",
  },
  {
    id: "campaigns",
    key: "campaigns",
    color: "bg-blue-50 text-blue-700 border-blue-200",
  },
  {
    id: "bilingual-ai",
    key: "bilingualAi",
    color: "bg-purple-50 text-purple-700 border-purple-200",
  },
] as const;

const statsConfig = [
  { value: "10×", key: "fasterContent" },
  { value: "13+", key: "integratedTools" },
  { value: "2", key: "languages" },
] as const;

const checklistKeys = ["wechat", "descriptions", "bilingual", "matching"] as const;

export function getLandingPageCopy(locale: Locale) {
  const t = createTranslator(locale);
  const brandVars = { appName: brandConfig.appName, shortName: brandConfig.shortName };

  return {
    pillars: pillarConfig.map((pillar) => ({
      id: pillar.id,
      badge: t(`landing.pillars.${pillar.key}.badge`),
      title: t(`landing.pillars.${pillar.key}.title`),
      body: t(`landing.pillars.${pillar.key}.body`),
      gradient: pillar.gradient,
    })),
    tools: toolConfig.map((tool) => ({
      id: tool.id,
      name: t(`landing.tools.${tool.key}.name`),
      desc: t(`landing.tools.${tool.key}.desc`),
    })),
    stats: statsConfig.map((stat) => ({
      value: stat.value,
      label: t(`landing.stats.${stat.key}`),
    })),
    crossBorderChecklist: checklistKeys.map((key) =>
      t(`landing.crossBorderChecklist.${key}`),
    ),
    crossBorderCards: crossBorderCardConfig.map((card) => ({
      id: card.id,
      title: t(`landing.crossBorderCards.${card.key}.title`),
      desc: t(`landing.crossBorderCards.${card.key}.desc`),
      color: card.color,
    })),
    header: {
      signIn: t("landing.header.signIn"),
      getStartedShort: t("landing.header.getStartedShort"),
    },
    hero: {
      badge: t("landing.hero.badge"),
      line1: t("landing.hero.line1"),
      line2: t("landing.hero.line2"),
      line3: t("landing.hero.line3"),
      body: t("landing.hero.body", brandVars),
      primaryCta: t("landing.hero.primaryCta"),
      secondaryCta: t("landing.hero.secondaryCta"),
    },
    whyKevv: {
      eyebrow: t("landing.whyKevv.eyebrow"),
      title: t("landing.whyKevv.title"),
    },
    toolkit: {
      eyebrow: t("landing.toolkit.eyebrow"),
      title: t("landing.toolkit.title"),
      body: t("landing.toolkit.body"),
    },
    crossBorder: {
      badge: t("landing.crossBorder.badge"),
      titlePrefix: t("landing.crossBorder.titlePrefix"),
      titleAccent: t("landing.crossBorder.titleAccent"),
      titleSuffix: t("landing.crossBorder.titleSuffix"),
      body: t("landing.crossBorder.body", brandVars),
    },
    closing: {
      title: t("landing.closing.title"),
      body: t("landing.closing.body"),
      primaryCta: t("landing.closing.primaryCta"),
      secondaryCta: t("landing.closing.secondaryCta"),
    },
    footer: {
      rights: t("landing.footer.rights"),
      privacy: t("landing.footer.privacy"),
      terms: t("landing.footer.terms"),
    },
  };
}
