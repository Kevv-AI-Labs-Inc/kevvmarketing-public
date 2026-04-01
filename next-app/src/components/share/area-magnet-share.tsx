"use client";

import { useState } from "react";
import type { inferRouterOutputs } from "@trpc/server";
import {
  ArrowRight,
  Copy,
  Download,
  Home,
  Lock,
  Loader2,
  MapPin,
} from "lucide-react";
import { toast } from "sonner";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { AppRouter } from "@/routers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useT } from "@/i18n";
import { localeTag } from "@/i18n/copy";
import { getSharePageCopy } from "@/i18n/share-pages";
import { trpc } from "@/lib/trpc";

// ─── Types ─────────────────────────────────────────────────────

type RouterOutput = inferRouterOutputs<AppRouter>;
type SharePayload = RouterOutput["share"]["getSessionByToken"];

type AreaMagnetShareProps = {
  token: string;
  data: SharePayload;
  trackEvent: (eventType: string, eventData?: Record<string, unknown>) => void;
};

// ─── Chart Colors ──────────────────────────────────────────────

const CHART_COLORS = [
  "#10b981",
  "#3b82f6",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
];

// ─── P1-1: Content Gating Constants ───────────────────────────

const FREE_INSIGHT_COUNT = 2;

// ─── Utility Helpers ───────────────────────────────────────────

function getString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asRecordArray(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is Record<string, unknown> =>
      Boolean(item) && typeof item === "object"
  );
}

function getNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function formatPrice(value: string | null | undefined, fallback: string) {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return value;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(parsed);
}

function formatDateTime(value: string | null, locale: "zh" | "en") {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat(localeTag(locale), {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed);
}

function formatMetricValue(value: unknown) {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "\u2014";
}

function buildAddress(listing: SharePayload["listings"][number]) {
  return (
    getString(listing.unparsedAddress) ||
    [
      getString(listing.city),
      getString(listing.stateOrProvince),
      getString(listing.postalCode),
    ]
      .filter(Boolean)
      .join(", ") ||
    "Unknown address"
  );
}

// ─── P1-2: Price Range Distribution Chart ──────────────────────

function PriceRangeChart({
  data,
}: {
  data: Array<{ label: string; count: number }>;
}) {
  if (data.length === 0) return null;
  return (
    <div className="h-[200px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
          <XAxis
            dataKey="label"
            tick={{ fill: "#a8a29e", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "#a8a29e", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#1c1c1c",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 12,
              color: "#fafaf9",
              fontSize: 12,
            }}
            formatter={(value) => [`${value} listings`, "Count"]}
          />
          <Bar dataKey="count" radius={[6, 6, 0, 0]}>
            {data.map((_, i) => (
              <Cell
                key={`cell-${i}`}
                fill={CHART_COLORS[i % CHART_COLORS.length]}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── P1-2: Property Type Pie Chart ─────────────────────────────

function PropertyTypePieChart({
  data,
}: {
  data: Array<{ label: string; count: number }>;
}) {
  if (data.length === 0) return null;
  return (
    <div className="h-[200px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="count"
            nameKey="label"
            cx="50%"
            cy="50%"
            outerRadius={70}
            innerRadius={35}
            paddingAngle={3}
            label={({ name, percent }: { name?: string; percent?: number }) =>
              `${name ?? ""} ${((percent ?? 0) * 100).toFixed(0)}%`
            }
          >
            {data.map((_, i) => (
              <Cell
                key={`pie-${i}`}
                fill={CHART_COLORS[i % CHART_COLORS.length]}
              />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: "#1c1c1c",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 12,
              color: "#fafaf9",
              fontSize: 12,
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────

export default function AreaMagnetShare({
  token,
  data,
  trackEvent,
}: AreaMagnetShareProps) {
  const { locale } = useT();
  const copy = getSharePageCopy(locale).areaMagnetShare;
  const pick = (value: string) => value;
  const [activeTab, setActiveTab] = useState("overview");
  const [leadName, setLeadName] = useState("");
  const [leadEmail, setLeadEmail] = useState("");
  const [leadPhone, setLeadPhone] = useState("");
  const [leadSubmitted, setLeadSubmitted] = useState(false);

  // P1-1: content gating state
  const [contentUnlocked, setContentUnlocked] = useState(false);

  const submitLeadMutation = trpc.share.submitLead.useMutation({
    onSuccess: () => {
      setLeadSubmitted(true);
      // P1-1: unlock gated content after lead capture
      setContentUnlocked(true);
      toast.success(pick(copy.leadCaptured));
    },
    onError: (error) => {
      toast.error(pick(copy.leadCaptureFailed), {
        description: error.message,
      });
    },
  });

  // ─── Data Extraction ──────────────────────────────────────

  const magnetPayload = asRecord(data.magnetPayload) ?? {};
  const agentBranding = asRecord(data.agentBranding) ?? {};
  const capture = asRecord(magnetPayload.capture) ?? {};
  const shareKit = asRecord(magnetPayload.shareKit) ?? {};
  const snapshotData = asRecord(magnetPayload.snapshot) ?? {};
  const neighborhoodData = asRecord(magnetPayload.neighborhood) ?? {};
  const scopeLabel =
    getString(magnetPayload.scopeLabel) ||
    getString(asRecord(data.magnetScope)?.normalizedLabel) ||
    pick(copy.areaFallback);
  const strategyPoints = getStringArray(magnetPayload.insightBullets);
  const reportSections = asRecordArray(magnetPayload.reportSections);
  const metricCards = asRecordArray(magnetPayload.metrics);
  const captureFields = getStringArray(capture.fields);
  const featuredListings = data.listings.slice(0, 4);
  const accentColor = getString(agentBranding.accentColor) || "#166534";
  const agentName = getString(agentBranding.agentName) || copy.brandLabel;
  const agentTitle = getString(agentBranding.agentTitle);
  const brokerageName = getString(agentBranding.brokerageName);
  const email = getString(agentBranding.email);
  const phone = getString(agentBranding.phone);
  const wechatId = getString(agentBranding.wechatId);

  // P1-2: chart data extraction
  const priceRangeDistribution = asRecordArray(
    snapshotData.priceRangeDistribution
  ).map((b) => ({
    label: getString(b.label) || "?",
    count: getNumber(b.count) ?? 0,
  }));
  const propertyTypeMix = asRecordArray(snapshotData.propertyTypeMix).map(
    (b) => ({
      label: getString(b.label) || "Other",
      count: getNumber(b.count) ?? 0,
    })
  );

  // P2-1: Home Value CTA link
  const agentSlug = getString(agentBranding.slug);
  const homeValueUrl = agentSlug
    ? `/agents/${agentSlug}/home-value`
    : null;

  const shareKitCards = [
    {
      id: "facebook",
      title: pick(copy.facebookTitle),
      body: getString(shareKit.facebookPost),
    },
    {
      id: "instagram",
      title: pick(copy.instagramTitle),
      body: getString(shareKit.instagramCaption),
    },
    { id: "xhs", title: pick(copy.xhsTitle), body: getString(shareKit.xhsNote) },
    {
      id: "email",
      title: pick(copy.emailTitle),
      body: `${getString(shareKit.emailSubject)}\n\n${getString(shareKit.emailTeaser)}`.trim(),
    },
  ].filter((item) => item.body.length > 0);

  const hashtags = getStringArray(shareKit.hashtags);

  // ─── Handlers ─────────────────────────────────────────────

  const handleCopyBlock = async (kind: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      trackEvent("social_copy", { kind });
      toast.success(pick(copy.copySuccess));
    } catch {
      toast.error(pick(copy.copyFailure));
    }
  };

  const handleLeadSubmit = () => {
    submitLeadMutation.mutate({
      token,
      name: leadName.trim() || undefined,
      email: leadEmail.trim() || undefined,
      phone: leadPhone.trim() || undefined,
      intent: getString(magnetPayload.audience) || undefined,
    });
  };

  // ─── Render ───────────────────────────────────────────────

  return (
    <div className="min-h-[100dvh] bg-[#0f1512] text-stone-100">
      <div
        className="absolute inset-x-0 top-0 h-[460px] opacity-90"
        style={{
          background: `radial-gradient(circle at top, ${accentColor}33 0%, rgba(15, 21, 18, 0) 60%)`,
        }}
      />

      <div className="relative mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8">
        {/* ── Hero + Lead Capture Grid ────────────────────── */}
        <section className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_360px]">
          <Card className="rounded-[30px] border-white/10 bg-[#151c18]/90 text-stone-100 shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
            <CardContent className="space-y-6 p-6 md:p-8">
              <div className="flex flex-wrap gap-2">
                <Badge
                  variant="outline"
                  className="rounded-full border-white/15 bg-white/5 px-3 py-1 text-stone-100"
                >
                  {pick(copy.marketIntelBadge)}
                </Badge>
                <Badge
                  variant="outline"
                  className="rounded-full border-white/15 bg-white/5 px-3 py-1 text-stone-300"
                >
                  {scopeLabel}
                </Badge>
              </div>
              <div className="space-y-4">
                <p className="text-xs uppercase tracking-[0.3em] text-stone-400">
                  {copy.brandLabel}
                </p>
                <h1 className="max-w-4xl text-4xl font-serif tracking-tight text-white md:text-5xl">
                  {data.session.title || pick(copy.defaultTitle)}
                </h1>
                <p className="max-w-3xl text-base leading-8 text-stone-300">
                  {getString(magnetPayload.heroHook) ||
                    data.session.introMessage ||
                    pick(copy.defaultSummary)}
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <Card className="rounded-[22px] border-white/10 bg-white/5 text-stone-100">
                  <CardContent className="p-4">
                    <p className="text-xs uppercase tracking-[0.24em] text-stone-400">
                      {pick(copy.viewsStat)}
                    </p>
                    <p className="mt-3 text-2xl font-semibold">
                      {data.session.viewCount}
                    </p>
                    <p className="mt-1 text-xs text-stone-400">
                      {pick(copy.viewsHint(data.session.viewCount))}
                    </p>
                  </CardContent>
                </Card>
                <Card className="rounded-[22px] border-white/10 bg-white/5 text-stone-100">
                  <CardContent className="p-4">
                    <p className="text-xs uppercase tracking-[0.24em] text-stone-400">
                      {pick(copy.createdStat)}
                    </p>
                    <p className="mt-3 text-lg font-semibold">
                      {formatDateTime(data.session.createdAt, locale)}
                    </p>
                    <p className="mt-1 text-xs text-stone-400">{scopeLabel}</p>
                  </CardContent>
                </Card>
                <Card className="rounded-[22px] border-white/10 bg-white/5 text-stone-100">
                  <CardContent className="p-4">
                    <p className="text-xs uppercase tracking-[0.24em] text-stone-400">
                      {pick(copy.featuredHomesStat)}
                    </p>
                    <p className="mt-3 text-2xl font-semibold">
                      {featuredListings.length}
                    </p>
                    <p className="mt-1 text-xs text-stone-400">
                      {pick(
                        copy.featuredHomesHint(featuredListings.length)
                      )}
                    </p>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>

          {/* ── Lead Capture Sidebar ──────────────────────── */}
          <Card className="rounded-[30px] border-white/10 bg-[#151c18]/95 text-stone-100 shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
            <CardContent className="space-y-5 p-6">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-stone-400">
                  {pick(copy.captureTitle)}
                </p>
                <h2 className="mt-2 text-2xl font-serif text-white">
                  {getString(capture.title) ||
                    pick(copy.captureDefaultTitle)}
                </h2>
                <p className="mt-3 text-sm leading-7 text-stone-300">
                  {getString(capture.description) ||
                    pick(copy.captureDefaultDescription)}
                </p>
              </div>

              {leadSubmitted ? (
                <div className="rounded-[24px] border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm leading-7 text-emerald-50">
                  <p className="font-medium">
                    {pick(copy.afterCaptureTitle)}
                  </p>
                  <p className="mt-2">
                    {getString(capture.followUpPrompt) ||
                      pick(copy.afterCaptureDescription)}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-stone-100">
                      {pick(copy.nameField)}
                    </Label>
                    <Input
                      value={leadName}
                      onChange={(event) => setLeadName(event.target.value)}
                      className="border-white/10 bg-white/5 text-stone-100"
                    />
                  </div>
                  {captureFields.includes("email") ||
                  captureFields.length === 0 ? (
                    <div className="space-y-2">
                      <Label className="text-stone-100">
                        {pick(copy.emailField)}
                      </Label>
                      <Input
                        value={leadEmail}
                        onChange={(event) => setLeadEmail(event.target.value)}
                        className="border-white/10 bg-white/5 text-stone-100"
                      />
                    </div>
                  ) : null}
                  {captureFields.includes("phone") ? (
                    <div className="space-y-2">
                      <Label className="text-stone-100">
                        {pick(copy.phoneField)}
                      </Label>
                      <Input
                        value={leadPhone}
                        onChange={(event) => setLeadPhone(event.target.value)}
                        className="border-white/10 bg-white/5 text-stone-100"
                      />
                    </div>
                  ) : null}
                  <Button
                    className="w-full gap-2 rounded-full"
                    style={{ backgroundColor: accentColor }}
                    disabled={submitLeadMutation.isPending}
                    onClick={handleLeadSubmit}
                  >
                    {submitLeadMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {pick(copy.captureSubmitting)}
                      </>
                    ) : (
                      <>
                        <ArrowRight className="h-4 w-4" />
                        {getString(capture.primaryLabel) ||
                          pick(copy.captureAction)}
                      </>
                    )}
                  </Button>
                </div>
              )}

              {/* ── P2-1: Home Value CTA ────────────────── */}
              {homeValueUrl ? (
                <a
                  href={homeValueUrl}
                  className="flex items-center gap-3 rounded-[24px] border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-50 transition-colors hover:bg-emerald-500/20"
                  onClick={() =>
                    trackEvent("hv_cta_click", { source: "area_magnet" })
                  }
                >
                  <Home className="h-5 w-5 shrink-0 text-emerald-400" />
                  <div>
                    <p className="font-medium">
                      {locale === "zh"
                        ? "想知道你的房子值多少？"
                        : "What's your home worth?"}
                    </p>
                    <p className="mt-1 text-xs text-emerald-200/70">
                      {locale === "zh"
                        ? "免费获取 AI 房屋估价报告"
                        : "Get a free AI home value estimate"}
                    </p>
                  </div>
                  <ArrowRight className="ml-auto h-4 w-4 shrink-0 text-emerald-400" />
                </a>
              ) : null}

              <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.28em] text-stone-400">
                  {pick(copy.contactTitle)}
                </p>
                <div className="mt-3 space-y-2 text-sm text-stone-200">
                  <p className="font-medium text-white">{agentName}</p>
                  {agentTitle ? <p>{agentTitle}</p> : null}
                  {brokerageName ? <p>{brokerageName}</p> : null}
                  {email ? <p>{email}</p> : null}
                  {phone ? <p>{phone}</p> : null}
                  {wechatId ? (
                    <p>
                      {copy.wechatLabel}: {wechatId}
                    </p>
                  ) : null}
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* ── Tabbed Content Area ──────────────────────────── */}
        <div className="mt-6 rounded-[30px] border border-white/10 bg-[#151c18]/90 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.24)] md:p-6">
          <Tabs
            value={activeTab}
            onValueChange={(value) => {
              setActiveTab(value);
              trackEvent("tab_view", { tab: value });
            }}
            className="gap-6"
          >
            <TabsList className="h-auto w-full flex-wrap gap-2 rounded-2xl bg-white/5 p-2 md:w-auto">
              <TabsTrigger
                value="overview"
                className="rounded-xl data-[state=active]:bg-white data-[state=active]:text-stone-900"
              >
                {pick(copy.tabOverview)}
              </TabsTrigger>
              <TabsTrigger
                value="report"
                className="rounded-xl data-[state=active]:bg-white data-[state=active]:text-stone-900"
              >
                {pick(copy.tabReport)}
              </TabsTrigger>
              <TabsTrigger
                value="share-kit"
                className="rounded-xl data-[state=active]:bg-white data-[state=active]:text-stone-900"
              >
                {pick(copy.tabShareKit)}
              </TabsTrigger>
            </TabsList>

            {/* ── Overview Tab ────────────────────────── */}
            <TabsContent value="overview" className="space-y-6">
              {/* P1-1: Content gating — show first FREE_INSIGHT_COUNT insights freely */}
              <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {strategyPoints.length > 0 ? (
                  strategyPoints.map((point, index) => {
                    const isGated =
                      !contentUnlocked && index >= FREE_INSIGHT_COUNT;
                    return (
                      <div
                        key={`insight-${index}`}
                        className={`relative rounded-[24px] border border-white/10 bg-white/5 p-4 text-sm leading-7 text-stone-200 ${isGated ? "select-none" : ""}`}
                      >
                        {isGated ? (
                          <>
                            <div className="blur-[8px]">{point}</div>
                            <div className="absolute inset-0 flex flex-col items-center justify-center rounded-[24px] bg-black/40 backdrop-blur-[2px]">
                              <Lock className="mb-2 h-5 w-5 text-stone-400" />
                              <p className="text-xs text-stone-400">
                                {locale === "zh"
                                  ? "留资后解锁"
                                  : "Submit info to unlock"}
                              </p>
                            </div>
                          </>
                        ) : (
                          point
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="rounded-[24px] border border-white/10 bg-white/5 p-4 text-sm leading-7 text-stone-200 md:col-span-2 xl:col-span-4">
                    {pick(copy.defaultSummary)}
                  </div>
                )}
              </section>

              {/* P1-2: Charts Section */}
              {(priceRangeDistribution.length > 0 ||
                propertyTypeMix.length > 0) && (
                <section className="grid gap-4 md:grid-cols-2">
                  {priceRangeDistribution.length > 0 && (
                    <div className="rounded-[24px] border border-white/10 bg-white/5 p-5">
                      <p className="mb-4 text-xs uppercase tracking-[0.28em] text-stone-400">
                        {locale === "zh" ? "价格分布" : "Price Distribution"}
                      </p>
                      <PriceRangeChart data={priceRangeDistribution} />
                    </div>
                  )}
                  {propertyTypeMix.length > 0 && (
                    <div className="rounded-[24px] border border-white/10 bg-white/5 p-5">
                      <p className="mb-4 text-xs uppercase tracking-[0.28em] text-stone-400">
                        {locale === "zh" ? "物业类型" : "Property Type Mix"}
                      </p>
                      <PropertyTypePieChart data={propertyTypeMix} />
                    </div>
                  )}
                </section>
              )}

              {/* Featured Listings */}
              <section className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.28em] text-stone-400">
                      {pick(copy.featuredHomesTitle)}
                    </p>
                    <h3 className="mt-2 text-2xl font-serif text-white">
                      {pick(copy.featuredHomesSubtitle)}
                    </h3>
                  </div>
                  <Button
                    variant="outline"
                    className="rounded-full border-white/15 bg-white/5 text-stone-100"
                    onClick={() => {
                      setActiveTab("report");
                      trackEvent("report_expand", { source: "overview" });
                    }}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    {pick(copy.jumpToReport)}
                  </Button>
                </div>
                {featuredListings.length > 0 ? (
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    {featuredListings.map((listing) => (
                      <div
                        key={listing.listingKey}
                        className="overflow-hidden rounded-[24px] border border-white/10 bg-white/5"
                      >
                        {getStringArray(listing.images)[0] ? (
                          <img
                            src={getStringArray(listing.images)[0]}
                            alt={buildAddress(listing)}
                            className="h-40 w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-40 items-center justify-center bg-white/5 text-sm text-stone-400">
                            {pick(copy.noPhoto)}
                          </div>
                        )}
                        <div className="space-y-3 p-4">
                          <div>
                            <p className="line-clamp-2 text-sm font-medium text-white">
                              {buildAddress(listing)}
                            </p>
                            <p className="mt-2 text-lg font-semibold text-white">
                              {formatPrice(
                                listing.listPrice,
                                pick(copy.pricePending)
                              )}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2 text-xs text-stone-400">
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="h-3.5 w-3.5" />
                              {getString(listing.standardStatus) ||
                                pick(copy.activeListing)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-[24px] border border-dashed border-white/10 bg-white/5 p-6 text-sm text-stone-300">
                    {pick(copy.noFeaturedHomes)}
                  </div>
                )}
              </section>
            </TabsContent>

            {/* ── Report Tab ──────────────────────────── */}
            <TabsContent value="report" className="space-y-6">
              <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {metricCards.map((metric, index) => (
                  <Card
                    key={`${getString(metric.label)}-${index}`}
                    className="rounded-[24px] border-white/10 bg-white/5 text-stone-100"
                  >
                    <CardContent className="p-5">
                      <p className="text-xs uppercase tracking-[0.24em] text-stone-400">
                        {getString(metric.label) || `Metric ${index + 1}`}
                      </p>
                      <p className="mt-3 text-2xl font-semibold">
                        {formatMetricValue(metric.value)}
                      </p>
                      <p className="mt-2 text-xs leading-6 text-stone-400">
                        {getString(metric.detail)}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </section>

              {/* P1-1: Report sections with gating */}
              <section className="space-y-4">
                {reportSections.map((section, index) => {
                  const isGated = !contentUnlocked && index >= 1;
                  return (
                    <div
                      key={`${getString(section.title)}-${index}`}
                      className={`relative rounded-[24px] border border-white/10 bg-white/5 p-5 ${isGated ? "select-none" : ""}`}
                    >
                      {isGated ? (
                        <>
                          <div className="blur-[8px]">
                            <div className="flex items-start gap-3">
                              <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-white">
                                {index + 1}
                              </div>
                              <div>
                                <h3 className="text-lg font-semibold text-white">
                                  {getString(section.title)}
                                </h3>
                                <p className="mt-3 max-w-4xl text-sm leading-7 text-stone-300">
                                  {getString(section.body)}
                                </p>
                              </div>
                            </div>
                          </div>
                          <div className="absolute inset-0 flex flex-col items-center justify-center rounded-[24px] bg-black/40 backdrop-blur-[2px]">
                            <Lock className="mb-2 h-5 w-5 text-stone-400" />
                            <p className="text-xs text-stone-400">
                              {locale === "zh"
                                ? "留资后解锁完整报告"
                                : "Submit your info to unlock the full report"}
                            </p>
                          </div>
                        </>
                      ) : (
                        <div className="flex items-start gap-3">
                          <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-white">
                            {index + 1}
                          </div>
                          <div>
                            <h3 className="text-lg font-semibold text-white">
                              {getString(section.title)}
                            </h3>
                            <p className="mt-3 max-w-4xl text-sm leading-7 text-stone-300">
                              {getString(section.body)}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </section>

              {/* P1-2: Charts in Report Tab too */}
              {priceRangeDistribution.length > 0 && (
                <section className="rounded-[24px] border border-white/10 bg-white/5 p-5">
                  <p className="mb-4 text-xs uppercase tracking-[0.28em] text-stone-400">
                    {locale === "zh" ? "价格分布" : "Price Distribution"}
                  </p>
                  <PriceRangeChart data={priceRangeDistribution} />
                </section>
              )}
            </TabsContent>

            {/* ── Share Kit Tab ────────────────────────── */}
            <TabsContent value="share-kit" className="space-y-6">
              <section className="grid gap-4 xl:grid-cols-2">
                {shareKitCards.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-[24px] border border-white/10 bg-white/5 p-5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.28em] text-stone-400">
                          {item.title}
                        </p>
                        <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-stone-200">
                          {item.body}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-full border-white/15 bg-white/5 text-stone-100"
                        onClick={() => handleCopyBlock(item.id, item.body)}
                      >
                        <Copy className="mr-2 h-4 w-4" />
                        {pick(copy.copyAction)}
                      </Button>
                    </div>
                  </div>
                ))}
              </section>
              {hashtags.length > 0 ? (
                <section className="rounded-[24px] border border-white/10 bg-white/5 p-5">
                  <p className="text-xs uppercase tracking-[0.28em] text-stone-400">
                    {pick(copy.hashtagTitle)}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {hashtags.map((tag) => (
                      <Badge
                        key={tag}
                        variant="outline"
                        className="rounded-full border-white/15 bg-white/5 text-stone-100"
                      >
                        #{tag}
                      </Badge>
                    ))}
                  </div>
                </section>
              ) : null}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
