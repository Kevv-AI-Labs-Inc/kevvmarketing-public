// legacy page — incrementally migrated
import { MarketingCapabilityBoard, MarketingExtensionGrid } from "@/components/marketing/MarketingCapabilityBoard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { useT } from "@/i18n";
import {
  getCapabilitiesByCategory,
  getCapabilityCounts,
  getCapabilityStatusLabel,
  getLocalizedText,
  marketingCapabilities,
  marketingCapabilityCategories,
} from "@/lib/marketing-capabilities";
import { trpc } from "@/lib/trpc";
import { siteConfig } from "@/lib/site";
import {
  Building2,
  Database,
  Eye,
  Lightbulb,
  Loader2,
  RefreshCw,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import { useState } from "react";

function getGreetingKey(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "dashboard.greeting";
  if (hour < 18) return "dashboard.greetingAfternoon";
  return "dashboard.greetingEvening";
}

function coverageBadgeClass(status: "ready" | "partial" | "planned") {
  switch (status) {
    case "ready":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "partial":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "planned":
      return "border-slate-200 bg-slate-100 text-slate-700";
  }
}

export default function Home() {
  const { user } = useAuth();
  const { t, locale } = useT();

  const {
    data: statsData,
    refetch: refetchStats,
    isLoading: isStatsLoading,
    isError: isStatsError,
  } = trpc.mls.getSyncStatus.useQuery(undefined, {
    refetchOnWindowFocus: true,
    refetchInterval: 60_000,
  });

  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const triggerSync = trpc.mls.triggerSync.useMutation({
    onMutate: () => setSyncStatus("syncing"),
    onSuccess: (data) => {
      if (!data.success) setSyncStatus("error");
      else if (data.started) setSyncStatus("started");
      else setSyncStatus("syncing");
      if (data.success) refetchStats();
      setTimeout(() => setSyncStatus(null), 4000);
    },
    onError: () => {
      setSyncStatus("error");
      setTimeout(() => setSyncStatus(null), 4000);
    },
  });

  const normalizeCount = (raw: unknown): number | null => {
    if (typeof raw === "number" && Number.isFinite(raw)) return raw;
    if (typeof raw === "string") {
      const parsed = Number(raw);
      return Number.isFinite(parsed) ? parsed : null;
    }
    if (typeof raw === "bigint") return Number(raw);
    return null;
  };

  const propertyCountValue = normalizeCount(statsData?.totalProperties);
  const propertyCount = isStatsLoading
    ? "—"
    : isStatsError
      ? "—"
      : (propertyCountValue ?? 0).toLocaleString();
  const canTriggerSync = statsData?.canTriggerSync ?? false;

  const coverageCounts = getCapabilityCounts();
  const focusItems = marketingCapabilities.filter((item) => item.status !== "ready").slice(0, 4);

  return (
    <div className="mx-auto max-w-7xl space-y-6 py-2">
      <div className="relative overflow-hidden rounded-2xl border border-primary/10 bg-gradient-to-br from-primary/8 via-amber-500/4 to-transparent p-6 md:p-8">
        <div className="absolute right-0 top-0 h-72 w-72 translate-x-1/3 -translate-y-1/2 rounded-full bg-primary/5 blur-3xl" />
        <div className="relative flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-primary">
              <Zap className="h-4 w-4" />
              {siteConfig.name}
            </div>
            <h1 className="text-2xl font-serif md:text-3xl">
              {t(getGreetingKey())}，{user?.name || "Agent"}
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              {locale === "zh"
                ? "我把 Marketing 工作台按你给的十大功能重新归类了：需求项、当前承载模块、覆盖状态和缺口现在都在一张视图里。"
                : "The marketing workbench is now reorganized around your ten requested functions, with requirement mapping, current modules, coverage status, and gaps in one place."}
            </p>
          </div>
          <div className="grid min-w-[260px] grid-cols-3 gap-3 rounded-2xl border border-border/60 bg-background/80 p-4 backdrop-blur">
            {(["ready", "partial", "planned"] as const).map((status) => (
              <div key={status} className="rounded-xl bg-muted/50 p-3 text-center">
                <p className="text-2xl font-semibold tabular-nums">
                  {coverageCounts[status]}
                </p>
                <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                  {getCapabilityStatusLabel(locale, status)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-orange-100 p-2">
                <Lightbulb className="h-4 w-4 text-orange-600" />
              </div>
              <div>
                <CardTitle className="text-base">
                  {locale === "zh" ? "需求对齐概览" : "Requirement Coverage"}
                </CardTitle>
                <CardDescription>
                  {locale === "zh"
                    ? "优先看当前未完全对齐的能力，避免继续堆功能但没有归口。"
                    : "Focus on the functions that are still not fully aligned so the workbench does not drift again."}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {focusItems.map((item) => (
              <div
                key={item.id}
                className="flex items-start gap-3 rounded-xl border border-border/60 bg-muted/25 p-4"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-primary/8 text-primary">
                  <item.icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-foreground">
                      {item.order}. {getLocalizedText(locale, item.label)}
                    </p>
                    <Badge variant="outline" className={`border ${coverageBadgeClass(item.status)}`}>
                      {getCapabilityStatusLabel(locale, item.status)}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {getLocalizedText(locale, item.compareNote)}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-indigo-100 bg-gradient-to-br from-indigo-50/50 to-violet-50/30">
          <CardHeader className="pb-4">
            <CardTitle className="text-base">
              {locale === "zh" ? "能力归类" : "Capability Split"}
            </CardTitle>
            <CardDescription>
              {locale === "zh"
                ? "按需求视角把核心功能拆成三组，首页和侧边栏现在共用同一份定义。"
                : "The core workbench is now grouped into three requirement-oriented domains, shared by both home and sidebar."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {marketingCapabilityCategories.map((category) => {
              const count = getCapabilitiesByCategory(category.id).length;
              return (
                <div
                  key={category.id}
                  className="rounded-xl border border-border/60 bg-background/70 p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium">
                      {getLocalizedText(locale, category.label)}
                    </p>
                    <Badge variant="outline">{count}</Badge>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {getLocalizedText(locale, category.description)}
                  </p>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card className="border-primary/15 bg-gradient-to-br from-primary/8 to-primary/3">
          <CardContent className="p-4">
            <div className="mb-2 flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              <span className="text-[10px] font-medium uppercase tracking-wider text-primary">
                {locale === "zh" ? "房源池" : "Listings"}
              </span>
            </div>
            <p className="text-2xl font-bold tabular-nums text-primary">{propertyCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="mb-2 flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                {locale === "zh" ? "已到位能力" : "Ready"}
              </span>
            </div>
            <p className="text-2xl font-bold tabular-nums">{coverageCounts.ready}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="mb-2 flex items-center gap-2">
              <Eye className="h-4 w-4 text-muted-foreground" />
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                {locale === "zh" ? "适配中" : "Adapted"}
              </span>
            </div>
            <p className="text-2xl font-bold tabular-nums">{coverageCounts.partial}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="mb-2 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                {locale === "zh" ? "待补齐" : "Planned"}
              </span>
            </div>
            <p className="text-2xl font-bold tabular-nums">{coverageCounts.planned}</p>
          </CardContent>
        </Card>
      </div>

      <Card
        className={`transition-all duration-300 ${syncStatus === "started"
          ? "bg-emerald-50/50 ring-2 ring-emerald-500/30"
          : syncStatus === "syncing"
            ? "ring-2 ring-primary/30"
            : syncStatus === "error"
              ? "bg-red-50/50 ring-2 ring-red-500/30"
              : ""
          }`}
      >
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-muted p-2">
                <Database className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">MLS Grid · OneKey</p>
                <p className="text-xs text-muted-foreground">
                  {propertyCount} {locale === "zh" ? "套房源已同步" : "listings synced"}
                </p>
              </div>
            </div>
            <Button
              variant={syncStatus === "syncing" ? "default" : "outline"}
              size="sm"
              className={`h-8 px-3 ${syncStatus === "syncing" || !canTriggerSync ? "pointer-events-none" : ""}`}
              disabled={syncStatus === "syncing" || !canTriggerSync}
              onClick={() => {
                if (!canTriggerSync) return;
                triggerSync.mutate();
              }}
            >
              {syncStatus === "syncing" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              <span className="ml-1.5 text-xs">
                {syncStatus === "syncing"
                  ? locale === "zh"
                    ? "同步中..."
                    : "Syncing..."
                  : locale === "zh"
                    ? "立即同步"
                    : "Sync"}
              </span>
            </Button>
          </div>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-xl font-semibold">
              {locale === "zh" ? "十大核心功能对齐" : "Core Capability Alignment"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {locale === "zh"
                ? "按你给的十项需求，逐项标出当前承载模块、完成度和缺口。"
                : "Each requested function is mapped to its current module, delivery status, and remaining gap."}
            </p>
          </div>
          <Badge variant="outline">
            {coverageCounts.ready}/{coverageCounts.total}{" "}
            {locale === "zh" ? "项已基本到位" : "core functions mostly covered"}
          </Badge>
        </div>
        <MarketingCapabilityBoard locale={locale} />
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-xl font-semibold">
            {locale === "zh" ? "扩展模块" : "Extension Modules"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {locale === "zh"
              ? "这些是现有代码里已经存在、但不在十项核心需求内的补充模块。"
              : "These modules already exist in the codebase and complement the ten primary functions."}
          </p>
        </div>
        <MarketingExtensionGrid locale={locale} />
      </section>
    </div>
  );
}
