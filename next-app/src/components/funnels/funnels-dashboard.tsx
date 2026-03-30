"use client";

import Link from "next/link";
import {
  ArrowRight,
  ExternalLink,
  FileSearch,
  Globe2,
  Home,
  MapPin,
  MessagesSquare,
  Sparkles,
  Users,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useT } from "@/i18n";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { trpc } from "@/lib/trpc";

function getSourceCount(
  sourceBreakdown: Array<{ source: string; count: number }> | undefined,
  source: string,
) {
  return sourceBreakdown?.find((item) => item.source === source)?.count ?? 0;
}

export function FunnelsDashboard() {
  const { t, locale } = useT();
  const profileQuery = trpc.profile.getMine.useQuery();
  const homeValueQuery = trpc.homeValue.getDashboard.useQuery();
  const leadsQuery = trpc.leads.dashboard.useQuery({ limit: 80 });
  const areaMagnetsQuery = trpc.share.listMine.useQuery({ sessionType: "area_magnet" });

  if (
    profileQuery.isLoading ||
    homeValueQuery.isLoading ||
    leadsQuery.isLoading ||
    areaMagnetsQuery.isLoading
  ) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="text-sm text-muted-foreground">{t("funnelsDashboard.loading")}</div>
      </div>
    );
  }

  const profileData = profileQuery.data;
  const homeValueData = homeValueQuery.data;
  const sourceBreakdown = leadsQuery.data?.sourceBreakdown;
  const areaMagnets = areaMagnetsQuery.data ?? [];

  const agentSiteLeadCount =
    getSourceCount(sourceBreakdown, "agent_site_form") +
    getSourceCount(sourceBreakdown, "agent_site_chat");
  const homeValueLeadCount = getSourceCount(sourceBreakdown, "home_value");
  const areaMagnetLeadCount = getSourceCount(sourceBreakdown, "area_magnet");
  const totalFunnelLeads = agentSiteLeadCount + homeValueLeadCount + areaMagnetLeadCount;

  const activeMagnets = areaMagnets.filter((magnet) => magnet.status === "active");
  const totalMagnetViews = areaMagnets.reduce((sum, magnet) => sum + (magnet.viewCount ?? 0), 0);
  const totalMagnetLeads = areaMagnets.reduce((sum, magnet) => sum + (magnet.leadCount ?? 0), 0);
  const liveEntryPoints =
    (profileData?.isPersisted ? 1 : 0) +
    (homeValueData?.publicUrl ? 1 : 0) +
    (activeMagnets.length > 0 ? 1 : 0);

  return (
    <div className="space-y-8 px-6 py-8">
      <section className="rounded-[28px] border border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.18),_transparent_30%),linear-gradient(135deg,_rgba(255,255,255,0.98),_rgba(247,250,252,0.98))] p-6 shadow-sm md:p-8">
        <div className="grid gap-8 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className="rounded-full border-cyan-200 bg-cyan-50 px-3 py-1 text-[11px] uppercase tracking-[0.28em] text-cyan-900"
              >
                {t("funnelsDashboard.badge")}
              </Badge>
              <Badge
                variant="outline"
                className="rounded-full border-slate-200 bg-white px-3 py-1 text-[11px] text-slate-600"
              >
                {t("funnelsDashboard.moduleBadge")}
              </Badge>
            </div>

            <div className="space-y-3">
              <div className="text-xs uppercase tracking-[0.32em] text-slate-500">{t("funnelsDashboard.eyebrow")}</div>
              <h1 className="max-w-4xl text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl">
                {t("funnelsDashboard.heroTitle")}
              </h1>
              <p className="max-w-3xl text-sm leading-7 text-slate-600 md:text-[15px]">
                {t("funnelsDashboard.heroDescription")}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg" className="rounded-full px-5 shadow-sm">
                <Link href="/agent-site">
                  {t("funnelsDashboard.configureAgentSite")}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="rounded-full px-5">
                <Link href="/home-value">
                  {t("funnelsDashboard.tuneHomeValue")}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="ghost" className="rounded-full px-5">
                <Link href="/area-magnet">
                  {t("funnelsDashboard.openAreaMagnetStudio")}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
            <Card className="border-slate-200 bg-white/80 shadow-none">
              <CardContent className="flex items-center gap-4 p-5">
                <div className="rounded-2xl bg-cyan-100 p-3 text-cyan-700">
                  <Globe2 className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">{t("funnelsDashboard.liveEntryPoints")}</div>
                  <div className="text-2xl font-semibold">{liveEntryPoints}</div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-slate-200 bg-white/80 shadow-none">
              <CardContent className="flex items-center gap-4 p-5">
                <div className="rounded-2xl bg-violet-100 p-3 text-violet-700">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">{t("funnelsDashboard.funnelLeads")}</div>
                  <div className="text-2xl font-semibold">{totalFunnelLeads}</div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-slate-200 bg-white/80 shadow-none">
              <CardContent className="flex items-center gap-4 p-5">
                <div className="rounded-2xl bg-amber-100 p-3 text-amber-700">
                  <MapPin className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">{t("funnelsDashboard.areaMagnetViews")}</div>
                  <div className="text-2xl font-semibold">{totalMagnetViews}</div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="rounded-2xl bg-slate-100 p-3 text-slate-700">
              <MessagesSquare className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm text-muted-foreground">{t("funnelsDashboard.agentSiteLeads")}</div>
              <div className="text-2xl font-semibold">{agentSiteLeadCount}</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="rounded-2xl bg-cyan-100 p-3 text-cyan-700">
              <Home className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm text-muted-foreground">{t("funnelsDashboard.homeValueLeads")}</div>
              <div className="text-2xl font-semibold">{homeValueLeadCount}</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="rounded-2xl bg-amber-100 p-3 text-amber-700">
              <MapPin className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm text-muted-foreground">{t("funnelsDashboard.areaMagnetLeads")}</div>
              <div className="text-2xl font-semibold">{areaMagnetLeadCount}</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="rounded-2xl bg-violet-100 p-3 text-violet-700">
              <FileSearch className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm text-muted-foreground">{t("funnelsDashboard.valuationRequests")}</div>
              <div className="text-2xl font-semibold">
                {homeValueData?.stats.valuationRequests ?? 0}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="h-auto w-full flex-wrap justify-start gap-2 rounded-2xl border bg-white p-2">
          <TabsTrigger value="overview" className="rounded-xl">
            {t("funnelsDashboard.tabOverview")}
          </TabsTrigger>
          <TabsTrigger value="agent-site" className="rounded-xl">
            {t("funnelsDashboard.tabAgentSite")}
          </TabsTrigger>
          <TabsTrigger value="home-value" className="rounded-xl">
            {t("funnelsDashboard.tabHomeValue")}
          </TabsTrigger>
          <TabsTrigger value="area-magnets" className="rounded-xl">
            {t("funnelsDashboard.tabAreaMagnets")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-3">
            <Card className="xl:col-span-1">
              <CardHeader>
                <CardTitle>{t("funnelsDashboard.moduleStatus")}</CardTitle>
                <CardDescription>{t("funnelsDashboard.moduleStatusDescription")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  {
                    title: t("funnelsDashboard.agentSiteTitle"),
                    status: profileData?.isPersisted ? t("funnelsDashboard.statusLive") : t("funnelsDashboard.statusDraft"),
                    metric: t("funnelsDashboard.capturedInquiries", { count: String(profileData?.analytics.inquiries ?? 0) }),
                    href: "/agent-site",
                  },
                  {
                    title: t("funnelsDashboard.homeValueTitle"),
                    status: homeValueData?.publicUrl ? t("funnelsDashboard.statusLive") : t("funnelsDashboard.statusNeedsSetup"),
                    metric: t("funnelsDashboard.sellerLeads", { count: String(homeValueData?.stats.capturedLeads ?? 0) }),
                    href: "/home-value",
                  },
                  {
                    title: t("funnelsDashboard.areaMagnetsTitle"),
                    status: activeMagnets.length > 0 ? t("funnelsDashboard.statusActive") : t("funnelsDashboard.statusIdle"),
                    metric: t("funnelsDashboard.totalMagnets", { count: String(areaMagnets.length) }),
                    href: "/area-magnet",
                  },
                ].map((item) => (
                  <div key={item.title} className="rounded-2xl border p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-medium">{item.title}</div>
                      <Badge variant="secondary">{item.status}</Badge>
                    </div>
                    <div className="mt-2 text-sm text-muted-foreground">{item.metric}</div>
                    <Button asChild variant="ghost" className="mt-3 h-auto px-0">
                      <Link href={item.href}>
                        {t("funnelsDashboard.openModule")}
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="xl:col-span-2">
              <CardHeader>
                <CardTitle>{t("funnelsDashboard.leadMixTitle")}</CardTitle>
                <CardDescription>
                  {t("funnelsDashboard.leadMixDescription")}
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-3">
                {[
                  {
                    title: t("funnelsDashboard.agentSiteTitle"),
                    value: agentSiteLeadCount,
                    note: `${profileData?.analytics.profileViews ?? 0} ${t("funnelsDashboard.profileViews").toLowerCase()} · ${profileData?.analytics.chatMessages ?? 0} ${t("funnelsDashboard.chatMessages").toLowerCase()}`,
                    icon: MessagesSquare,
                    tone: "bg-slate-100 text-slate-700",
                  },
                  {
                    title: t("funnelsDashboard.homeValueTitle"),
                    value: homeValueLeadCount,
                    note: t("funnelsDashboard.requestsIn30d", { count: String(homeValueData?.stats.valuationRequests ?? 0) }),
                    icon: Home,
                    tone: "bg-cyan-100 text-cyan-700",
                  },
                  {
                    title: t("funnelsDashboard.areaMagnetsTitle"),
                    value: areaMagnetLeadCount,
                    note: t("funnelsDashboard.viewsAndLeads", { views: String(totalMagnetViews), leads: String(totalMagnetLeads) }),
                    icon: MapPin,
                    tone: "bg-amber-100 text-amber-700",
                  },
                ].map((item) => (
                  <div key={item.title} className="rounded-2xl border p-5">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm text-muted-foreground">{item.title}</div>
                        <div className="mt-2 text-3xl font-semibold">{item.value}</div>
                      </div>
                      <div className={`rounded-2xl p-3 ${item.tone}`}>
                        <item.icon className="h-5 w-5" />
                      </div>
                    </div>
                    <div className="mt-3 text-sm leading-6 text-muted-foreground">{item.note}</div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="agent-site" className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
            <Card>
              <CardHeader>
                <CardTitle>{t("funnelsDashboard.agentSiteStatus")}</CardTitle>
                <CardDescription>
                  {t("funnelsDashboard.agentSiteStatusDescription")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-2xl border p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-medium">{profileData?.profile.name ?? t("funnelsDashboard.draftProfile")}</div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        {profileData?.publicUrl ?? t("funnelsDashboard.publishPrompt")}
                      </div>
                    </div>
                    {profileData?.publicUrl ? (
                      <Button asChild variant="outline">
                        <Link href={profileData.publicUrl} target="_blank">
                          {t("funnelsDashboard.openPage")}
                          <ExternalLink className="h-4 w-4" />
                        </Link>
                      </Button>
                    ) : null}
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-2xl border p-4">
                    <div className="text-sm text-muted-foreground">{t("funnelsDashboard.profileViews")}</div>
                    <div className="mt-2 text-2xl font-semibold">
                      {profileData?.analytics.profileViews ?? 0}
                    </div>
                  </div>
                  <div className="rounded-2xl border p-4">
                    <div className="text-sm text-muted-foreground">{t("funnelsDashboard.chatMessages")}</div>
                    <div className="mt-2 text-2xl font-semibold">
                      {profileData?.analytics.chatMessages ?? 0}
                    </div>
                  </div>
                  <div className="rounded-2xl border p-4">
                    <div className="text-sm text-muted-foreground">{t("funnelsDashboard.capturedInquiriesLabel")}</div>
                    <div className="mt-2 text-2xl font-semibold">
                      {profileData?.analytics.inquiries ?? 0}
                    </div>
                  </div>
                </div>
                <Button asChild>
                  <Link href="/agent-site">
                    {t("funnelsDashboard.editAgentSite")}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t("funnelsDashboard.recentFunnelLeads")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {profileData?.recentLeads.length ? (
                  profileData.recentLeads.map((lead) => (
                    <div key={lead.id} className="rounded-2xl border p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-medium">{lead.name || t("funnelsDashboard.unnamedLead")}</div>
                        <Badge variant="secondary">{lead.source}</Badge>
                      </div>
                      <div className="mt-2 text-sm text-muted-foreground">
                        {lead.email || lead.phone || t("funnelsDashboard.noDirectContact")}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                        <span>{t("funnelsDashboard.score")}: {lead.score}</span>
                        <span>{t("funnelsDashboard.intent")}: {lead.intent || t("funnelsDashboard.areaPending")}</span>
                        <span>{lead.area || t("funnelsDashboard.areaPending")}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
                    {t("funnelsDashboard.noAgentSiteLeads")}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="home-value" className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
            <Card>
              <CardHeader>
                <CardTitle>{t("funnelsDashboard.homeValueStatus")}</CardTitle>
                <CardDescription>
                  {t("funnelsDashboard.homeValueStatusDescription")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-2xl border p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-medium">{t("funnelsDashboard.publicHomeValueRoute")}</div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        {homeValueData?.publicUrl ?? t("funnelsDashboard.configureAgentSiteFirst")}
                      </div>
                    </div>
                    {homeValueData?.publicUrl ? (
                      <Button asChild variant="outline">
                        <Link href={homeValueData.publicUrl} target="_blank">
                          {t("funnelsDashboard.openRoute")}
                          <ExternalLink className="h-4 w-4" />
                        </Link>
                      </Button>
                    ) : null}
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-2xl border p-4">
                    <div className="text-sm text-muted-foreground">{t("funnelsDashboard.requests30d")}</div>
                    <div className="mt-2 text-2xl font-semibold">
                      {homeValueData?.stats.valuationRequests ?? 0}
                    </div>
                  </div>
                  <div className="rounded-2xl border p-4">
                    <div className="text-sm text-muted-foreground">{t("funnelsDashboard.capturedLeads30d")}</div>
                    <div className="mt-2 text-2xl font-semibold">
                      {homeValueData?.stats.capturedLeads ?? 0}
                    </div>
                  </div>
                  <div className="rounded-2xl border p-4">
                    <div className="text-sm text-muted-foreground">{t("funnelsDashboard.leadSourceCount")}</div>
                    <div className="mt-2 text-2xl font-semibold">{homeValueLeadCount}</div>
                  </div>
                </div>
                <Button asChild>
                  <Link href="/home-value">
                    {t("funnelsDashboard.openHomeValueWorkspace")}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t("funnelsDashboard.recentValuationActivity")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {homeValueData?.recentRuns.length ? (
                  homeValueData.recentRuns.slice(0, 6).map((run) => (
                    <div key={run.id} className="rounded-2xl border p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-medium">{run.address}</div>
                        <Badge variant="secondary">
                          {run.estimatedValue ? formatCurrency(run.estimatedValue, locale) : t("funnelsDashboard.estimateReady")}
                        </Badge>
                      </div>
                      <div className="mt-2 text-sm text-muted-foreground">{run.summary}</div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
                    {t("funnelsDashboard.noValuationRuns")}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="area-magnets" className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
            <Card>
              <CardHeader>
                <CardTitle>{t("funnelsDashboard.areaMagnetStatus")}</CardTitle>
                <CardDescription>
                  {t("funnelsDashboard.areaMagnetStatusDescription")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-2xl border p-4">
                    <div className="text-sm text-muted-foreground">{t("funnelsDashboard.totalMagnetsLabel")}</div>
                    <div className="mt-2 text-2xl font-semibold">{areaMagnets.length}</div>
                  </div>
                  <div className="rounded-2xl border p-4">
                    <div className="text-sm text-muted-foreground">{t("funnelsDashboard.activeMagnets")}</div>
                    <div className="mt-2 text-2xl font-semibold">{activeMagnets.length}</div>
                  </div>
                  <div className="rounded-2xl border p-4">
                    <div className="text-sm text-muted-foreground">{t("funnelsDashboard.leadSubmissions")}</div>
                    <div className="mt-2 text-2xl font-semibold">{totalMagnetLeads}</div>
                  </div>
                </div>
                <div className="rounded-2xl border p-4">
                  <div className="text-sm text-muted-foreground">{t("funnelsDashboard.totalViews")}</div>
                  <div className="mt-2 text-3xl font-semibold">{totalMagnetViews}</div>
                </div>
                <Button asChild>
                  <Link href="/area-magnet">
                    {t("funnelsDashboard.openAreaMagnetStudioShort")}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t("funnelsDashboard.recentMagnets")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {areaMagnets.length ? (
                  areaMagnets.slice(0, 6).map((magnet) => (
                    <div key={magnet.token} className="rounded-2xl border p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-medium">
                          {magnet.title || magnet.scopeLabel || t("funnelsDashboard.areaMagnetFallback")}
                        </div>
                        <Badge variant="secondary">{magnet.status}</Badge>
                      </div>
                      <div className="mt-2 text-sm text-muted-foreground">
                        {magnet.scopeLabel || t("funnelsDashboard.scopePending")} · {magnet.viewCount} {t("funnelsDashboard.views")} ·{" "}
                        {magnet.leadCount} {t("funnelsDashboard.leads")}
                      </div>
                      <div className="mt-3 text-xs text-muted-foreground">
                        {t("funnelsDashboard.lastActivity")}: {formatDateTime(magnet.lastActivityAt, locale) || t("funnelsDashboard.noRecentActivity")}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
                    {t("funnelsDashboard.noAreaMagnets")}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            {t("funnelsDashboard.operatingRule")}
          </CardTitle>
          <CardDescription>
            {t("funnelsDashboard.operatingRuleDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm leading-7 text-muted-foreground">
          <p>{t("funnelsDashboard.operatingRuleP1")}</p>
          <p>{t("funnelsDashboard.operatingRuleP2")}</p>
        </CardContent>
      </Card>
    </div>
  );
}
