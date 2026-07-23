import Link from "next/link";
import {
  ArrowRight,
  Building2,
  Check,
  Compass,
  FileText,
  Globe,
  Mail,
  MapPin,
  MessageCircle,
  Navigation,
  Plane,
  Search,
  Share2,
  Sparkles,
  Zap,
} from "lucide-react";

import { LandingHeader } from "@/components/LandingHeader";
import { ViewportReveal, RevealChild } from "@/components/motion/ViewportReveal";
import { SpringHoverCard } from "@/components/motion/SpringHoverCard";
import { PulseIndicator } from "@/components/motion/PulseIndicator";
import { getLandingPageCopy } from "@/i18n/landing-copy";
import { getRequestLocale } from "@/i18n/server";
import { siteConfig } from "@/lib/site";

const pillarIcons = {
  "ai-engine": Sparkles,
  "cross-border": Globe,
  intelligence: Search,
} as const;

const toolIcons = {
  "content-factory": Sparkles,
  "flyer-studio": FileText,
  "magic-share": Share2,
  "showing-tour": Navigation,
  ads: Zap,
  drip: Mail,
  neighborhood: MapPin,
  "listing-management": Building2,
  wechat: MessageCircle,
  cultural: Compass,
  "cross-border-tools": Plane,
} as const;

const crossBorderIcons = {
  wechat: MessageCircle,
  cultural: Compass,
  campaigns: Plane,
  "bilingual-ai": Sparkles,
} as const;

/* ── Bento layout config ────────────────────────────────────
   Asymmetric grid: featured tools span 2 cols, others 1 col.
   Avoids the banned "3 equal card" pattern (§7 Rule).
   ────────────────────────────────────────────────────────── */
const featuredToolIds = new Set([
  "content-factory",
  "showing-tour",
]);

export default async function HomePage() {
  const locale = await getRequestLocale();
  const copy = getLandingPageCopy(locale);

  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      {/* ── Header ─────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-border/60 bg-card/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 md:px-8">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground shadow-sm">
              {siteConfig.mark}
            </div>
            <div className="flex flex-col leading-none">
              <span className="font-serif text-lg tracking-tight">{siteConfig.shortName}</span>
              <span className="-mt-0.5 text-[9px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Marketing
              </span>
            </div>
          </div>
          <LandingHeader
            signIn={copy.header.signIn}
            getStartedShort={copy.header.getStartedShort}
          />
        </div>
      </header>

      {/* ── Hero — Split Screen ────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute left-[-8rem] top-[-12rem] h-[40rem] w-[40rem] rounded-full bg-primary/10 blur-[140px]" />
          <div className="absolute right-[-6rem] top-[8rem] h-[28rem] w-[28rem] rounded-full bg-accent/20 blur-[120px]" />
          <div className="absolute bottom-0 left-1/3 h-[24rem] w-[24rem] rounded-full bg-secondary/30 blur-[100px]" />
        </div>

        <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 pb-16 pt-16 md:px-8 md:pb-24 md:pt-24 lg:grid-cols-[1.1fr_0.9fr] lg:gap-20">
          {/* Left — text block */}
          <ViewportReveal>
            <RevealChild>
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-semibold text-primary">
                <PulseIndicator color="oklch(0.50 0.09 65)" size={6} />
                {copy.hero.badge}
              </div>
            </RevealChild>

            <RevealChild>
              <h1 className="mt-8 text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl lg:text-[3.5rem]">
                {copy.hero.line1}{" "}
                <span className="bg-gradient-to-r from-primary via-accent-foreground to-primary bg-clip-text text-transparent">
                  {copy.hero.line2}
                </span>
                <br />
                <span className="text-muted-foreground">{copy.hero.line3}</span>
              </h1>
            </RevealChild>

            <RevealChild>
              <p className="mt-6 max-w-lg text-lg leading-relaxed text-muted-foreground">{copy.hero.body}</p>
            </RevealChild>

            <RevealChild>
              <div className="mt-10 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-7 py-3 text-base font-semibold text-primary-foreground shadow-md transition-all [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] hover:brightness-110 active:scale-[0.98]"
                >
                  {copy.hero.primaryCta} <ArrowRight className="h-4 w-4" />
                </Link>
                <a
                  href={siteConfig.projectUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-7 py-3 text-base font-semibold shadow-sm transition-all [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] hover:bg-accent active:scale-[0.98]"
                >
                  {copy.hero.secondaryCta}
                </a>
              </div>
            </RevealChild>
          </ViewportReveal>

          {/* Right — stats grid */}
          <ViewportReveal className="grid grid-cols-3 gap-4" delay={0.2}>
            {copy.stats.map((stat, i) => (
              <SpringHoverCard
                key={stat.label}
                index={i}
                className="rounded-2xl border border-border bg-card p-6 shadow-glass"
              >
                <div className="text-3xl font-bold tracking-tight text-primary sm:text-4xl">{stat.value}</div>
                <div className="mt-2 text-xs font-medium leading-snug text-muted-foreground sm:text-sm">{stat.label}</div>
              </SpringHoverCard>
            ))}
          </ViewportReveal>
        </div>
      </section>

      {/* ── Pillars — Asymmetric Grid ─────────────────────── */}
      <section className="border-t border-border bg-card py-20 md:py-28">
        <div className="mx-auto max-w-7xl px-5 md:px-8">
          <ViewportReveal>
            <RevealChild className="max-w-xl">
              <p className="text-sm font-semibold uppercase tracking-wider text-primary">{copy.whyKevv.eyebrow}</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">{copy.whyKevv.title}</h2>
            </RevealChild>
          </ViewportReveal>

          <ViewportReveal className="mt-16 grid gap-6 lg:grid-cols-2">
            {copy.pillars.map((pillar, i) => {
              const Icon = pillarIcons[pillar.id];
              const isFirst = i === 0;
              return (
                <SpringHoverCard
                  key={pillar.id}
                  index={i}
                  className={`group relative rounded-2xl border border-border bg-background p-8 shadow-soft ${isFirst ? "lg:col-span-2" : ""}`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${pillar.gradient} text-white shadow-sm`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <span className="inline-block rounded-full border border-border bg-secondary px-2.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
                        {pillar.badge}
                      </span>
                      <h3 className="mt-3 text-xl font-bold tracking-tight">{pillar.title}</h3>
                      <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">{pillar.body}</p>
                    </div>
                  </div>
                </SpringHoverCard>
              );
            })}
          </ViewportReveal>
        </div>
      </section>

      {/* ── Toolkit — Asymmetric Bento Grid ────────────────── */}
      <section className="border-t border-border py-20 md:py-28">
        <div className="mx-auto max-w-7xl px-5 md:px-8">
          <ViewportReveal>
            <RevealChild className="max-w-xl">
              <p className="text-sm font-semibold uppercase tracking-wider text-primary">{copy.toolkit.eyebrow}</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">{copy.toolkit.title}</h2>
              <p className="mt-4 text-muted-foreground">{copy.toolkit.body}</p>
            </RevealChild>
          </ViewportReveal>

          <ViewportReveal className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {copy.tools.map((tool, i) => {
              const Icon = toolIcons[tool.id];
              const isFeatured = featuredToolIds.has(tool.id);
              return (
                <SpringHoverCard
                  key={tool.id}
                  index={i}
                  className={`group flex items-start gap-4 rounded-xl border border-border bg-card p-5 shadow-sm transition-colors [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] hover:border-primary/30 ${isFeatured ? "sm:col-span-2" : ""}`}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/8 text-primary transition-all [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] group-hover:bg-primary group-hover:text-primary-foreground">
                    <Icon className="h-4.5 w-4.5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold">{tool.name}</h3>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">{tool.desc}</p>
                  </div>
                </SpringHoverCard>
              );
            })}
          </ViewportReveal>
        </div>
      </section>

      {/* ── Cross-Border ──────────────────────────────────── */}
      <section className="border-t border-border bg-card py-20 md:py-28">
        <ViewportReveal className="mx-auto grid max-w-7xl items-center gap-12 px-5 md:px-8 lg:grid-cols-2">
          <div>
            <RevealChild>
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-semibold text-primary">
                <Globe className="h-3.5 w-3.5" />
                {copy.crossBorder.badge}
              </div>
            </RevealChild>
            <RevealChild>
              <h2 className="mt-6 text-3xl font-bold tracking-tight sm:text-4xl">
                {copy.crossBorder.titlePrefix}
                <br />
                <span className="text-primary">{copy.crossBorder.titleAccent}</span>{" "}
                {copy.crossBorder.titleSuffix}
              </h2>
            </RevealChild>
            <RevealChild>
              <p className="mt-4 leading-relaxed text-muted-foreground">{copy.crossBorder.body}</p>
            </RevealChild>
            <RevealChild>
              <ul className="mt-6 space-y-3">
                {copy.crossBorderChecklist.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Check className="h-3 w-3" strokeWidth={2.5} />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </RevealChild>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {copy.crossBorderCards.map((card, i) => {
              const Icon = crossBorderIcons[card.id];
              return (
                <SpringHoverCard
                  key={card.id}
                  index={i}
                  className={`rounded-2xl border p-6 ${card.color} shadow-sm`}
                >
                  <Icon className="h-6 w-6" />
                  <h3 className="mt-3 text-sm font-bold">{card.title}</h3>
                  <p className="mt-1.5 text-xs leading-5 opacity-80">{card.desc}</p>
                </SpringHoverCard>
              );
            })}
          </div>
        </ViewportReveal>
      </section>

      {/* ── Closing CTA — Split Layout (not centered) ──────── */}
      <section className="border-t border-border py-20 md:py-24">
        <ViewportReveal className="mx-auto grid max-w-7xl items-center gap-12 px-5 md:px-8 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <RevealChild>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{copy.closing.title}</h2>
            </RevealChild>
            <RevealChild>
              <p className="mt-4 max-w-lg leading-relaxed text-muted-foreground">{copy.closing.body}</p>
            </RevealChild>
            <RevealChild>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-8 py-3.5 text-base font-semibold text-primary-foreground shadow-md transition-all [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] hover:brightness-110 active:scale-[0.98]"
                >
                  {copy.closing.primaryCta} <ArrowRight className="h-4 w-4" />
                </Link>
                <a
                  href={`mailto:${siteConfig.supportEmail}`}
                  className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-8 py-3.5 text-base font-semibold shadow-sm transition-all [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] hover:bg-accent active:scale-[0.98]"
                >
                  {copy.closing.secondaryCta}
                </a>
              </div>
            </RevealChild>
          </div>

          {/* Right — visual accent: summary stat strip */}
          <div className="hidden lg:flex lg:flex-col lg:items-end lg:gap-6">
            <div className="flex flex-col gap-4">
              {copy.stats.map((stat, i) => (
                <SpringHoverCard
                  key={stat.label}
                  index={i}
                  className="flex items-center gap-4 rounded-2xl border border-border bg-card px-6 py-4 shadow-glass"
                >
                  <span className="text-2xl font-bold tracking-tight text-primary">{stat.value}</span>
                  <span className="text-sm text-muted-foreground">{stat.label}</span>
                </SpringHoverCard>
              ))}
            </div>
          </div>
        </ViewportReveal>
      </section>

      {/* ── Footer ────────────────────────────────────────── */}
      <footer className="border-t border-border bg-card py-10">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-6 px-5 md:flex-row md:justify-between md:px-8">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">
              {siteConfig.mark}
            </div>
            <span className="text-sm font-semibold">{siteConfig.companyName}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} {siteConfig.companyName}. {copy.footer.rights}
          </p>
          <div className="flex gap-6 text-sm text-muted-foreground">
            <Link href="/privacy" className="transition hover:text-foreground">
              {copy.footer.privacy}
            </Link>
            <Link href="/terms" className="transition hover:text-foreground">
              {copy.footer.terms}
            </Link>
            <a
              href={siteConfig.projectUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="transition hover:text-foreground"
            >
              {siteConfig.projectLabel}
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
