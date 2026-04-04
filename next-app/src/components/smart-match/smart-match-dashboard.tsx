"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Home,
  Loader2,
  MapPin,
  MessageSquare,
  Search,
  Sparkles,
  UserRoundSearch,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useT } from "@/i18n";
import { trpc } from "@/lib/trpc";

type BuyerProfileFilters = {
  city?: string | null;
  postalCode?: string | null;
  propertyType?: string | null;
  minPrice?: number | null;
  maxPrice?: number | null;
  minBedrooms?: number | null;
  maxBedrooms?: number | null;
};

type WorkspaceContact = {
  id: number;
  name: string | null;
  email: string | null;
  phone: string | null;
  source: string;
  intent: string | null;
  area: string | null;
  budgetMin: string | null;
  budgetMax: string | null;
  summary: string | null;
  notes: string | null;
  buyerProfile: {
    canonicalSummary: string | null;
    hardFilters: BuyerProfileFilters;
    searchMetadata?: Record<string, unknown> | null;
  } | null;
};

type MatchRecommendation = {
  property: {
    listingKey: string;
    unparsedAddress: string | null;
    city: string | null;
    stateOrProvince: string | null;
    listPrice: string | null;
    propertyType: string | null;
    bedroomsTotal: number | null;
    bathroomsTotalInteger: number | null;
    standardStatus: string | null;
  };
  matchReasons: string[];
  scoreBreakdown: {
    semanticScore: number;
    ruleScore: number;
    behaviorScore: number;
    finalScore: number;
  };
};

type MatchResult = {
  retrievalSource: string;
  candidateCount: number;
  processingTime: number;
  buyerProfile: {
    canonicalSummary: string | null;
    hardFilters: BuyerProfileFilters;
  };
  requirements: {
    hard: BuyerProfileFilters;
  };
  recommendations: MatchRecommendation[];
};

function formatPrice(price: string | null | undefined) {
  if (!price) return "—";
  const parsed = Number.parseFloat(price);
  if (!Number.isFinite(parsed)) return price;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(parsed);
}

type SearchMode = "contact" | "nl";

type NLParsedQuery = {
  filters: Record<string, unknown>;
  features: string[];
  lifestyle: string[];
  residualText: string;
  locale: string;
};

export function SmartMatchDashboard() {
  const { t, locale } = useT();
  const router = trpc.useUtils();

  // Mode toggle
  const [searchMode, setSearchMode] = useState<SearchMode>("nl");

  // NL search state
  const [nlQuery, setNlQuery] = useState("");
  const [nlParsedQuery, setNlParsedQuery] = useState<NLParsedQuery | null>(null);

  // Contact-based state
  const [contactQuery, setContactQuery] = useState("");
  const [selectedContactId, setSelectedContactId] = useState<number | null>(null);
  const [searchBrief, setSearchBrief] = useState("");
  const [city, setCity] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [propertyType, setPropertyType] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [minBedrooms, setMinBedrooms] = useState("");
  const [maxBedrooms, setMaxBedrooms] = useState("");
  const [selectedListingKeys, setSelectedListingKeys] = useState<string[]>([]);
  const [latestResult, setLatestResult] = useState<MatchResult | null>(null);

  const workspaceQuery = trpc.smartMatch.workspace.useQuery({
    query: contactQuery || undefined,
    limit: 24,
  });

  const generateMatchMutation = trpc.smartMatch.generateMatch.useMutation({
    onSuccess: (data) => {
      setLatestResult(data as MatchResult);
      setSelectedListingKeys(
        data.recommendations.slice(0, 3).map((item) => item.property.listingKey)
      );
    },
    onError: (error) => {
      toast.error(t("smartMatchWorkspace.runFailed"), {
        description: error.message,
      });
    },
  });

  const nlSearchMutation = trpc.smartMatch.nlSearch.useMutation({
    onSuccess: (data) => {
      setLatestResult(data as unknown as MatchResult);
      setSelectedListingKeys(
        data.recommendations.slice(0, 3).map((item) => item.property.listingKey),
      );
      if (data.parsedQuery) {
        setNlParsedQuery(data.parsedQuery as NLParsedQuery);
      }
    },
    onError: (error) => {
      toast.error(t("smartMatchWorkspace.nlSearchFailed"), {
        description: error.message,
      });
    },
  });

  const contacts = (workspaceQuery.data?.contacts ?? []) as WorkspaceContact[];
  const selectedContact =
    contacts.find((contact) => contact.id === selectedContactId) ?? contacts[0] ?? null;
  const selectedRecommendations = latestResult
    ? latestResult.recommendations.filter((item) =>
        selectedListingKeys.includes(item.property.listingKey)
      )
    : ([] as MatchRecommendation[]);

  const selectedLocale =
    ({ en: "en", zh: "zh" } as const)[locale as "en" | "zh"] ?? "zh";

  const handleRunMatch = async () => {
    if (!selectedContactId) {
      toast.error(t("smartMatchWorkspace.selectContactFirst"));
      return;
    }

    const parseNumber = (value: string) => {
      const trimmed = value.trim();
      if (!trimmed) return undefined;
      const parsed = Number.parseInt(trimmed.replace(/[^0-9]/g, ""), 10);
      return Number.isFinite(parsed) ? parsed : undefined;
    };

    await generateMatchMutation.mutateAsync({
      contactId: selectedContactId,
      locale: selectedLocale,
      searchBrief: searchBrief.trim() || undefined,
      city: city.trim() || undefined,
      postalCode: postalCode.trim() || undefined,
      propertyType: propertyType.trim() || undefined,
      minPrice: parseNumber(minPrice),
      maxPrice: parseNumber(maxPrice),
      minBedrooms: parseNumber(minBedrooms),
      maxBedrooms: parseNumber(maxBedrooms),
      topK: 8,
    });

    await router.smartMatch.workspace.invalidate();
  };

  const toggleListing = (listingKey: string) => {
    setSelectedListingKeys((current) =>
      current.includes(listingKey)
        ? current.filter((item) => item !== listingKey)
        : [...current, listingKey]
    );
  };

  const shareHref =
    selectedRecommendations.length > 0
      ? (() => {
          const params = new URLSearchParams();
          params.set(
            "listingKeys",
            selectedRecommendations.map((item) => item.property.listingKey).join(",")
          );
          params.set("source", "smart_match");
          if (selectedContact?.name) {
            params.set("clientName", selectedContact.name);
            params.set("title", `${selectedContact.name} Smart Match`);
          }
          return `/magic-share?${params.toString()}`;
        })()
      : null;

  const cmaHref = selectedRecommendations[0]?.property.listingKey
    ? `/cma-studio?${new URLSearchParams({
        subjectKey: selectedRecommendations[0].property.listingKey,
      }).toString()}`
    : null;

  const handleNLSearch = async () => {
    const trimmed = nlQuery.trim();
    if (!trimmed) {
      toast.error(t("smartMatchWorkspace.nlSearchEmpty"));
      return;
    }
    setNlParsedQuery(null);
    await nlSearchMutation.mutateAsync({
      query: trimmed,
      contactId: selectedContactId ?? undefined,
      topK: 8,
    });
  };

  const contactDefaultBrief =
    typeof selectedContact?.buyerProfile?.searchMetadata?.searchBrief === "string"
      ? selectedContact.buyerProfile.searchMetadata.searchBrief
      : "";

  const resetDraftFields = () => {
    setSearchBrief("");
    setCity("");
    setPostalCode("");
    setPropertyType("");
    setMinPrice("");
    setMaxPrice("");
    setMinBedrooms("");
    setMaxBedrooms("");
  };

  return (
    <div className="space-y-8 px-6 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.32em] text-muted-foreground">
            {t("smartMatchWorkspace.eyebrow")}
          </div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            {t("smartMatchWorkspace.title")}
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            {t("smartMatchWorkspace.description")}
          </p>
        </div>
        <Badge variant="secondary" className="gap-2">
          <Sparkles className="h-3.5 w-3.5" />
          {t("smartMatchWorkspace.beta")}
        </Badge>
      </div>

      {/* Mode Toggle */}
      <div className="flex gap-1 rounded-lg bg-muted p-1 w-fit">
        <button
          onClick={() => { setSearchMode("nl"); setLatestResult(null); setSelectedListingKeys([]); setNlParsedQuery(null); }}
          className={`flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            searchMode === "nl"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <MessageSquare className="h-3.5 w-3.5" />
          {t("smartMatchWorkspace.nlSearchTab")}
        </button>
        <button
          onClick={() => { setSearchMode("contact"); setLatestResult(null); setSelectedListingKeys([]); setNlParsedQuery(null); }}
          className={`flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            searchMode === "contact"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <UserRoundSearch className="h-3.5 w-3.5" />
          {t("smartMatchWorkspace.contactMatchTab")}
        </button>
      </div>

      {/* NL Search Mode */}
      {searchMode === "nl" && (
        <div className="grid gap-6 xl:grid-cols-[1fr_1.2fr]">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Search className="h-4 w-4" />
                  {t("smartMatchWorkspace.nlSearchTitle")}
                </CardTitle>
                <CardDescription>
                  {t("smartMatchWorkspace.nlSearchDescription")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  rows={4}
                  value={nlQuery}
                  onChange={(e) => setNlQuery(e.target.value)}
                  placeholder={t("smartMatchWorkspace.nlSearchPlaceholder")}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      handleNLSearch();
                    }
                  }}
                />
                <div className="flex items-center gap-3">
                  <Button
                    className="flex-1 gap-2"
                    onClick={handleNLSearch}
                    disabled={nlSearchMutation.isPending || !nlQuery.trim()}
                  >
                    {nlSearchMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {t("smartMatchWorkspace.nlSearchParsing")}
                      </>
                    ) : (
                      <>
                        <Zap className="h-4 w-4" />
                        {t("smartMatchWorkspace.nlSearchButton")}
                      </>
                    )}
                  </Button>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    ⌘+Enter
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Parsed Query Display */}
            {nlParsedQuery && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Sparkles className="h-3.5 w-3.5" />
                    {t("smartMatchWorkspace.nlParsedTitle")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Extracted Filters */}
                  {Object.entries(nlParsedQuery.filters).filter(([, v]) => v != null).length > 0 && (
                    <div>
                      <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5">
                        {t("smartMatchWorkspace.nlFiltersLabel")}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {Object.entries(nlParsedQuery.filters)
                          .filter(([, v]) => v != null)
                          .map(([key, value]) => (
                            <Badge key={key} variant="secondary" className="text-xs">
                              {key}: {typeof value === "number" ? `$${value.toLocaleString()}` : String(value)}
                            </Badge>
                          ))}
                      </div>
                    </div>
                  )}
                  {/* Features */}
                  {nlParsedQuery.features.length > 0 && (
                    <div>
                      <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5">
                        {t("smartMatchWorkspace.nlFeaturesLabel")}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {nlParsedQuery.features.map((f) => (
                          <Badge key={f} variant="outline" className="text-xs">
                            {f}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* Lifestyle */}
                  {nlParsedQuery.lifestyle.length > 0 && (
                    <div>
                      <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5">
                        {t("smartMatchWorkspace.nlLifestyleLabel")}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {nlParsedQuery.lifestyle.map((l) => (
                          <Badge key={l} variant="outline" className="text-xs bg-blue-50 dark:bg-blue-950/20">
                            {l}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* Residual */}
                  {nlParsedQuery.residualText && (
                    <div>
                      <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5">
                        {t("smartMatchWorkspace.nlSemanticLabel")}
                      </div>
                      <p className="text-xs text-muted-foreground italic">
                        &ldquo;{nlParsedQuery.residualText}&rdquo;
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* NL Search Results — reuse the same results panel */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle>{t("smartMatchWorkspace.resultsTitle")}</CardTitle>
                    <CardDescription>{t("smartMatchWorkspace.nlResultsDescription")}</CardDescription>
                  </div>
                  {latestResult ? (
                    <Badge variant="secondary">
                      {latestResult.candidateCount} {t("smartMatchWorkspace.nlCandidates")} → {latestResult.recommendations.length} {t("smartMatchWorkspace.nlResults")}
                    </Badge>
                  ) : null}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {latestResult ? (
                  <>
                    <div className="flex flex-wrap items-center gap-3">
                      <Badge variant="outline">
                        {t("smartMatchWorkspace.selectedCount", {
                          count: selectedListingKeys.length,
                        })}
                      </Badge>
                      {shareHref ? (
                        <Button asChild size="sm">
                          <Link href={shareHref}>
                            {t("smartMatchWorkspace.openShare")}
                            <ArrowRight className="h-4 w-4" />
                          </Link>
                        </Button>
                      ) : null}
                      <Badge variant="secondary" className="text-xs">
                        {Math.max(1, Math.round(latestResult.processingTime / 10) / 100)}s
                      </Badge>
                    </div>

                    <Separator />

                    <div className="space-y-4">
                      {latestResult.recommendations.length === 0 ? (
                        <div className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">
                          {t("smartMatchWorkspace.nlNoResults")}
                        </div>
                      ) : (
                        latestResult.recommendations.map((item) => (
                          <div key={item.property.listingKey} className="rounded-2xl border p-4">
                            <div className="flex items-start justify-between gap-4">
                              <label className="flex items-start gap-3">
                                <input
                                  type="checkbox"
                                  className="mt-1 accent-primary"
                                  checked={selectedListingKeys.includes(item.property.listingKey)}
                                  onChange={() => toggleListing(item.property.listingKey)}
                                />
                                <div>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <div className="text-base font-semibold">
                                      {item.property.unparsedAddress || t("smartMatchWorkspace.addressFallback")}
                                    </div>
                                    <Badge variant="secondary">
                                      {item.property.standardStatus || "Active"}
                                    </Badge>
                                  </div>
                                  <div className="mt-2 flex flex-wrap gap-3 text-sm text-muted-foreground">
                                    <span className="inline-flex items-center gap-1">
                                      <MapPin className="h-3.5 w-3.5" />
                                      {item.property.city}, {item.property.stateOrProvince}
                                    </span>
                                    <span className="inline-flex items-center gap-1">
                                      <Home className="h-3.5 w-3.5" />
                                      {item.property.propertyType || "—"}
                                    </span>
                                    <span className="inline-flex items-center gap-1">
                                      <Building2 className="h-3.5 w-3.5" />
                                      {item.property.bedroomsTotal ?? "—"} bd / {item.property.bathroomsTotalInteger ?? "—"} ba
                                    </span>
                                  </div>
                                </div>
                              </label>
                              <div className="text-right">
                                <div className="text-lg font-semibold">{formatPrice(item.property.listPrice)}</div>
                                <div className="mt-1 text-xs text-muted-foreground">
                                  {Math.round(item.scoreBreakdown.finalScore * 100)}%
                                </div>
                              </div>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                              {item.matchReasons.map((reason) => (
                                <Badge key={reason} variant="outline" className="gap-1 text-xs">
                                  <CheckCircle2 className="h-3 w-3" />
                                  {reason}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </>
                ) : (
                  <div className="rounded-2xl border border-dashed p-8 text-sm text-muted-foreground">
                    <div className="font-medium">
                      {t("smartMatchWorkspace.nlEmptyTitle")}
                    </div>
                    <div className="mt-2">
                      {t("smartMatchWorkspace.nlEmptyDescription")}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Contact Match Mode (original) */}
      {searchMode === "contact" && (
      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr_1.2fr]">
        <Card className="min-h-[640px]">
          <CardHeader>
            <CardTitle>{t("smartMatchWorkspace.contactsTitle")}</CardTitle>
            <CardDescription>{t("smartMatchWorkspace.contactsDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="contact-search">
                {t("smartMatchWorkspace.contactSearchLabel")}
              </Label>
              <Input
                id="contact-search"
                placeholder={t("smartMatchWorkspace.contactSearchPlaceholder")}
                value={contactQuery}
                onChange={(event) => setContactQuery(event.target.value)}
              />
            </div>

            <div className="space-y-3 overflow-y-auto pr-1 xl:max-h-[520px]">
              {workspaceQuery.isLoading ? (
                <div className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">
                  {t("smartMatchWorkspace.loadingContacts")}
                </div>
              ) : contacts.length === 0 ? (
                <div className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">
                  <div className="font-medium">{t("smartMatchWorkspace.noContacts")}</div>
                  <div className="mt-2">{t("smartMatchWorkspace.noContactsDescription")}</div>
                </div>
              ) : (
                contacts.map((contact) => {
                  const active = selectedContact?.id === contact.id;
                  return (
                    <button
                      type="button"
                      key={contact.id}
                      onClick={() => {
                        setSelectedContactId(contact.id);
                        resetDraftFields();
                        setLatestResult(null);
                        setSelectedListingKeys([]);
                      }}
                      className={`w-full rounded-2xl border p-4 text-left transition-colors ${
                        active ? "border-primary bg-primary/5" : "hover:bg-muted/30"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="font-medium">
                            {contact.name || t("smartMatchWorkspace.unnamedContact")}
                          </div>
                          <div className="mt-1 text-sm text-muted-foreground">
                            {contact.email || contact.phone || t("smartMatchWorkspace.noPrimaryContact")}
                          </div>
                        </div>
                        {contact.buyerProfile ? (
                          <Badge variant="secondary">{t("smartMatchWorkspace.profileReady")}</Badge>
                        ) : null}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                        <span>{contact.source}</span>
                        {contact.area ? <span>{contact.area}</span> : null}
                        {contact.intent ? <span>{contact.intent}</span> : null}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t("smartMatchWorkspace.selectedContactTitle")}</CardTitle>
              <CardDescription>{t("smartMatchWorkspace.selectedContactDescription")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {selectedContact ? (
                <>
                  <div>
                    <div className="text-lg font-semibold">
                      {selectedContact.name || t("smartMatchWorkspace.unnamedContact")}
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {selectedContact.email || selectedContact.phone || t("smartMatchWorkspace.noPrimaryContact")}
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border p-3">
                      <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                        {t("smartMatchWorkspace.areaLabel")}
                      </div>
                      <div className="mt-2 text-sm font-medium">
                        {selectedContact.area || t("smartMatchWorkspace.emptyField")}
                      </div>
                    </div>
                    <div className="rounded-xl border p-3">
                      <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                        {t("smartMatchWorkspace.budgetLabel")}
                      </div>
                      <div className="mt-2 text-sm font-medium">
                        {formatPrice(selectedContact.budgetMin)} - {formatPrice(selectedContact.budgetMax)}
                      </div>
                    </div>
                  </div>
                  <div className="rounded-xl border p-4">
                    <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                      {t("smartMatchWorkspace.summaryLabel")}
                    </div>
                    <div className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                      {selectedContact.buyerProfile?.canonicalSummary ||
                        selectedContact.summary ||
                        selectedContact.notes ||
                        t("smartMatchWorkspace.noSummary")}
                    </div>
                  </div>
                </>
              ) : (
                <div className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">
                  {t("smartMatchWorkspace.selectContactHint")}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("smartMatchWorkspace.requirementsTitle")}</CardTitle>
              <CardDescription>{t("smartMatchWorkspace.requirementsDescription")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="search-brief">{t("smartMatchWorkspace.searchBriefLabel")}</Label>
                <Textarea
                  id="search-brief"
                  rows={5}
                  value={searchBrief}
                  onChange={(event) => setSearchBrief(event.target.value)}
                  placeholder={
                    contactDefaultBrief || t("smartMatchWorkspace.searchBriefPlaceholder")
                  }
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="sm-city">{t("smartMatchWorkspace.cityLabel")}</Label>
                  <Input id="sm-city" value={city} onChange={(event) => setCity(event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sm-zip">{t("smartMatchWorkspace.postalCodeLabel")}</Label>
                  <Input
                    id="sm-zip"
                    value={postalCode}
                    onChange={(event) => setPostalCode(event.target.value)}
                    placeholder={selectedContact?.buyerProfile?.hardFilters?.postalCode ?? undefined}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sm-type">{t("smartMatchWorkspace.propertyTypeLabel")}</Label>
                  <Input
                    id="sm-type"
                    value={propertyType}
                    onChange={(event) => setPropertyType(event.target.value)}
                    placeholder={
                      selectedContact?.buyerProfile?.hardFilters?.propertyType ??
                      t("smartMatchWorkspace.propertyTypePlaceholder")
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sm-min-beds">{t("smartMatchWorkspace.minBedroomsLabel")}</Label>
                  <Input
                    id="sm-min-beds"
                    value={minBedrooms}
                    onChange={(event) => setMinBedrooms(event.target.value)}
                    placeholder={
                      selectedContact?.buyerProfile?.hardFilters?.minBedrooms != null
                        ? String(selectedContact.buyerProfile.hardFilters.minBedrooms)
                        : undefined
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sm-min-price">{t("smartMatchWorkspace.minPriceLabel")}</Label>
                  <Input
                    id="sm-min-price"
                    value={minPrice}
                    onChange={(event) => setMinPrice(event.target.value)}
                    placeholder={
                      selectedContact?.buyerProfile?.hardFilters?.minPrice != null
                        ? String(selectedContact.buyerProfile.hardFilters.minPrice)
                        : selectedContact?.budgetMin ?? undefined
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sm-max-price">{t("smartMatchWorkspace.maxPriceLabel")}</Label>
                  <Input
                    id="sm-max-price"
                    value={maxPrice}
                    onChange={(event) => setMaxPrice(event.target.value)}
                    placeholder={
                      selectedContact?.buyerProfile?.hardFilters?.maxPrice != null
                        ? String(selectedContact.buyerProfile.hardFilters.maxPrice)
                        : selectedContact?.budgetMax ?? undefined
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sm-max-beds">{t("smartMatchWorkspace.maxBedroomsLabel")}</Label>
                  <Input
                    id="sm-max-beds"
                    value={maxBedrooms}
                    onChange={(event) => setMaxBedrooms(event.target.value)}
                    placeholder={
                      selectedContact?.buyerProfile?.hardFilters?.maxBedrooms != null
                        ? String(selectedContact.buyerProfile.hardFilters.maxBedrooms)
                        : undefined
                    }
                  />
                </div>
              </div>

              <Button
                className="w-full gap-2"
                onClick={handleRunMatch}
                disabled={generateMatchMutation.isPending || !selectedContact}
              >
                {generateMatchMutation.isPending ? (
                  <>{t("smartMatchWorkspace.running")}</>
                ) : (
                  <>
                    <UserRoundSearch className="h-4 w-4" />
                    {t("smartMatchWorkspace.runMatch")}
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle>{t("smartMatchWorkspace.resultsTitle")}</CardTitle>
                  <CardDescription>{t("smartMatchWorkspace.resultsDescription")}</CardDescription>
                </div>
                {latestResult ? (
                  <Badge variant="secondary">
                    {t("smartMatchWorkspace.resultMeta", {
                      count: latestResult.recommendations.length,
                      source: latestResult.retrievalSource,
                    })}
                  </Badge>
                ) : null}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {latestResult ? (
                <>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-xl border p-4">
                      <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                        {t("smartMatchWorkspace.profileCardTitle")}
                      </div>
                      <div className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                        {latestResult.buyerProfile.canonicalSummary}
                      </div>
                    </div>
                    <div className="rounded-xl border p-4">
                      <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                        {t("smartMatchWorkspace.runCardTitle")}
                      </div>
                      <div className="mt-2 space-y-2 text-sm text-muted-foreground">
                        <div>
                          {t("smartMatchWorkspace.candidateCount")} {latestResult.candidateCount}
                        </div>
                        <div>
                          {t("smartMatchWorkspace.processingTime")}{" "}
                          {Math.max(1, Math.round(latestResult.processingTime / 10) / 100)}s
                        </div>
                        <div>
                          {t("smartMatchWorkspace.hardFiltersLabel")}{" "}
                          {JSON.stringify(latestResult.requirements.hard)}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <Badge variant="outline">
                      {t("smartMatchWorkspace.selectedCount", {
                        count: selectedListingKeys.length,
                      })}
                    </Badge>
                    {shareHref ? (
                      <Button asChild size="sm">
                        <Link href={shareHref}>
                          {t("smartMatchWorkspace.openShare")}
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => toast.error(t("smartMatchWorkspace.shareNeedsSelection"))}
                      >
                        {t("smartMatchWorkspace.openShare")}
                      </Button>
                    )}
                    {cmaHref ? (
                      <Button asChild size="sm" variant="outline">
                        <Link href={cmaHref}>{t("smartMatchWorkspace.createCma")}</Link>
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => toast.error(t("smartMatchWorkspace.cmaNeedsSelection"))}
                      >
                        {t("smartMatchWorkspace.createCma")}
                      </Button>
                    )}
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    {latestResult.recommendations.length === 0 ? (
                      <div className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">
                        {t("smartMatchWorkspace.noResults")}
                      </div>
                    ) : (
                      latestResult.recommendations.map((item) => (
                        <div key={item.property.listingKey} className="rounded-2xl border p-4">
                          <div className="flex items-start justify-between gap-4">
                            <label className="flex items-start gap-3">
                              <input
                                type="checkbox"
                                className="mt-1 accent-primary"
                                checked={selectedListingKeys.includes(item.property.listingKey)}
                                onChange={() => toggleListing(item.property.listingKey)}
                              />
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <div className="text-base font-semibold">
                                    {item.property.unparsedAddress ||
                                      t("smartMatchWorkspace.addressFallback")}
                                  </div>
                                  <Badge variant="secondary">
                                    {item.property.standardStatus || "Active"}
                                  </Badge>
                                </div>
                                <div className="mt-2 flex flex-wrap gap-3 text-sm text-muted-foreground">
                                  <span className="inline-flex items-center gap-1">
                                    <MapPin className="h-3.5 w-3.5" />
                                    {item.property.city}, {item.property.stateOrProvince}
                                  </span>
                                  <span className="inline-flex items-center gap-1">
                                    <Home className="h-3.5 w-3.5" />
                                    {item.property.propertyType || "—"}
                                  </span>
                                  <span className="inline-flex items-center gap-1">
                                    <Building2 className="h-3.5 w-3.5" />
                                    {item.property.bedroomsTotal ?? "—"} bd /{" "}
                                    {item.property.bathroomsTotalInteger ?? "—"} ba
                                  </span>
                                </div>
                              </div>
                            </label>
                            <div className="text-right">
                              <div className="text-lg font-semibold">
                                {formatPrice(item.property.listPrice)}
                              </div>
                              <div className="mt-1 text-xs text-muted-foreground">
                                {t("smartMatchWorkspace.finalScoreLabel")}{" "}
                                {Math.round(item.scoreBreakdown.finalScore * 100)}%
                              </div>
                            </div>
                          </div>

                          <div className="mt-4 flex flex-wrap gap-2">
                            {item.matchReasons.map((reason) => (
                              <Badge key={reason} variant="outline" className="gap-1">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                {reason}
                              </Badge>
                            ))}
                          </div>

                          <div className="mt-4 grid gap-3 md:grid-cols-3">
                            <div className="rounded-xl bg-muted/40 p-3 text-sm">
                              <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                                {t("smartMatchWorkspace.semanticScoreLabel")}
                              </div>
                              <div className="mt-2 font-semibold">
                                {Math.round(item.scoreBreakdown.semanticScore * 100)}%
                              </div>
                            </div>
                            <div className="rounded-xl bg-muted/40 p-3 text-sm">
                              <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                                {t("smartMatchWorkspace.ruleScoreLabel")}
                              </div>
                              <div className="mt-2 font-semibold">
                                {Math.round(item.scoreBreakdown.ruleScore * 100)}%
                              </div>
                            </div>
                            <div className="rounded-xl bg-muted/40 p-3 text-sm">
                              <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                                {t("smartMatchWorkspace.behaviorScoreLabel")}
                              </div>
                              <div className="mt-2 font-semibold">
                                {Math.round(item.scoreBreakdown.behaviorScore * 100)}%
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </>
              ) : (
                <div className="rounded-2xl border border-dashed p-8 text-sm text-muted-foreground">
                  <div className="font-medium">{t("smartMatchWorkspace.noRunYet")}</div>
                  <div className="mt-2">{t("smartMatchWorkspace.noRunYetDescription")}</div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      )}
    </div>
  );
}
