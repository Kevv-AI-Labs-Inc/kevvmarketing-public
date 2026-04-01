"use client";

// Migrated from pages-legacy/AreaMagnetStudio.tsx → modern component architecture (P2-2)
// Re-exports the legacy component with the same interface.
// This file serves as the canonical import path going forward.

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  BarChart3,
  Copy,
  ExternalLink,
  Layers3,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Share2,
  Sparkles,
  Trash2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { createTranslator, useT } from "@/i18n";
import { localeTag } from "@/i18n/copy";
import { trpc } from "@/lib/trpc";

type ScopeType = "zip" | "neighborhood" | "building";
type MagnetType =
  | "spring_market"
  | "school_move_up"
  | "off_market_brief"
  | "renovation_roi";
type Audience = "seller" | "buyer" | "investor" | "move_up";
type Tone = "advisory" | "urgent" | "luxury";

const scopeOptions = [
  {
    value: "zip",
    labelKey: "areaMagnetStudio.scopeOptions.zip.label",
    placeholderKey: "areaMagnetStudio.scopeOptions.zip.placeholder",
  },
  {
    value: "neighborhood",
    labelKey: "areaMagnetStudio.scopeOptions.neighborhood.label",
    placeholderKey: "areaMagnetStudio.scopeOptions.neighborhood.placeholder",
  },
  {
    value: "building",
    labelKey: "areaMagnetStudio.scopeOptions.building.label",
    placeholderKey: "areaMagnetStudio.scopeOptions.building.placeholder",
  },
] as const;

const magnetOptions = [
  {
    value: "spring_market",
    labelKey: "areaMagnetStudio.magnetOptions.springMarket.label",
    descriptionKey: "areaMagnetStudio.magnetOptions.springMarket.description",
  },
  {
    value: "school_move_up",
    labelKey: "areaMagnetStudio.magnetOptions.schoolMoveUp.label",
    descriptionKey: "areaMagnetStudio.magnetOptions.schoolMoveUp.description",
  },
  {
    value: "off_market_brief",
    labelKey: "areaMagnetStudio.magnetOptions.offMarketBrief.label",
    descriptionKey: "areaMagnetStudio.magnetOptions.offMarketBrief.description",
  },
  {
    value: "renovation_roi",
    labelKey: "areaMagnetStudio.magnetOptions.renovationRoi.label",
    descriptionKey: "areaMagnetStudio.magnetOptions.renovationRoi.description",
  },
] as const;

const audienceOptions = [
  { value: "seller", labelKey: "areaMagnetStudio.audienceOptions.seller" },
  { value: "buyer", labelKey: "areaMagnetStudio.audienceOptions.buyer" },
  { value: "investor", labelKey: "areaMagnetStudio.audienceOptions.investor" },
  { value: "move_up", labelKey: "areaMagnetStudio.audienceOptions.moveUp" },
] as const;

const toneOptions = [
  { value: "advisory", labelKey: "areaMagnetStudio.toneOptions.advisory" },
  { value: "urgent", labelKey: "areaMagnetStudio.toneOptions.urgent" },
  { value: "luxury", labelKey: "areaMagnetStudio.toneOptions.luxury" },
] as const;

function formatActivityTime(
  locale: "zh" | "en",
  value: string | null,
  fallback: string
) {
  if (!value) return fallback;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat(localeTag(locale), {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed);
}

function describeSessionStatus(
  copy: {
    statusActive: string;
    statusRevoked: string;
    statusExpired: string;
  },
  status: string
) {
  switch (status) {
    case "active":
      return copy.statusActive;
    case "revoked":
      return copy.statusRevoked;
    case "expired":
      return copy.statusExpired;
    default:
      return status;
  }
}

function describeFollowUpSignal(
  copy: {
    followHot: string;
    followWarm: string;
    followNew: string;
    followQuiet: string;
  },
  signal: string
) {
  switch (signal) {
    case "hot":
      return copy.followHot;
    case "warm":
      return copy.followWarm;
    case "new":
      return copy.followNew;
    default:
      return copy.followQuiet;
  }
}

function followUpTone(signal: string) {
  switch (signal) {
    case "hot":
      return "border-red-200 bg-red-50 text-red-700";
    case "warm":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "new":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    default:
      return "border-stone-200 bg-stone-50 text-stone-600";
  }
}

export default function AreaMagnetStudio() {
  const { user } = useAuth();
  const { locale } = useT();
  const t = createTranslator(locale);
  const copy = {
    heroBadge: t("areaMagnetStudio.heroBadge"),
    heroTitle: t("areaMagnetStudio.heroTitle"),
    heroDescription: t("areaMagnetStudio.heroDescription"),
    bridgeLabel: t("areaMagnetStudio.bridgeLabel"),
    bridgeAction: t("areaMagnetStudio.bridgeAction"),
    formTitle: t("areaMagnetStudio.formTitle"),
    formDescription: t("areaMagnetStudio.formDescription"),
    advancedToggle: t("areaMagnetStudio.advancedToggle"),
    create: t("areaMagnetStudio.create"),
    creating: t("areaMagnetStudio.creating"),
    openShare: t("areaMagnetStudio.openShare"),
    copyLink: t("areaMagnetStudio.copyLink"),
    copySuccess: t("areaMagnetStudio.copySuccess"),
    copyFailure: t("areaMagnetStudio.copyFailure"),
    sectionResult: t("areaMagnetStudio.sectionResult"),
    resultEmpty: t("areaMagnetStudio.resultEmpty"),
    tabsPreview: t("areaMagnetStudio.tabsPreview"),
    libraryTitle: t("areaMagnetStudio.libraryTitle"),
    libraryDescription: t("areaMagnetStudio.libraryDescription"),
    emptyLibrary: t("areaMagnetStudio.emptyLibrary"),
    generatedToast: t("areaMagnetStudio.generatedToast"),
    generateFailed: t("areaMagnetStudio.generateFailed"),
    revoked: t("areaMagnetStudio.revoked"),
    revokeFailed: t("areaMagnetStudio.revokeFailed"),
    refresh: t("areaMagnetStudio.refresh"),
    refreshing: t("areaMagnetStudio.refreshing"),
    loadingLibrary: t("areaMagnetStudio.loadingLibrary"),
    scopeLabel: t("areaMagnetStudio.scopeLabel"),
    captureLabel: t("areaMagnetStudio.captureLabel"),
    phoneField: t("areaMagnetStudio.phoneField"),
    emailField: t("areaMagnetStudio.emailField"),
    audienceLabel: t("areaMagnetStudio.audienceLabel"),
    toneLabel: t("areaMagnetStudio.toneLabel"),
    outputLabel: t("areaMagnetStudio.outputLabel"),
    statsViews: t("areaMagnetStudio.statsViews"),
    statsLeads: t("areaMagnetStudio.statsLeads"),
    statsListings: t("areaMagnetStudio.statsListings"),
    lastActivity: t("areaMagnetStudio.lastActivity"),
    createdAt: t("areaMagnetStudio.createdAt"),
    statusActive: t("areaMagnetStudio.statusActive"),
    statusRevoked: t("areaMagnetStudio.statusRevoked"),
    statusExpired: t("areaMagnetStudio.statusExpired"),
    followHot: t("areaMagnetStudio.followHot"),
    followWarm: t("areaMagnetStudio.followWarm"),
    followNew: t("areaMagnetStudio.followNew"),
    followQuiet: t("areaMagnetStudio.followQuiet"),
    revoke: t("areaMagnetStudio.revoke"),
    generatedBy: t("areaMagnetStudio.generatedBy"),
    fallbackUsed: t("areaMagnetStudio.fallbackUsed"),
    agentFields: {
      title: t("areaMagnetStudio.agentFields.title"),
      phone: t("areaMagnetStudio.agentFields.phone"),
      email: t("areaMagnetStudio.agentFields.email"),
      wechat: t("areaMagnetStudio.agentFields.wechat"),
      avatar: t("areaMagnetStudio.agentFields.avatar"),
      company: t("areaMagnetStudio.agentFields.company"),
    },
    outputItems: [
      t("areaMagnetStudio.outputItems.marketInsight"),
      t("areaMagnetStudio.outputItems.landingPage"),
      t("areaMagnetStudio.outputItems.socialKit"),
      t("areaMagnetStudio.outputItems.leadSignals"),
    ],
    tabs: [
      t("areaMagnetStudio.tabs.overview"),
      t("areaMagnetStudio.tabs.report"),
      t("areaMagnetStudio.tabs.shareKit"),
    ],
    metricFallback: t("areaMagnetStudio.metricFallback"),
    libraryFallbackTitle: t("areaMagnetStudio.libraryFallbackTitle"),
  } as const;
  const localizedScopeOptions = scopeOptions.map((option) => ({
    ...option,
    label: t(option.labelKey),
    placeholder: t(option.placeholderKey),
  }));
  const localizedMagnetOptions = magnetOptions.map((option) => ({
    ...option,
    label: t(option.labelKey),
    description: t(option.descriptionKey),
  }));
  const localizedAudienceOptions = audienceOptions.map((option) => ({
    ...option,
    label: t(option.labelKey),
  }));
  const localizedToneOptions = toneOptions.map((option) => ({
    ...option,
    label: t(option.labelKey),
  }));
  const utils = trpc.useUtils();
  const [scopeType, setScopeType] = useState<ScopeType>("zip");
  const [query, setQuery] = useState("");
  const [magnetType, setMagnetType] = useState<MagnetType>("spring_market");
  const [audience, setAudience] = useState<Audience>("seller");
  const [tone, setTone] = useState<Tone>("advisory");
  const [captureEmail, setCaptureEmail] = useState(true);
  const [capturePhone, setCapturePhone] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [generatedShareUrl, setGeneratedShareUrl] = useState("");
  const [generatedPreview, setGeneratedPreview] = useState<{
    title: string;
    scopeLabel: string;
    summary: string;
    strategyPoints: string[];
    metrics: Array<{ label?: string; value?: string; detail?: string }>;
    generatedBy: { model: string; usedFallback: boolean } | null;
  } | null>(null);

  const PROFILE_KEY = "bbo_agent_profile";

  const loadSavedProfile = useCallback(() => {
    try {
      const saved = localStorage.getItem(PROFILE_KEY);
      if (saved) return JSON.parse(saved) as Record<string, string>;
    } catch {
      // ignore
    }
    return null;
  }, []);

  const [agentTitle, setAgentTitle] = useState("");
  const [agentPhone, setAgentPhone] = useState("");
  const [agentEmail, setAgentEmail] = useState("");
  const [agentWechatId, setAgentWechatId] = useState("");
  const [agentAvatarUrl, setAgentAvatarUrl] = useState("");
  const [agentCompany, setAgentCompany] = useState("");

  useEffect(() => {
    const saved = loadSavedProfile();
    if (saved) {
      if (saved.agentTitle) setAgentTitle(saved.agentTitle);
      if (saved.agentPhone) setAgentPhone(saved.agentPhone);
      if (saved.agentWechatId) setAgentWechatId(saved.agentWechatId);
      if (saved.agentCompany) setAgentCompany(saved.agentCompany);
    }
  }, [loadSavedProfile]);

  useEffect(() => {
    const profile = { agentTitle, agentPhone, agentWechatId, agentCompany };
    const hasValue = Object.values(profile).some(
      (value) => value.trim().length > 0
    );
    if (hasValue) {
      try {
        localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
      } catch {
        // ignore
      }
    }
  }, [agentTitle, agentPhone, agentWechatId, agentCompany]);

  useEffect(() => {
    if (user?.email && !agentEmail) setAgentEmail(user.email);
    if (
      (user as { picture?: string | null } | null)?.picture &&
      !agentAvatarUrl
    ) {
      setAgentAvatarUrl(
        (user as { picture?: string }).picture || ""
      );
    }
  }, [agentAvatarUrl, agentEmail, user]);

  const captureFields = useMemo<Array<"email" | "phone">>(() => {
    const values: Array<"email" | "phone"> = [];
    if (captureEmail) values.push("email");
    if (capturePhone) values.push("phone");
    return values.length > 0
      ? values
      : (["email"] as Array<"email" | "phone">);
  }, [captureEmail, capturePhone]);

  const createAreaMagnetMutation = trpc.share.createAreaMagnet.useMutation({
    onSuccess: async (data) => {
      const shareUrl =
        data.shareUrl ?? `${window.location.origin}${data.sharePath}`;
      setGeneratedShareUrl(shareUrl);
      setGeneratedPreview({
        title: data.title,
        scopeLabel: data.scopeLabel,
        summary: data.preview.summary,
        strategyPoints: data.preview.strategyPoints,
        metrics:
          (data.preview.metrics as Array<{
            label?: string;
            value?: string;
            detail?: string;
          }>) ?? [],
        generatedBy: data.generatedBy,
      });
      try {
        await navigator.clipboard.writeText(shareUrl);
      } catch {
        // clipboard is best effort only
      }
      await utils.share.listMine.invalidate({ sessionType: "area_magnet" });
      toast.success(copy.generatedToast, { description: shareUrl });
    },
    onError: (error) => {
      toast.error(copy.generateFailed, { description: error.message });
    },
  });

  const mySharesQuery = trpc.share.listMine.useQuery(
    { sessionType: "area_magnet" },
    { refetchOnWindowFocus: false }
  );

  const revokeShareMutation = trpc.share.revokeSession.useMutation({
    onSuccess: async () => {
      await utils.share.listMine.invalidate({ sessionType: "area_magnet" });
      toast.success(copy.revoked);
    },
    onError: (error) => {
      toast.error(copy.revokeFailed, { description: error.message });
    },
  });

  const handleCreate = () => {
    if (!query.trim()) {
      toast.error(copy.scopeLabel);
      return;
    }

    const agentBranding =
      agentTitle ||
      agentPhone ||
      agentEmail ||
      agentWechatId ||
      agentAvatarUrl ||
      agentCompany
        ? {
            agentTitle: agentTitle.trim() || undefined,
            phone: agentPhone.trim() || undefined,
            email: agentEmail.trim() || undefined,
            wechatId: agentWechatId.trim() || undefined,
            avatarUrl: agentAvatarUrl.trim() || undefined,
            brokerageName: agentCompany.trim() || undefined,
          }
        : {};

    createAreaMagnetMutation.mutate({
      scopeType,
      query: query.trim(),
      magnetType,
      audience,
      captureFields,
      tone,
      agentBranding,
    });
  };

  const handleCopyShareLink = async (sharePath: string) => {
    const shareUrl = `${window.location.origin}${sharePath}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success(copy.copySuccess, { description: shareUrl });
    } catch {
      toast.error(copy.copyFailure);
    }
  };

  const selectedScope =
    localizedScopeOptions.find((option) => option.value === scopeType) ??
    localizedScopeOptions[0];

  return (
    <div className="space-y-6 pb-8">
      <div className="rounded-3xl border border-primary/10 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.16),_transparent_34%),linear-gradient(135deg,_rgba(255,255,255,0.98),_rgba(247,250,247,0.96))] p-6 text-foreground shadow-sm md:p-8">
        <div className="flex flex-wrap items-center gap-2 text-sm text-primary">
          <Badge
            variant="outline"
            className="rounded-full border-primary/20 bg-white/70 px-3 py-1 text-[11px] uppercase tracking-[0.24em]"
          >
            {copy.heroBadge}
          </Badge>
          <Badge
            variant="outline"
            className="rounded-full border-primary/20 bg-white/50 px-3 py-1 text-[11px] uppercase tracking-[0.24em]"
          >
            {copy.bridgeLabel}
          </Badge>
        </div>
        <div className="mt-4 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl space-y-3">
            <h1 className="text-3xl font-serif tracking-tight md:text-4xl">
              {copy.heroTitle}
            </h1>
            <p className="text-sm leading-7 text-muted-foreground md:text-base">
              {copy.heroDescription}
            </p>
          </div>
          <Button
            asChild
            variant="outline"
            className="rounded-full border-primary/25 bg-white/80"
          >
            <Link href="/magic-share">
              {copy.bridgeAction}
              <Share2 className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardHeader>
            <CardTitle>{copy.formTitle}</CardTitle>
            <CardDescription>{copy.formDescription}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 md:grid-cols-[180px_minmax(0,1fr)]">
              <div className="space-y-2">
                <Label>{copy.scopeLabel}</Label>
                <Select
                  value={scopeType}
                  onValueChange={(value: ScopeType) => setScopeType(value)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {localizedScopeOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{selectedScope.label}</Label>
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={selectedScope.placeholder}
                />
              </div>
            </div>

            <div className="space-y-3">
              <Label>{copy.formTitle}</Label>
              <div className="grid gap-3 md:grid-cols-2">
                {localizedMagnetOptions.map((option) => {
                  const active = option.value === magnetType;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      className={`rounded-2xl border p-4 text-left transition ${active ? "border-primary bg-primary/5 shadow-sm" : "border-border bg-background hover:border-primary/30"}`}
                      onClick={() => setMagnetType(option.value)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-foreground">
                            {option.label}
                          </p>
                          <p className="mt-2 text-sm leading-6 text-muted-foreground">
                            {option.description}
                          </p>
                        </div>
                        {active ? (
                          <Sparkles className="h-4 w-4 text-primary" />
                        ) : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>{copy.audienceLabel}</Label>
                <Select
                  value={audience}
                  onValueChange={(value: Audience) => setAudience(value)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {localizedAudienceOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{copy.toneLabel}</Label>
                <Select
                  value={tone}
                  onValueChange={(value: Tone) => setTone(value)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {localizedToneOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{copy.captureLabel}</Label>
                <div className="flex min-h-9 items-center gap-4 rounded-xl border bg-background px-3">
                  <Label className="gap-2 text-sm font-normal">
                    <Checkbox
                      checked={captureEmail}
                      onCheckedChange={(value) =>
                        setCaptureEmail(Boolean(value))
                      }
                    />
                    {copy.emailField}
                  </Label>
                  <Label className="gap-2 text-sm font-normal">
                    <Checkbox
                      checked={capturePhone}
                      onCheckedChange={(value) =>
                        setCapturePhone(Boolean(value))
                      }
                    />
                    {copy.phoneField}
                  </Label>
                </div>
              </div>
            </div>

            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-lg border border-dashed p-3 text-sm text-muted-foreground transition-colors hover:border-primary/30 hover:text-primary"
              onClick={() => setShowAdvanced((value) => !value)}
            >
              <Layers3 className="h-4 w-4" />
              {copy.advancedToggle}
            </button>

            {showAdvanced ? (
              <div className="grid grid-cols-1 gap-3 rounded-2xl border bg-muted/10 p-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>{copy.agentFields.title}</Label>
                  <Input
                    value={agentTitle}
                    onChange={(event) => setAgentTitle(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{copy.agentFields.phone}</Label>
                  <Input
                    value={agentPhone}
                    onChange={(event) => setAgentPhone(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{copy.agentFields.email}</Label>
                  <Input
                    value={agentEmail}
                    onChange={(event) => setAgentEmail(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{copy.agentFields.wechat}</Label>
                  <Input
                    value={agentWechatId}
                    onChange={(event) => setAgentWechatId(event.target.value)}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>{copy.agentFields.avatar}</Label>
                  <Input
                    value={agentAvatarUrl}
                    onChange={(event) => setAgentAvatarUrl(event.target.value)}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>{copy.agentFields.company}</Label>
                  <Input
                    value={agentCompany}
                    onChange={(event) => setAgentCompany(event.target.value)}
                  />
                </div>
              </div>
            ) : null}

            <Button
              className="w-full gap-2"
              size="lg"
              disabled={createAreaMagnetMutation.isPending}
              onClick={handleCreate}
            >
              {createAreaMagnetMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {copy.creating}
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  {copy.create}
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{copy.sectionResult}</CardTitle>
            <CardDescription>{copy.outputLabel}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              {copy.outputItems.map((item) => (
                <div
                  key={item}
                  className="rounded-2xl border bg-muted/10 p-4 text-sm text-muted-foreground"
                >
                  {item}
                </div>
              ))}
            </div>

            <div className="rounded-2xl border bg-muted/10 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                {copy.tabsPreview}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {copy.tabs.map((item) => (
                  <Badge
                    key={item}
                    variant="secondary"
                    className="rounded-full px-3 py-1"
                  >
                    {item}
                  </Badge>
                ))}
              </div>
            </div>

            {generatedPreview ? (
              <div className="space-y-4 rounded-2xl border bg-white p-4 shadow-sm">
                <div className="space-y-2">
                  <Badge variant="outline" className="rounded-full">
                    {generatedPreview.scopeLabel}
                  </Badge>
                  <h3 className="text-xl font-serif text-foreground">
                    {generatedPreview.title}
                  </h3>
                  <p className="text-sm leading-7 text-muted-foreground">
                    {generatedPreview.summary}
                  </p>
                </div>

                {generatedPreview.generatedBy ? (
                  <div className="rounded-2xl border bg-muted/10 p-3 text-sm text-muted-foreground">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-foreground">
                        {copy.generatedBy}:
                      </span>
                      <Badge variant="secondary">
                        {generatedPreview.generatedBy.model}
                      </Badge>
                      {generatedPreview.generatedBy.usedFallback ? (
                        <Badge variant="outline">{copy.fallbackUsed}</Badge>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                <div className="space-y-2">
                  {generatedPreview.strategyPoints.map((point) => (
                    <div
                      key={point}
                      className="rounded-xl border bg-muted/10 p-3 text-sm text-foreground"
                    >
                      {point}
                    </div>
                  ))}
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  {generatedPreview.metrics.slice(0, 4).map((metric, index) => (
                    <div
                      key={`${metric.label}-${index}`}
                      className="rounded-2xl border bg-muted/10 p-4"
                    >
                      <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                        {metric.label || copy.metricFallback}
                      </p>
                      <p className="mt-2 text-xl font-semibold text-foreground">
                        {metric.value || "\u2014"}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {metric.detail || ""}
                      </p>
                    </div>
                  ))}
                </div>

                {generatedShareUrl ? (
                  <div className="rounded-2xl border bg-muted/10 p-4">
                    <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                      Share URL
                    </p>
                    <p className="mt-2 break-all text-sm font-medium text-foreground">
                      {generatedShareUrl}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          handleCopyShareLink(
                            generatedShareUrl.replace(
                              window.location.origin,
                              ""
                            )
                          )
                        }
                      >
                        <Copy className="mr-2 h-4 w-4" />
                        {copy.copyLink}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          window.open(
                            generatedShareUrl,
                            "_blank",
                            "noopener,noreferrer"
                          )
                        }
                      >
                        <ExternalLink className="mr-2 h-4 w-4" />
                        {copy.openShare}
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed bg-muted/10 p-5 text-sm text-muted-foreground">
                {copy.resultEmpty}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>{copy.libraryTitle}</CardTitle>
            <CardDescription>{copy.libraryDescription}</CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={mySharesQuery.isFetching}
            onClick={() => mySharesQuery.refetch()}
          >
            {mySharesQuery.isFetching ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {copy.refreshing}
              </>
            ) : (
              copy.refresh
            )}
          </Button>
        </CardHeader>
        <CardContent>
          {mySharesQuery.isLoading ? (
            <div className="flex items-center py-8 text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {copy.loadingLibrary}
            </div>
          ) : (mySharesQuery.data?.length ?? 0) === 0 ? (
            <div className="rounded-2xl border border-dashed bg-muted/10 p-6 text-sm text-muted-foreground">
              {copy.emptyLibrary}
            </div>
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              {mySharesQuery.data?.map((share) => (
                <div
                  key={share.token}
                  className="rounded-2xl border bg-muted/10 p-4 shadow-sm"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {share.title ||
                          share.scopeLabel ||
                          copy.libraryFallbackTitle}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {share.scopeLabel || share.sharePath}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge
                        variant={
                          share.status === "active" ? "default" : "secondary"
                        }
                      >
                        {describeSessionStatus(copy, share.status)}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={followUpTone(share.followUpSignal)}
                      >
                        {describeFollowUpSignal(copy, share.followUpSignal)}
                      </Badge>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-3">
                    <div className="rounded-xl border bg-background/70 p-3">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        {copy.statsViews}
                      </p>
                      <div className="mt-2 flex items-center gap-2 text-lg font-semibold">
                        <BarChart3 className="h-4 w-4 text-muted-foreground" />
                        {share.viewCount}
                      </div>
                    </div>
                    <div className="rounded-xl border bg-background/70 p-3">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        {copy.statsLeads}
                      </p>
                      <div className="mt-2 flex items-center gap-2 text-lg font-semibold">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        {share.leadCount}
                      </div>
                    </div>
                    <div className="rounded-xl border bg-background/70 p-3">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        {copy.statsListings}
                      </p>
                      <div className="mt-2 flex items-center gap-2 text-lg font-semibold">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        {share.listingCount}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                    <Phone className="h-3.5 w-3.5" />
                    {share.lastActivityAt
                      ? `${copy.lastActivity} ${formatActivityTime(locale, share.lastActivityAt, copy.createdAt)}`
                      : `${copy.createdAt} ${formatActivityTime(locale, share.createdAt, copy.createdAt)}`}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCopyShareLink(share.sharePath)}
                    >
                      <Copy className="mr-2 h-4 w-4" />
                      {copy.copyLink}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        window.open(
                          `${window.location.origin}${share.sharePath}`,
                          "_blank",
                          "noopener,noreferrer"
                        )
                      }
                    >
                      <ExternalLink className="mr-2 h-4 w-4" />
                      {copy.openShare}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      disabled={
                        share.status !== "active" ||
                        revokeShareMutation.isPending
                      }
                      onClick={() =>
                        revokeShareMutation.mutate({ token: share.token })
                      }
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      {copy.revoke}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
