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
import { trpc } from "@/lib/trpc";

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "No recent activity";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No recent activity";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function getSourceCount(
  sourceBreakdown: Array<{ source: string; count: number }> | undefined,
  source: string,
) {
  return sourceBreakdown?.find((item) => item.source === source)?.count ?? 0;
}

export function FunnelsDashboard() {
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
        <div className="text-sm text-muted-foreground">Loading funnels workspace...</div>
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
                Funnels Workspace
              </Badge>
              <Badge
                variant="outline"
                className="rounded-full border-slate-200 bg-white px-3 py-1 text-[11px] text-slate-600"
              >
                Agent Site + Home Value + Area Magnet
              </Badge>
            </div>

            <div className="space-y-3">
              <div className="text-xs uppercase tracking-[0.32em] text-slate-500">Funnels</div>
              <h1 className="max-w-4xl text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl">
                Public entry points now work as one acquisition layer.
              </h1>
              <p className="max-w-3xl text-sm leading-7 text-slate-600 md:text-[15px]">
                Agent Site, Home Value, and Area Magnets all feed the same lead spine. Use this
                workspace to monitor performance, tighten each entry point, and push traffic into
                the right next action.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg" className="rounded-full px-5 shadow-sm">
                <Link href="/agent-site">
                  Configure Agent Site
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="rounded-full px-5">
                <Link href="/home-value">
                  Tune Home Value
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="ghost" className="rounded-full px-5">
                <Link href="/area-magnet">
                  Open Area Magnet Studio
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
                  <div className="text-sm text-muted-foreground">Live entry points</div>
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
                  <div className="text-sm text-muted-foreground">Funnel leads</div>
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
                  <div className="text-sm text-muted-foreground">Area Magnet views</div>
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
              <div className="text-sm text-muted-foreground">Agent Site leads</div>
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
              <div className="text-sm text-muted-foreground">Home Value leads</div>
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
              <div className="text-sm text-muted-foreground">Area Magnet leads</div>
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
              <div className="text-sm text-muted-foreground">Valuation requests</div>
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
            Overview
          </TabsTrigger>
          <TabsTrigger value="agent-site" className="rounded-xl">
            Agent Site
          </TabsTrigger>
          <TabsTrigger value="home-value" className="rounded-xl">
            Home Value
          </TabsTrigger>
          <TabsTrigger value="area-magnets" className="rounded-xl">
            Area Magnets
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-3">
            <Card className="xl:col-span-1">
              <CardHeader>
                <CardTitle>Module status</CardTitle>
                <CardDescription>Use each funnel as a different entry path into the same lead spine.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  {
                    title: "Agent Site",
                    status: profileData?.isPersisted ? "Live" : "Draft",
                    metric: `${profileData?.analytics.inquiries ?? 0} captured inquiries`,
                    href: "/agent-site",
                  },
                  {
                    title: "Home Value",
                    status: homeValueData?.publicUrl ? "Live" : "Needs setup",
                    metric: `${homeValueData?.stats.capturedLeads ?? 0} seller leads`,
                    href: "/home-value",
                  },
                  {
                    title: "Area Magnets",
                    status: activeMagnets.length > 0 ? "Active" : "Idle",
                    metric: `${areaMagnets.length} total magnets`,
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
                        Open module
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="xl:col-span-2">
              <CardHeader>
                <CardTitle>Lead mix by funnel</CardTitle>
                <CardDescription>
                  The key question here is not which tool exists. It is which public entry point is
                  actually converting attention into leads.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-3">
                {[
                  {
                    title: "Agent Site",
                    value: agentSiteLeadCount,
                    note: `${profileData?.analytics.profileViews ?? 0} profile views · ${profileData?.analytics.chatMessages ?? 0} chat messages`,
                    icon: MessagesSquare,
                    tone: "bg-slate-100 text-slate-700",
                  },
                  {
                    title: "Home Value",
                    value: homeValueLeadCount,
                    note: `${homeValueData?.stats.valuationRequests ?? 0} requests in the last 30 days`,
                    icon: Home,
                    tone: "bg-cyan-100 text-cyan-700",
                  },
                  {
                    title: "Area Magnets",
                    value: areaMagnetLeadCount,
                    note: `${totalMagnetViews} views · ${totalMagnetLeads} captured leads`,
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
                <CardTitle>Agent Site status</CardTitle>
                <CardDescription>
                  Public profile, contact form, and AI chat should work together as your general
                  inbound layer.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-2xl border p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-medium">{profileData?.profile.name ?? "Draft profile"}</div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        {profileData?.publicUrl ?? "Publish your public profile to activate this funnel."}
                      </div>
                    </div>
                    {profileData?.publicUrl ? (
                      <Button asChild variant="outline">
                        <Link href={profileData.publicUrl} target="_blank">
                          Open page
                          <ExternalLink className="h-4 w-4" />
                        </Link>
                      </Button>
                    ) : null}
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-2xl border p-4">
                    <div className="text-sm text-muted-foreground">Profile views</div>
                    <div className="mt-2 text-2xl font-semibold">
                      {profileData?.analytics.profileViews ?? 0}
                    </div>
                  </div>
                  <div className="rounded-2xl border p-4">
                    <div className="text-sm text-muted-foreground">Chat messages</div>
                    <div className="mt-2 text-2xl font-semibold">
                      {profileData?.analytics.chatMessages ?? 0}
                    </div>
                  </div>
                  <div className="rounded-2xl border p-4">
                    <div className="text-sm text-muted-foreground">Captured inquiries</div>
                    <div className="mt-2 text-2xl font-semibold">
                      {profileData?.analytics.inquiries ?? 0}
                    </div>
                  </div>
                </div>
                <Button asChild>
                  <Link href="/agent-site">
                    Edit Agent Site
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent funnel leads</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {profileData?.recentLeads.length ? (
                  profileData.recentLeads.map((lead) => (
                    <div key={lead.id} className="rounded-2xl border p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-medium">{lead.name || "Unnamed lead"}</div>
                        <Badge variant="secondary">{lead.source}</Badge>
                      </div>
                      <div className="mt-2 text-sm text-muted-foreground">
                        {lead.email || lead.phone || "No direct contact method"}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                        <span>score: {lead.score}</span>
                        <span>intent: {lead.intent || "n/a"}</span>
                        <span>{lead.area || "area pending"}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
                    No agent-site leads yet.
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
                <CardTitle>Home Value status</CardTitle>
                <CardDescription>
                  This funnel is your seller-entry wedge. It should convert curiosity into a named,
                  high-intent valuation lead.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-2xl border p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-medium">Public Home Value route</div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        {homeValueData?.publicUrl ?? "Configure Agent Site first to activate this route."}
                      </div>
                    </div>
                    {homeValueData?.publicUrl ? (
                      <Button asChild variant="outline">
                        <Link href={homeValueData.publicUrl} target="_blank">
                          Open route
                          <ExternalLink className="h-4 w-4" />
                        </Link>
                      </Button>
                    ) : null}
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-2xl border p-4">
                    <div className="text-sm text-muted-foreground">Requests (30d)</div>
                    <div className="mt-2 text-2xl font-semibold">
                      {homeValueData?.stats.valuationRequests ?? 0}
                    </div>
                  </div>
                  <div className="rounded-2xl border p-4">
                    <div className="text-sm text-muted-foreground">Captured leads (30d)</div>
                    <div className="mt-2 text-2xl font-semibold">
                      {homeValueData?.stats.capturedLeads ?? 0}
                    </div>
                  </div>
                  <div className="rounded-2xl border p-4">
                    <div className="text-sm text-muted-foreground">Lead source count</div>
                    <div className="mt-2 text-2xl font-semibold">{homeValueLeadCount}</div>
                  </div>
                </div>
                <Button asChild>
                  <Link href="/home-value">
                    Open Home Value workspace
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent valuation activity</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {homeValueData?.recentRuns.length ? (
                  homeValueData.recentRuns.slice(0, 6).map((run) => (
                    <div key={run.id} className="rounded-2xl border p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-medium">{run.address}</div>
                        <Badge variant="secondary">
                          {run.estimatedValue ? formatMoney(run.estimatedValue) : "Estimate ready"}
                        </Badge>
                      </div>
                      <div className="mt-2 text-sm text-muted-foreground">{run.summary}</div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
                    No valuation runs yet.
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
                <CardTitle>Area Magnet status</CardTitle>
                <CardDescription>
                  Area Magnets are the market-specific lead traps inside your funnel layer. They
                  should keep compounding views, leads, and follow-up signals.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-2xl border p-4">
                    <div className="text-sm text-muted-foreground">Total magnets</div>
                    <div className="mt-2 text-2xl font-semibold">{areaMagnets.length}</div>
                  </div>
                  <div className="rounded-2xl border p-4">
                    <div className="text-sm text-muted-foreground">Active magnets</div>
                    <div className="mt-2 text-2xl font-semibold">{activeMagnets.length}</div>
                  </div>
                  <div className="rounded-2xl border p-4">
                    <div className="text-sm text-muted-foreground">Lead submissions</div>
                    <div className="mt-2 text-2xl font-semibold">{totalMagnetLeads}</div>
                  </div>
                </div>
                <div className="rounded-2xl border p-4">
                  <div className="text-sm text-muted-foreground">Total views</div>
                  <div className="mt-2 text-3xl font-semibold">{totalMagnetViews}</div>
                </div>
                <Button asChild>
                  <Link href="/area-magnet">
                    Open Area Magnet studio
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent magnets</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {areaMagnets.length ? (
                  areaMagnets.slice(0, 6).map((magnet) => (
                    <div key={magnet.token} className="rounded-2xl border p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-medium">
                          {magnet.title || magnet.scopeLabel || "Area Magnet"}
                        </div>
                        <Badge variant="secondary">{magnet.status}</Badge>
                      </div>
                      <div className="mt-2 text-sm text-muted-foreground">
                        {magnet.scopeLabel || "Scope pending"} · {magnet.viewCount} views ·{" "}
                        {magnet.leadCount} leads
                      </div>
                      <div className="mt-3 text-xs text-muted-foreground">
                        Last activity: {formatDate(magnet.lastActivityAt)}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
                    No area magnets created yet.
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
            Operating rule
          </CardTitle>
          <CardDescription>
            Treat these three modules as one funnel system, not separate products.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm leading-7 text-muted-foreground">
          <p>
            Use `Agent Site` as the general inbound layer, `Home Value` as the seller-intent wedge,
            and `Area Magnets` as market-specific acquisition hooks.
          </p>
          <p>
            The real KPI is not page count. It is how efficiently these entry points push named
            leads into `Leads`, where AI can rank urgency and route the next action.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
