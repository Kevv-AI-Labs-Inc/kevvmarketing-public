"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { useT } from "@/i18n";
import { trpc } from "@/lib/trpc";
import type { LdsProperty } from "@/server/mls/mlsRouter";
import {
  BookImage,
  Check,
  ClipboardCopy,
  ExternalLink,
  MapPin,
  ImageIcon,
  Loader2,
  Search,
  Sparkles,
  Zap,
} from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";

// ─── Platform Definitions ──────────────────────────────────

type PlatformId =
  | "xiaohongshu"
  | "instagram"
  | "linkedin"
  | "wechat"
  | "tiktok"
  | "facebook";

interface PlatformConfig {
  id: PlatformId;
  icon: string;
  labelKey: string;
  accentClass: string; // Tailwind classes for theming
  bgClass: string;
  borderClass: string;
  badgeClass: string;
  deepLink: string;
  webUrl: string;
  publishLabelKey: string;
  hasHashtags: boolean;
  hasPhotoTips: boolean;
  hasSubject: boolean; // WeChat: summary field
  charLimit?: number; // soft limit for body
  titleLimit?: number;
}

const PLATFORMS: PlatformConfig[] = [
  {
    id: "xiaohongshu",
    icon: "🔴",
    labelKey: "socialStudio.platformXhs",
    accentClass: "text-red-500",
    bgClass: "bg-red-500/5",
    borderClass: "border-red-500/10",
    badgeClass: "text-red-500 bg-red-500/10 border-red-500/20",
    deepLink: "xhsdiscover://",
    webUrl: "https://creator.xiaohongshu.com/publish/publish",
    publishLabelKey: "socialStudio.openXhs",
    hasHashtags: true,
    hasPhotoTips: true,
    hasSubject: false,
    charLimit: 3000,
    titleLimit: 20,
  },
  {
    id: "instagram",
    icon: "📸",
    labelKey: "socialStudio.platformInstagram",
    accentClass: "text-pink-500",
    bgClass: "bg-gradient-to-r from-purple-500/5 to-pink-500/5",
    borderClass: "border-pink-500/10",
    badgeClass: "text-pink-500 bg-pink-500/10 border-pink-500/20",
    deepLink: "instagram://",
    webUrl: "https://www.instagram.com",
    publishLabelKey: "socialStudio.openInstagram",
    hasHashtags: true,
    hasPhotoTips: true,
    hasSubject: false,
    charLimit: 2200,
  },
  {
    id: "linkedin",
    icon: "💼",
    labelKey: "socialStudio.platformLinkedin",
    accentClass: "text-blue-600",
    bgClass: "bg-blue-600/5",
    borderClass: "border-blue-600/10",
    badgeClass: "text-blue-600 bg-blue-600/10 border-blue-600/20",
    deepLink: "linkedin://",
    webUrl: "https://www.linkedin.com/feed/",
    publishLabelKey: "socialStudio.openLinkedin",
    hasHashtags: true,
    hasPhotoTips: false,
    hasSubject: false,
    charLimit: 3000,
  },
  {
    id: "wechat",
    icon: "💬",
    labelKey: "socialStudio.platformWechat",
    accentClass: "text-green-500",
    bgClass: "bg-green-500/5",
    borderClass: "border-green-500/10",
    badgeClass: "text-green-500 bg-green-500/10 border-green-500/20",
    deepLink: "weixin://",
    webUrl: "https://mp.weixin.qq.com",
    publishLabelKey: "socialStudio.openWechat",
    hasHashtags: false,
    hasPhotoTips: true,
    hasSubject: true,
    charLimit: 200,
    titleLimit: 31,
  },
  {
    id: "tiktok",
    icon: "🎵",
    labelKey: "socialStudio.platformTiktok",
    accentClass: "text-zinc-100",
    bgClass: "bg-zinc-900",
    borderClass: "border-zinc-700",
    badgeClass: "text-cyan-400 bg-cyan-900/30 border-cyan-400/20",
    deepLink: "snssdk1233://",
    webUrl: "https://www.tiktok.com/upload",
    publishLabelKey: "socialStudio.openTiktok",
    hasHashtags: true,
    hasPhotoTips: false,
    hasSubject: false,
    charLimit: 4000,
    titleLimit: 150,
  },
  {
    id: "facebook",
    icon: "📘",
    labelKey: "socialStudio.platformFacebook",
    accentClass: "text-blue-500",
    bgClass: "bg-blue-500/5",
    borderClass: "border-blue-500/10",
    badgeClass: "text-blue-500 bg-blue-500/10 border-blue-500/20",
    deepLink: "fb://",
    webUrl: "https://www.facebook.com",
    publishLabelKey: "socialStudio.openFacebook",
    hasHashtags: true,
    hasPhotoTips: false,
    hasSubject: false,
    charLimit: 63206,
  },
];

// ─── Result type ───────────────────────────────────────────

interface SocialResult {
  title: string;
  subject: string;
  body: string;
  hashtags: string[];
  photoTips: string[];
  platform: string;
  language: string;
}

type SourceMode = "mls" | "manual";

function formatPriceDisplay(value?: string | null): string {
  if (!value) return "—";
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return value;
  return `$${numeric.toLocaleString()}`;
}

function getBathCount(listing?: LdsProperty | null): number | null {
  if (!listing) return null;
  return (
    listing.bathroomsTotalInteger ??
    listing.bathroomsFull ??
    null
  );
}

function getListingImage(listing?: LdsProperty | null): string | null {
  if (!listing) return null;
  const mediaUrl = listing.media?.find((item) => item.mediaURL || item.url)?.mediaURL
    ?? listing.media?.find((item) => item.mediaURL || item.url)?.url;
  return mediaUrl ?? listing.thumbnailUrl ?? null;
}

// ─── Component ─────────────────────────────────────────────

export default function SocialStudio() {
  const { user } = useAuth();
  const { t } = useT();

  // Platform state
  const [activePlatform, setActivePlatform] = useState<PlatformId>("xiaohongshu");
  const platform = PLATFORMS.find((p) => p.id === activePlatform)!;

  // Source mode
  const [sourceMode, setSourceMode] = useState<SourceMode>("mls");
  const [listingSearch, setListingSearch] = useState("");
  const [selectedListingKey, setSelectedListingKey] = useState("");

  // Manual form state
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [price, setPrice] = useState("");
  const [propertyType, setPropertyType] = useState("");
  const [beds, setBeds] = useState("");
  const [baths, setBaths] = useState("");
  const [sqft, setSqft] = useState("");
  const [highlights, setHighlights] = useState("");
  const [customPrompt, setCustomPrompt] = useState("");
  const [tone, setTone] = useState<"professional" | "casual" | "luxury" | "friendly">("professional");

  // Results per platform
  const [results, setResults] = useState<Partial<Record<PlatformId, SocialResult>>>({});
  const [copied, setCopied] = useState(false);

  const currentResult = results[activePlatform] ?? null;
  const searchResultsQuery = trpc.mls.getProperties.useQuery(
    {
      search: listingSearch.trim() || undefined,
      limit: 12,
      offset: 0,
      status: "Active",
    },
    {
      enabled: sourceMode === "mls" && listingSearch.trim().length > 1,
    },
  );
  const selectedListingQuery = trpc.mls.getPropertyById.useQuery(
    { listingKey: selectedListingKey },
    {
      enabled: sourceMode === "mls" && selectedListingKey.length > 0,
      refetchOnWindowFocus: false,
    },
  );
  const searchResults = (searchResultsQuery.data ?? []) as LdsProperty[];
  const selectedListing = (selectedListingQuery.data ?? null) as LdsProperty | null;

  const buildMutationInput = useCallback(
    (platformId: PlatformId) => ({
      platform: platformId,
      agentName: user?.name ?? "Agent",
      agentTitle: undefined,
      customPrompt: customPrompt.trim() || undefined,
      tone,
      listingKey:
        sourceMode === "mls" && selectedListingKey.length > 0
          ? selectedListingKey
          : undefined,
      address: sourceMode === "manual" ? address.trim() || undefined : undefined,
      city: sourceMode === "manual" ? city.trim() || undefined : undefined,
      price: sourceMode === "manual" ? price.trim() || undefined : undefined,
      propertyType:
        sourceMode === "manual" ? propertyType.trim() || undefined : undefined,
      beds: sourceMode === "manual" && beds ? Number(beds) : undefined,
      baths: sourceMode === "manual" && baths ? Number(baths) : undefined,
      sqft: sourceMode === "manual" && sqft ? Number(sqft) : undefined,
      highlights:
        sourceMode === "manual" ? highlights.trim() || undefined : undefined,
    }),
    [
      address,
      baths,
      beds,
      city,
      customPrompt,
      highlights,
      price,
      propertyType,
      selectedListingKey,
      sourceMode,
      sqft,
      tone,
      user,
    ],
  );

  const ensureReady = useCallback(() => {
    if (sourceMode === "mls" && !selectedListingKey) {
      toast.error(t("socialStudio.selectListingFirst"));
      return false;
    }
    if (sourceMode === "manual" && !address.trim()) {
      toast.error(t("socialStudio.enterAddressFirst"));
      return false;
    }
    return true;
  }, [address, selectedListingKey, sourceMode, t]);

  // ── Generate mutation ──
  const generateMutation = trpc.content.socialGenerate.useMutation({
    onSuccess: (data) => {
      setResults((prev) => ({
        ...prev,
        [data.platform as PlatformId]: data,
      }));
      toast.success(t("socialStudio.generated"));
    },
    onError: (err) =>
      toast.error(t("socialStudio.generateFailed"), {
        description: err.message,
      }),
  });

  // ── Generate for current platform ──
  const handleGenerate = useCallback(() => {
    if (!ensureReady()) return;
    generateMutation.mutate(buildMutationInput(activePlatform));
  }, [activePlatform, buildMutationInput, ensureReady, generateMutation]);

  // ── Generate ALL platforms ──
  const [generatingAll, setGeneratingAll] = useState(false);
  const handleGenerateAll = useCallback(async () => {
    if (!ensureReady()) return;
    setGeneratingAll(true);
    const platformIds: PlatformId[] = ["xiaohongshu", "instagram", "linkedin", "wechat", "tiktok", "facebook"];
    try {
      const promises = platformIds.map((pid) =>
        generateMutation.mutateAsync(buildMutationInput(pid))
      );
      const settled = await Promise.allSettled(promises);
      const newResults: Partial<Record<PlatformId, SocialResult>> = { ...results };
      settled.forEach((r, i) => {
        if (r.status === "fulfilled") {
          newResults[platformIds[i]] = r.value;
        }
      });
      setResults(newResults);
      const count = settled.filter((r) => r.status === "fulfilled").length;
      toast.success(t("socialStudio.allGenerated"), { description: `${count}/6` });
    } catch {
      toast.error(t("socialStudio.generateFailed"));
    } finally {
      setGeneratingAll(false);
    }
  }, [buildMutationInput, ensureReady, generateMutation, results, t]);

  // ── Copy ──
  const copyAll = useCallback(async () => {
    if (!currentResult) return;
    const parts = [];
    if (currentResult.title) parts.push(currentResult.title);
    if (currentResult.subject) parts.push(currentResult.subject);
    parts.push("");
    parts.push(currentResult.body);
    if (currentResult.hashtags.length > 0) {
      parts.push("");
      parts.push(currentResult.hashtags.join(" "));
    }
    const fullText = parts.join("\n");

    try {
      await navigator.clipboard.writeText(fullText);
      setCopied(true);
      toast.success(t("socialStudio.clipboardSuccess"));
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error(t("socialStudio.clipboardFailed"));
    }
  }, [currentResult, t]);

  // ── Open Platform ──
  const openPlatform = useCallback(() => {
    if (/iPhone|iPad|Android/i.test(navigator.userAgent)) {
      window.location.href = platform.deepLink;
      setTimeout(() => window.open(platform.webUrl, "_blank"), 1500);
    } else {
      window.open(platform.webUrl, "_blank");
    }
  }, [platform]);

  // ── Char counts ──
  const bodyLen = currentResult?.body.length ?? 0;
  const titleLen = currentResult?.title.length ?? 0;

  // ── Count generated platforms ──
  const generatedCount = Object.keys(results).length;

  return (
    <div className="space-y-6 pb-8">
      {/* Hero Header */}
      <div className="rounded-3xl border border-primary/10 bg-gradient-to-br from-violet-500/5 via-pink-500/3 to-transparent p-6 text-foreground shadow-sm md:p-8">
        <div className="flex items-center gap-2 text-sm text-primary">
          <Sparkles className="h-4 w-4" />
          {t("socialStudio.eyebrow")}
        </div>
        <h1 className="mt-2 text-3xl font-serif tracking-tight md:text-4xl">
          {t("socialStudio.heroTitle")}
        </h1>
        <p className="mt-3 max-w-3xl text-sm text-muted-foreground md:text-base">
          {t("socialStudio.heroDescription")}
        </p>
        {generatedCount > 0 && (
          <div className="mt-3 flex items-center gap-2">
            {PLATFORMS.map((p) => {
              const done = !!results[p.id];
              return (
                <button
                  key={p.id}
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-sm transition ${
                    done ? "bg-primary/10 ring-2 ring-primary/30" : "bg-muted opacity-40"
                  }`}
                  onClick={() => setActivePlatform(p.id)}
                  title={t(p.labelKey as Parameters<typeof t>[0])}
                >
                  {p.icon}
                </button>
              );
            })}
            <Badge variant="secondary" className="ml-2 text-xs">
              {generatedCount}/6
            </Badge>
          </div>
        )}
      </div>

      {/* Platform Tab Bar */}
      <Tabs value={activePlatform} onValueChange={(v) => setActivePlatform(v as PlatformId)}>
        <TabsList className="grid w-full grid-cols-6 h-auto">
          {PLATFORMS.map((p) => (
            <TabsTrigger
              key={p.id}
              value={p.id}
              className="flex items-center gap-1.5 text-xs data-[state=active]:shadow-sm py-2.5"
            >
              <span>{p.icon}</span>
              <span className="hidden sm:inline">{t(p.labelKey as Parameters<typeof t>[0])}</span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left: Input form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Sparkles className="h-4 w-4 text-primary" />
              {t("socialStudio.propertyInfo")}
            </CardTitle>
            <CardDescription>
              {t("socialStudio.propertyInfoDesc")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{t("socialStudio.sourceMode")}</Label>
              <Tabs
                value={sourceMode}
                onValueChange={(value) => setSourceMode(value as SourceMode)}
              >
                <TabsList className="grid h-auto w-full grid-cols-2">
                  <TabsTrigger value="mls" className="py-2.5 text-xs sm:text-sm">
                    {t("socialStudio.sourceMls")}
                  </TabsTrigger>
                  <TabsTrigger value="manual" className="py-2.5 text-xs sm:text-sm">
                    {t("socialStudio.sourceManual")}
                  </TabsTrigger>
                </TabsList>
              </Tabs>
              <p className="text-xs text-muted-foreground">
                {sourceMode === "mls"
                  ? t("socialStudio.sourceMlsDescription")
                  : t("socialStudio.sourceManualDescription")}
              </p>
            </div>

            {sourceMode === "mls" ? (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>{t("socialStudio.listingSearch")}</Label>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={listingSearch}
                      onChange={(e) => setListingSearch(e.target.value)}
                      className="pl-9"
                      placeholder={t("socialStudio.listingSearchPlaceholder")}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t("socialStudio.listingSearchHint")}
                  </p>
                </div>

                {selectedListing ? (
                  <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-muted">
                        {getListingImage(selectedListing) ? (
                          <img
                            src={getListingImage(selectedListing) ?? ""}
                            alt={selectedListing.unparsedAddress ?? ""}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <ImageIcon className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="secondary">{t("socialStudio.selectedListing")}</Badge>
                          {selectedListing.listingId ? (
                            <Badge variant="outline">
                              {t("socialStudio.mlsNumber")}: {selectedListing.listingId}
                            </Badge>
                          ) : null}
                          {selectedListing.standardStatus ? (
                            <Badge variant="outline">{selectedListing.standardStatus}</Badge>
                          ) : null}
                        </div>
                        <div>
                          <p className="font-medium leading-tight">
                            {selectedListing.unparsedAddress || t("socialStudio.address")}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {[selectedListing.city, selectedListing.stateOrProvince]
                              .filter(Boolean)
                              .join(", ")}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                          <span>{formatPriceDisplay(selectedListing.listPrice)}</span>
                          <span>
                            {(selectedListing.bedroomsTotal ?? "—")}
                            {t("socialStudio.bedsShort")}
                          </span>
                          <span>
                            {(getBathCount(selectedListing) ?? "—")}
                            {t("socialStudio.bathsShort")}
                          </span>
                          <span>
                            {selectedListing.livingArea ?? "—"} sqft
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}

                <div className="rounded-2xl border">
                  <ScrollArea className="max-h-[280px]">
                    <div className="space-y-2 p-3">
                      {searchResultsQuery.isFetching ? (
                        <div className="flex items-center gap-2 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          {t("socialStudio.searchLoading")}
                        </div>
                      ) : listingSearch.trim().length <= 1 ? (
                        <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                          {t("socialStudio.searchPrompt")}
                        </div>
                      ) : searchResults.length === 0 ? (
                        <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                          {t("socialStudio.searchEmpty")}
                        </div>
                      ) : (
                        searchResults.map((listing) => (
                          <button
                            key={listing.listingKey ?? `${listing.unparsedAddress}-${listing.city}`}
                            type="button"
                            onClick={() => setSelectedListingKey(listing.listingKey ?? "")}
                            className={`flex w-full items-start justify-between rounded-xl border px-3 py-3 text-left transition hover:border-primary/30 hover:bg-primary/5 ${
                              selectedListingKey === listing.listingKey
                                ? "border-primary/40 bg-primary/5"
                                : "border-border"
                            }`}
                          >
                            <div className="min-w-0 space-y-1">
                              <p className="truncate font-medium">
                                {listing.unparsedAddress || t("socialStudio.address")}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {[listing.city, listing.stateOrProvince]
                                  .filter(Boolean)
                                  .join(", ")}
                              </p>
                              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                                <span>{formatPriceDisplay(listing.listPrice)}</span>
                                {listing.listingId ? (
                                  <span>
                                    {t("socialStudio.mlsNumber")}: {listing.listingId}
                                  </span>
                                ) : null}
                              </div>
                            </div>
                            {selectedListingKey === listing.listingKey ? (
                              <Badge variant="secondary">{t("socialStudio.selected")}</Badge>
                            ) : null}
                          </button>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>{t("socialStudio.address")}</Label>
                    <Input
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="123 Main St"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t("socialStudio.city")}</Label>
                    <Input
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="Irvine, CA"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="space-y-1.5">
                    <Label>{t("socialStudio.price")}</Label>
                    <Input
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      placeholder="1250000"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t("socialStudio.type")}</Label>
                    <Input
                      value={propertyType}
                      onChange={(e) => setPropertyType(e.target.value)}
                      placeholder="Single Family"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t("socialStudio.beds")}</Label>
                    <Input
                      type="number"
                      value={beds}
                      onChange={(e) => setBeds(e.target.value)}
                      placeholder="4"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t("socialStudio.baths")}</Label>
                    <Input
                      type="number"
                      value={baths}
                      onChange={(e) => setBaths(e.target.value)}
                      placeholder="3"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>{t("socialStudio.sqft")}</Label>
                    <Input
                      type="number"
                      value={sqft}
                      onChange={(e) => setSqft(e.target.value)}
                      placeholder="2500"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t("socialStudio.highlights")}</Label>
                    <Input
                      value={highlights}
                      onChange={(e) => setHighlights(e.target.value)}
                      placeholder={t("socialStudio.highlightsPlaceholder")}
                    />
                  </div>
                </div>
              </>
            )}

            {/* Tone selector */}
            <div className="space-y-1.5">
              <Label>{t("socialStudio.tone")}</Label>
              <div className="flex flex-wrap gap-2">
                {(["professional", "casual", "luxury", "friendly"] as const).map((t_val) => (
                  <Button
                    key={t_val}
                    variant={tone === t_val ? "default" : "outline"}
                    size="sm"
                    className="text-xs"
                    onClick={() => setTone(t_val)}
                  >
                    {t(`socialStudio.tone_${t_val}` as Parameters<typeof t>[0])}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>{t("socialStudio.customPrompt")}</Label>
              <Textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                rows={2}
                placeholder={t("socialStudio.customPromptPlaceholder")}
              />
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Button
                onClick={handleGenerate}
                disabled={generateMutation.isPending}
                className="gap-2"
                size="lg"
              >
                {generateMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                {generateMutation.isPending
                  ? t("socialStudio.generating")
                  : t("socialStudio.generateCurrent")}
              </Button>
              <Button
                onClick={handleGenerateAll}
                disabled={generatingAll}
                variant="outline"
                className="gap-2"
                size="lg"
              >
                {generatingAll ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Zap className="h-4 w-4" />
                )}
                {generatingAll
                  ? t("socialStudio.generatingAll")
                  : t("socialStudio.generateAll")}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Right: Preview */}
        <Card
          className={`transition-opacity ${currentResult ? "opacity-100" : "opacity-50"} ${platform.borderClass}`}
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <span className="text-xl">{platform.icon}</span>
              <span className={platform.accentClass}>
                {t(platform.labelKey as Parameters<typeof t>[0])}
              </span>
              {currentResult && (
                <Badge variant="outline" className="ml-auto text-[10px]">
                  {bodyLen}{platform.charLimit ? ` / ${platform.charLimit}` : ""} chars
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              {currentResult
                ? t("socialStudio.previewReady")
                : t("socialStudio.previewEmpty")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {currentResult ? (
              <div className="space-y-4">
                <ScrollArea className="max-h-[450px]">
                  <div
                    className={`rounded-xl border p-5 space-y-3 ${platform.bgClass} ${platform.borderClass} ${
                      platform.id === "tiktok" ? "text-white" : ""
                    }`}
                  >
                    {/* Title */}
                    {currentResult.title && (
                      <div>
                        <h2 className="text-lg font-bold leading-snug">
                          {currentResult.title}
                        </h2>
                        {platform.titleLimit && (
                          <p className={`text-[10px] mt-0.5 ${titleLen > platform.titleLimit ? "text-red-500" : "text-muted-foreground"}`}>
                            {titleLen}/{platform.titleLimit} {t("socialStudio.chars")}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Subject/Summary (WeChat) */}
                    {platform.hasSubject && currentResult.subject && (
                      <div className="rounded-lg border bg-muted/30 p-3">
                        <p className="text-[11px] font-medium text-muted-foreground mb-1">
                          {t("socialStudio.summary")}
                        </p>
                        <p className="text-sm">{currentResult.subject}</p>
                      </div>
                    )}

                    {/* Body */}
                    <div className="text-sm leading-relaxed whitespace-pre-wrap">
                      {currentResult.body}
                    </div>

                    {/* Hashtags */}
                    {platform.hasHashtags && currentResult.hashtags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-2 border-t">
                        {currentResult.hashtags.map((tag) => (
                          <Badge
                            key={tag}
                            variant="secondary"
                            className={`text-xs ${platform.badgeClass}`}
                          >
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}

                    {/* Photo Tips */}
                    {platform.hasPhotoTips &&
                      currentResult.photoTips.length > 0 && (
                        <div className="border-t pt-3">
                          <p className="text-[11px] font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
                            <ImageIcon className="h-3 w-3" />
                            {t("socialStudio.recommendedPhotos")}
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {currentResult.photoTips.map((tip) => (
                              <Badge
                                key={tip}
                                variant="outline"
                                className="text-[11px]"
                              >
                                📷 {tip}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                    {/* Char count warning */}
                    {platform.charLimit && bodyLen > platform.charLimit && (
                      <p className="text-xs text-red-500 pt-2 border-t">
                        ⚠️ {t("socialStudio.charLimitExceeded")}
                      </p>
                    )}
                  </div>
                </ScrollArea>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <Button onClick={copyAll} variant="default" className="gap-2" size="lg">
                    {copied ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <ClipboardCopy className="h-4 w-4" />
                    )}
                    {copied ? t("socialStudio.copied") : t("socialStudio.copyAll")}
                  </Button>
                  <Button
                    onClick={openPlatform}
                    variant="outline"
                    className={`gap-2 ${platform.borderClass} ${platform.accentClass}`}
                    size="lg"
                  >
                    <ExternalLink className="h-4 w-4" />
                    {t(platform.publishLabelKey as Parameters<typeof t>[0])}
                  </Button>
                </div>

                <p className="text-[11px] text-center text-muted-foreground">
                  {t("socialStudio.workflow")}
                </p>
              </div>
            ) : (
              <div className="text-center py-16 text-muted-foreground">
                <BookImage className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <p className="text-sm">{t("socialStudio.emptyPrompt")}</p>
                <p className="text-xs mt-1 opacity-60">
                  {t("socialStudio.emptyDescription")}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
