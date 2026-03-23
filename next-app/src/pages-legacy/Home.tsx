// legacy page — incrementally migrated
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { pickText } from "@/i18n/copy";
import { dashboardPageCopy } from "@/i18n/dashboard-pages";
import { useT } from "@/i18n";
import {
  dashboardMenuSections,
  getLocalizedText,
  ownerDashboardSection,
} from "@/lib/marketing-capabilities";
import { trpc } from "@/lib/trpc";
import { siteConfig } from "@/lib/site";
import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Building2,
  Clapperboard,
  Share2,
  Sparkles,
} from "lucide-react";

function getGreetingKey(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "dashboard.greeting";
  if (hour < 18) return "dashboard.greetingAfternoon";
  return "dashboard.greetingEvening";
}

function formatSyncStamp(locale: "zh" | "en", raw: string | null | undefined, fallback: string) {
  if (!raw) return fallback;

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return fallback;

  return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function normalizeCount(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string") {
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (typeof raw === "bigint") return Number(raw);
  return null;
}

export default function Home() {
  const { user } = useAuth();
  const { t, locale } = useT();
  const copy = dashboardPageCopy.home;
  const isOwner = user?.role === "admin";

  const { data: statsData, isLoading: isStatsLoading, isError: isStatsError } =
    trpc.mls.getSyncStatus.useQuery(undefined, {
      refetchOnWindowFocus: true,
      refetchInterval: 60_000,
    });

  const propertyCountValue = normalizeCount(statsData?.totalProperties);
  const propertyCount = isStatsLoading || isStatsError ? "—" : (propertyCountValue ?? 0).toLocaleString();
  const lastSyncLabel = formatSyncStamp(
    locale,
    statsData?.lastSyncAt ?? null,
    pickText(locale, copy.stats.syncUnknown),
  );

  const moduleSections = isOwner
    ? [...dashboardMenuSections.filter((section) => section.id !== "overview"), ownerDashboardSection]
    : dashboardMenuSections.filter((section) => section.id !== "overview");

  const inventoryReachCount =
    dashboardMenuSections.find((section) => section.id === "inventory-reach")?.items.length ?? 0;
  const clientFlowCount =
    dashboardMenuSections.find((section) => section.id === "client-flow")?.items.length ?? 0;
  const contentCount = dashboardMenuSections.find((section) => section.id === "content")?.items.length ?? 0;

  const statCards = [
    {
      id: "inventory",
      icon: Building2,
      value: propertyCount,
      title: pickText(locale, copy.stats.inventoryTitle),
      description: pickText(locale, copy.stats.inventoryDescription),
      accent: "border-stone-200/80 bg-white/90",
    },
    {
      id: "reach",
      icon: Share2,
      value: inventoryReachCount.toString(),
      title: pickText(locale, copy.stats.reachTitle),
      description: pickText(locale, copy.stats.reachDescription),
      accent: "border-amber-200/70 bg-amber-50/80",
    },
    {
      id: "presentation",
      icon: Sparkles,
      value: clientFlowCount.toString(),
      title: pickText(locale, copy.stats.presentationTitle),
      description: pickText(locale, copy.stats.presentationDescription),
      accent: "border-sky-200/70 bg-sky-50/85",
    },
    {
      id: "content",
      icon: Clapperboard,
      value: contentCount.toString(),
      title: pickText(locale, copy.stats.contentTitle),
      description: pickText(locale, copy.stats.contentDescription),
      accent: "border-emerald-200/70 bg-emerald-50/80",
    },
  ] as const;

  const workspaceCards = [
    {
      id: "inventory",
      icon: Building2,
      route: "/listings",
      eyebrow: pickText(locale, copy.workspaces.inventory.eyebrow),
      title: pickText(locale, copy.workspaces.inventory.title),
      description: pickText(locale, copy.workspaces.inventory.description),
      actionLabel: pickText(locale, copy.workspaces.inventory.actionLabel),
      modules: copy.workspaces.inventory.modules.map((module) => pickText(locale, module)),
      accent: "from-stone-100 via-white to-stone-50",
    },
    {
      id: "reach",
      icon: Share2,
      route: "/area-magnet",
      eyebrow: pickText(locale, copy.workspaces.reach.eyebrow),
      title: pickText(locale, copy.workspaces.reach.title),
      description: pickText(locale, copy.workspaces.reach.description),
      actionLabel: pickText(locale, copy.workspaces.reach.actionLabel),
      modules: copy.workspaces.reach.modules.map((module) => pickText(locale, module)),
      accent: "from-amber-100 via-white to-orange-50",
    },
    {
      id: "presentation",
      icon: BarChart3,
      route: "/smart-match",
      eyebrow: pickText(locale, copy.workspaces.presentation.eyebrow),
      title: pickText(locale, copy.workspaces.presentation.title),
      description: pickText(locale, copy.workspaces.presentation.description),
      actionLabel: pickText(locale, copy.workspaces.presentation.actionLabel),
      modules: copy.workspaces.presentation.modules.map((module) => pickText(locale, module)),
      accent: "from-sky-100 via-white to-cyan-50",
    },
    {
      id: "content",
      icon: Clapperboard,
      route: "/flyer-studio",
      eyebrow: pickText(locale, copy.workspaces.content.eyebrow),
      title: pickText(locale, copy.workspaces.content.title),
      description: pickText(locale, copy.workspaces.content.description),
      actionLabel: pickText(locale, copy.workspaces.content.actionLabel),
      modules: copy.workspaces.content.modules.map((module) => pickText(locale, module)),
      accent: "from-emerald-100 via-white to-teal-50",
    },
  ] as const;

  return (
    <div className="mx-auto max-w-7xl space-y-6 py-2">
      <section className="relative overflow-hidden rounded-[28px] border border-stone-200/80 bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.18),_transparent_34%),linear-gradient(135deg,_rgba(255,255,255,0.98),_rgba(250,248,244,0.96))] p-6 shadow-sm md:p-8">
        <div className="absolute -right-16 top-0 h-48 w-48 rounded-full bg-amber-200/20 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-32 w-32 rounded-full bg-sky-200/20 blur-3xl" />

        <div className="relative grid gap-8 xl:grid-cols-[1.2fr_0.85fr]">
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="rounded-full border-stone-300/80 bg-white/80 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-stone-700">
                {siteConfig.shortName} · {pickText(locale, copy.heroBadge)}
              </Badge>
              <Badge variant="outline" className="rounded-full border-stone-300/70 bg-white/60 px-3 py-1 text-[11px] text-stone-600">
                {pickText(locale, copy.stats.syncLabel)} · {lastSyncLabel}
              </Badge>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-medium uppercase tracking-[0.28em] text-stone-500">
                {t(getGreetingKey())}，{user?.name || "Agent"}
              </p>
              <h1 className="max-w-4xl text-3xl font-serif tracking-tight text-stone-900 md:text-4xl">
                {pickText(locale, copy.heroTitle)}
              </h1>
              <p className="max-w-3xl text-sm leading-7 text-stone-600 md:text-[15px]">
                {pickText(locale, copy.heroDescription)}
              </p>
              <p className="max-w-3xl text-sm leading-6 text-stone-500">
                {pickText(locale, copy.heroFootnote)}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg" className="rounded-full px-5 shadow-sm">
                <Link href="/listings">
                  {pickText(locale, copy.actions.openListings)}
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="rounded-full border-stone-300 bg-white/80 px-5">
                <Link href="/area-magnet">
                  {pickText(locale, copy.actions.launchShare)}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="ghost" className="rounded-full px-5 text-stone-700 hover:bg-white/80">
                <Link href="/flyer-studio">
                  {pickText(locale, copy.actions.createFlyer)}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>

          <div className="rounded-[24px] border border-stone-200/80 bg-white/75 p-5 backdrop-blur">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-500">
                  {pickText(locale, copy.platformModelTitle)}
                </p>
                <p className="mt-2 text-sm leading-6 text-stone-600">
                  {pickText(locale, copy.platformModelDescription)}
                </p>
              </div>
            </div>
            <div className="space-y-3">
              {copy.platformModel.map((item, index) => (
                <div key={pickText(locale, item.title)} className="rounded-2xl border border-stone-200/70 bg-stone-50/80 p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-stone-900 text-xs font-semibold text-white">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-medium text-stone-900">{pickText(locale, item.title)}</p>
                      <p className="mt-1 text-sm leading-6 text-stone-600">
                        {pickText(locale, item.description)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {statCards.map((card) => (
          <Card key={card.id} className={`rounded-[24px] border ${card.accent} shadow-sm`}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-500">
                    {card.title}
                  </p>
                  <p className="text-3xl font-semibold tracking-tight text-stone-900 tabular-nums">
                    {card.value}
                  </p>
                </div>
                <div className="rounded-2xl bg-white/80 p-3 text-stone-700 shadow-sm">
                  <card.icon className="h-5 w-5" />
                </div>
              </div>
              <p className="mt-3 text-sm leading-6 text-stone-600">{card.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="rounded-[28px] border-stone-200/80 bg-white/95 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl text-stone-900">
              {pickText(locale, copy.workspacesTitle)}
            </CardTitle>
            <CardDescription className="text-sm leading-6 text-stone-600">
              {pickText(locale, copy.workspacesDescription)}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {workspaceCards.map((card) => (
              <div
                key={card.id}
                className={`rounded-[24px] border border-stone-200/70 bg-gradient-to-br ${card.accent} p-5 shadow-sm`}
              >
                <div className="flex items-center justify-between gap-3">
                  <Badge variant="outline" className="rounded-full border-stone-300 bg-white/70 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-stone-600">
                    {card.eyebrow}
                  </Badge>
                  <div className="rounded-2xl bg-white/80 p-2.5 text-stone-700 shadow-sm">
                    <card.icon className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  <h3 className="text-lg font-semibold tracking-tight text-stone-900">{card.title}</h3>
                  <p className="text-sm leading-6 text-stone-600">{card.description}</p>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {card.modules.map((module) => (
                    <span
                      key={module}
                      className="rounded-full border border-stone-300/70 bg-white/80 px-3 py-1 text-xs text-stone-700"
                    >
                      {module}
                    </span>
                  ))}
                </div>
                <div className="mt-5">
                  <Button asChild variant="ghost" className="h-auto rounded-full px-0 text-stone-900 hover:bg-transparent">
                    <Link href={card.route}>
                      {card.actionLabel}
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="rounded-[28px] border-stone-200/80 bg-stone-950 text-stone-50 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl text-white">{pickText(locale, copy.moduleGroupsTitle)}</CardTitle>
            <CardDescription className="text-sm leading-6 text-stone-300">
              {pickText(locale, copy.moduleGroupsDescription)}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {moduleSections.map((section) => (
              <div key={section.id} className="rounded-[22px] border border-white/10 bg-white/5 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {getLocalizedText(locale, section.label)}
                    </p>
                    <p className="mt-1 text-xs uppercase tracking-[0.24em] text-stone-400">
                      {section.items.length} {locale === "zh" ? "个模块" : "modules"}
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  {section.items.map((item) => (
                    <Link
                      key={item.path}
                      href={item.path}
                      className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/15 px-3 py-2.5 text-sm text-stone-100 transition-colors hover:bg-black/30"
                    >
                      <span className="flex items-center gap-2">
                        <item.icon className="h-4 w-4 text-stone-300" />
                        {getLocalizedText(locale, item.label)}
                      </span>
                      <ArrowUpRight className="h-4 w-4 text-stone-400" />
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
