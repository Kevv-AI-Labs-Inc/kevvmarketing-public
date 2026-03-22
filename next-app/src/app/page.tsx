import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Building2,
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

import { LocaleToggleButton } from "@/components/LocaleToggleButton";
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
  "cma-studio": BarChart3,
  "smart-match": Search,
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

export default async function HomePage() {
  const locale = await getRequestLocale();
  const copy = getLandingPageCopy(locale);

  return (
    <div className="min-h-screen bg-background text-foreground">
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
          <div className="flex items-center gap-3">
            <LocaleToggleButton variant="ghost" />
            <Link
              href="/login"
              className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium shadow-sm transition hover:bg-accent"
            >
              {copy.header.signIn}
            </Link>
            <Link
              href="/login"
              className="hidden rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition hover:brightness-110 sm:inline-flex"
            >
              {copy.header.getStartedShort}
            </Link>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute left-1/2 top-[-16rem] h-[40rem] w-[40rem] -translate-x-1/2 rounded-full bg-amber-200/20 blur-[140px]" />
          <div className="absolute right-[-8rem] top-[6rem] h-[28rem] w-[28rem] rounded-full bg-orange-200/15 blur-[120px]" />
          <div className="absolute bottom-0 left-[-6rem] h-[24rem] w-[24rem] rounded-full bg-yellow-100/15 blur-[100px]" />
        </div>

        <div className="mx-auto max-w-5xl px-5 pb-16 pt-16 text-center md:px-8 md:pb-20 md:pt-24">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-semibold text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            {copy.hero.badge}
          </div>

          <h1 className="mt-8 text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">
            {copy.hero.line1}{" "}
            <span className="bg-gradient-to-r from-amber-600 via-orange-500 to-amber-700 bg-clip-text text-transparent">
              {copy.hero.line2}
            </span>
            <br />
            <span className="text-muted-foreground">{copy.hero.line3}</span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">{copy.hero.body}</p>

          <div className="mx-auto mt-10 flex max-w-lg items-center justify-center gap-8 sm:gap-12">
            {copy.stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-3xl font-bold tracking-tight text-primary sm:text-4xl">{stat.value}</div>
                <div className="mt-1 text-xs font-medium text-muted-foreground sm:text-sm">{stat.label}</div>
              </div>
            ))}
          </div>

          <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-7 py-3 text-base font-semibold text-primary-foreground shadow-md transition hover:brightness-110"
            >
              {copy.hero.primaryCta} <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href={siteConfig.projectUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-7 py-3 text-base font-semibold shadow-sm transition hover:bg-accent"
            >
              {copy.hero.secondaryCta}
            </a>
          </div>
        </div>
      </section>

      <section className="border-t border-border bg-card py-20 md:py-28">
        <div className="mx-auto max-w-7xl px-5 md:px-8">
          <div className="text-center">
            <p className="text-sm font-semibold uppercase tracking-wider text-primary">{copy.whyKevv.eyebrow}</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">{copy.whyKevv.title}</h2>
          </div>

          <div className="mt-16 grid gap-8 lg:grid-cols-3">
            {copy.pillars.map((pillar) => {
              const Icon = pillarIcons[pillar.id];
              return (
                <div
                  key={pillar.id}
                  className="group relative rounded-2xl border border-border bg-background p-8 shadow-soft transition hover:shadow-elevated"
                >
                  <div className={`inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${pillar.gradient} text-white shadow-sm`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="ml-3 inline-block rounded-full border border-border bg-secondary px-2.5 py-0.5 align-top text-[11px] font-semibold text-muted-foreground">
                    {pillar.badge}
                  </span>
                  <h3 className="mt-5 text-xl font-bold tracking-tight">{pillar.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{pillar.body}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="border-t border-border py-20 md:py-28">
        <div className="mx-auto max-w-7xl px-5 md:px-8">
          <div className="text-center">
            <p className="text-sm font-semibold uppercase tracking-wider text-primary">{copy.toolkit.eyebrow}</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">{copy.toolkit.title}</h2>
            <p className="mx-auto mt-4 max-w-xl text-muted-foreground">{copy.toolkit.body}</p>
          </div>

          <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {copy.tools.map((tool) => {
              const Icon = toolIcons[tool.id];
              return (
                <div
                  key={tool.id}
                  className="group flex items-start gap-4 rounded-xl border border-border bg-card p-5 shadow-sm transition hover:border-primary/30 hover:shadow-soft"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/8 text-primary transition group-hover:bg-primary group-hover:text-primary-foreground">
                    <Icon className="h-4.5 w-4.5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold">{tool.name}</h3>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">{tool.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="border-t border-border bg-card py-20 md:py-28">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 md:px-8 lg:grid-cols-2">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
              <Globe className="h-3.5 w-3.5" />
              {copy.crossBorder.badge}
            </div>
            <h2 className="mt-6 text-3xl font-bold tracking-tight sm:text-4xl">
              {copy.crossBorder.titlePrefix}
              <br />
              <span className="text-primary">{copy.crossBorder.titleAccent}</span>{" "}
              {copy.crossBorder.titleSuffix}
            </h2>
            <p className="mt-4 leading-relaxed text-muted-foreground">{copy.crossBorder.body}</p>
            <ul className="mt-6 space-y-3">
              {copy.crossBorderChecklist.map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm">
                  <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs text-primary">
                    ✓
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {copy.crossBorderCards.map((card) => {
              const Icon = crossBorderIcons[card.id];
              return (
                <div key={card.id} className={`rounded-2xl border p-6 ${card.color} shadow-sm transition hover:shadow-md`}>
                  <Icon className="h-6 w-6" />
                  <h3 className="mt-3 text-sm font-bold">{card.title}</h3>
                  <p className="mt-1.5 text-xs leading-5 opacity-80">{card.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="border-t border-border py-20 md:py-24">
        <div className="mx-auto max-w-3xl px-5 text-center md:px-8">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{copy.closing.title}</h2>
          <p className="mx-auto mt-4 max-w-lg text-muted-foreground">{copy.closing.body}</p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-8 py-3.5 text-base font-semibold text-primary-foreground shadow-md transition hover:brightness-110"
            >
              {copy.closing.primaryCta} <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href={`mailto:${siteConfig.supportEmail}`}
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-8 py-3.5 text-base font-semibold shadow-sm transition hover:bg-accent"
            >
              {copy.closing.secondaryCta}
            </a>
          </div>
        </div>
      </section>

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
