// legacy page — incrementally migrated
import type { inferRouterOutputs } from "@trpc/server";
import { useCallback, useState } from "react";
import { ArrowDown, ArrowUp, Copy, ExternalLink, GripVertical, Loader2, MapPin, Navigation, Search, Trash2, Route } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShowingTourRouteMap } from "@/components/showing-tour/showing-tour-route-map";
import { trpc } from "@/lib/trpc";
import { useT } from "@/i18n";
import type { AppRouter } from "@/routers";
import { toast } from "sonner";

type MlsListing = {
  listingKey: string;
  listingId: string | null;
  unparsedAddress: string | null;
  city: string | null;
  stateOrProvince: string | null;
  postalCode: string | null;
  listPrice: string | null;
  propertyType: string | null;
  bedroomsTotal: number | null;
  bathroomsTotalInteger: number | null;
  livingArea: string | null;
};

type RoutePreview = {
  orderedListingKeys: string[];
  routeMode: "optimized" | "manual";
  routeStatus: string;
  totalDistance: string | null;
  totalDuration: string | null;
  googleMapsUrl: string | null;
  usedOptimization?: boolean;
  message?: string | null;
  stops: Array<{
    order: number;
    listingKey: string;
    address: string | null;
    latitude?: number | null;
    longitude?: number | null;
    driveFromPreviousText?: string | null;
    distanceFromPreviousText?: string | null;
  }>;
};

type RouterOutput = inferRouterOutputs<AppRouter>;
type PreviewRouteResponse = RouterOutput["showingTour"]["previewRoute"];
type CreateTourResponse = RouterOutput["showingTour"]["createTour"];

function formatPrice(price: string | null | undefined, fallback: string) {
  if (!price) return fallback;
  const num = Number(price);
  if (!Number.isFinite(num)) return price;
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000) return `$${(num / 1_000).toFixed(0)}K`;
  return `$${num.toLocaleString()}`;
}

function displayAddress(item: {
  unparsedAddress?: string | null;
  city?: string | null;
  stateOrProvince?: string | null;
  postalCode?: string | null;
}, fallback: string) {
  const full = item.unparsedAddress?.trim();
  if (full) return full;
  const fb = [item.city, item.stateOrProvince, item.postalCode].filter(Boolean).join(" · ");
  return fb || fallback;
}

function normalizeSearchListing(listing: Record<string, unknown>): MlsListing | null {
  const listingKey =
    typeof listing.listingKey === "string" ? listing.listingKey.trim() : "";
  if (!listingKey) return null;

  return {
    listingKey,
    listingId: typeof listing.listingId === "string" ? listing.listingId : null,
    unparsedAddress:
      typeof listing.unparsedAddress === "string" ? listing.unparsedAddress : null,
    city: typeof listing.city === "string" ? listing.city : null,
    stateOrProvince:
      typeof listing.stateOrProvince === "string" ? listing.stateOrProvince : null,
    postalCode:
      typeof listing.postalCode === "string" ? listing.postalCode : null,
    listPrice:
      typeof listing.listPrice === "string"
        ? listing.listPrice
        : typeof listing.listPrice === "number"
          ? String(listing.listPrice)
          : null,
    propertyType:
      typeof listing.propertyType === "string" ? listing.propertyType : null,
    bedroomsTotal:
      typeof listing.bedroomsTotal === "number" ? listing.bedroomsTotal : null,
    bathroomsTotalInteger:
      typeof listing.bathroomsTotalInteger === "number"
        ? listing.bathroomsTotalInteger
        : null,
    livingArea:
      typeof listing.livingArea === "string"
        ? listing.livingArea
        : typeof listing.livingArea === "number"
          ? String(listing.livingArea)
          : null,
  };
}

function reorderListings(listings: MlsListing[], orderedKeys: string[]) {
  const byKey = new Map(listings.map((listing) => [listing.listingKey, listing]));
  const seen = new Set<string>();
  const ordered: MlsListing[] = [];

  for (const key of orderedKeys) {
    const listing = byKey.get(key);
    if (!listing || seen.has(key)) continue;
    seen.add(key);
    ordered.push(listing);
  }

  for (const listing of listings) {
    if (seen.has(listing.listingKey)) continue;
    seen.add(listing.listingKey);
    ordered.push(listing);
  }

  return ordered;
}

function extractRoutePreview(data: PreviewRouteResponse | CreateTourResponse): RoutePreview {
  return {
    orderedListingKeys: data.orderedListingKeys,
    routeMode: data.routeMode,
    routeStatus: data.routeStatus,
    totalDistance: data.totalDistance,
    totalDuration: data.totalDuration,
    googleMapsUrl: data.googleMapsUrl,
    usedOptimization: "usedOptimization" in data ? data.usedOptimization : undefined,
    message: "message" in data ? data.message ?? null : null,
    stops: data.stops,
  };
}

export default function ShowingTour() {
  const { t } = useT();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedListings, setSelectedListings] = useState<MlsListing[]>([]);
  const [routeMode, setRouteMode] = useState<"optimized" | "manual">("optimized");
  const [agentName, setAgentName] = useState("");
  const [agentPhone, setAgentPhone] = useState("");
  const [clientName, setClientName] = useState("");
  const [tourDate, setTourDate] = useState(new Date().toISOString().split("T")[0]);
  const [routePreview, setRoutePreview] = useState<RoutePreview | null>(null);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [draggingListingKey, setDraggingListingKey] = useState<string | null>(null);
  const [dragOverListingKey, setDragOverListingKey] = useState<string | null>(null);

  const searchResults = trpc.mls.getProperties.useQuery(
    { search: searchQuery || undefined, limit: 10, offset: 0, status: "Active" },
    { enabled: searchQuery.trim().length >= 2 }
  );

  const previewRoute = trpc.showingTour.previewRoute.useMutation({
    onSuccess: (data: PreviewRouteResponse) => {
      setSelectedListings((current) => reorderListings(current, data.orderedListingKeys));
      setRoutePreview(extractRoutePreview(data));
      toast.success(t("showingTour.routeReady"), {
        description: t("showingTour.routeReadyDescription", {
          distance: data.totalDistance ?? "N/A",
          duration: data.totalDuration ?? "N/A",
        }),
      });
    },
    onError: (error) => {
      toast.error(t("showingTour.routeFailed"), { description: error.message });
    },
  });

  const createTour = trpc.showingTour.createTour.useMutation({
    onSuccess: (data: CreateTourResponse) => {
      setSelectedListings((current) => reorderListings(current, data.orderedListingKeys));
      setRoutePreview(extractRoutePreview(data));
      setGeneratedUrl(data.shareUrl);
      toast.success(t("showingTour.shareReady"), {
        description: t("showingTour.shareReadyDescription", {
          count: String(data.propertyCount),
          distance: data.totalDistance ?? "N/A",
        }),
      });
    },
    onError: (error) => {
      toast.error(t("showingTour.shareFailed"), { description: error.message });
    },
  });

  const resetDerivedState = useCallback(() => {
    setRoutePreview(null);
    setGeneratedUrl(null);
  }, []);

  const recalculateManualPreview = useCallback((nextListings: MlsListing[]) => {
    if (routeMode !== "manual" || !routePreview || nextListings.length < 2) {
      resetDerivedState();
      return;
    }

    setGeneratedUrl(null);
    previewRoute.mutate({
      propertyIds: nextListings.map((listing) => listing.listingKey),
      routeMode: "manual",
    });
  }, [previewRoute, resetDerivedState, routeMode, routePreview]);

  const addListing = useCallback((listing: MlsListing) => {
    if (selectedListings.some((item) => item.listingKey === listing.listingKey)) {
      toast.info(t("showingTour.alreadyAdded"));
      return;
    }
    if (selectedListings.length >= 10) {
      toast.warning(t("showingTour.maxListings"));
      return;
    }
    resetDerivedState();
    setSelectedListings((current) => [...current, listing]);
    setSearchQuery("");
  }, [resetDerivedState, selectedListings, t]);

  const removeListing = useCallback((listingKey: string) => {
    const nextListings = selectedListings.filter((listing) => listing.listingKey !== listingKey);
    setSelectedListings(nextListings);
    recalculateManualPreview(nextListings);
  }, [recalculateManualPreview, selectedListings]);

  const moveListing = useCallback((index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= selectedListings.length) return;
    const nextListings = [...selectedListings];
    const [item] = nextListings.splice(index, 1);
    nextListings.splice(nextIndex, 0, item);
    setSelectedListings(nextListings);
    recalculateManualPreview(nextListings);
  }, [recalculateManualPreview, selectedListings]);

  const moveListingByDrag = useCallback((draggedKey: string, targetKey: string) => {
    if (draggedKey === targetKey) return;
    const draggedIndex = selectedListings.findIndex((listing) => listing.listingKey === draggedKey);
    const targetIndex = selectedListings.findIndex((listing) => listing.listingKey === targetKey);
    if (draggedIndex === -1 || targetIndex === -1) return;

    const nextListings = [...selectedListings];
    const [dragged] = nextListings.splice(draggedIndex, 1);
    nextListings.splice(targetIndex, 0, dragged);
    setSelectedListings(nextListings);
    recalculateManualPreview(nextListings);
  }, [recalculateManualPreview, selectedListings]);

  const handlePreviewRoute = useCallback(() => {
    if (selectedListings.length < 2) {
      toast.error(t("showingTour.minListings"));
      return;
    }
    previewRoute.mutate({
      propertyIds: selectedListings.map((listing) => listing.listingKey),
      routeMode,
    });
  }, [previewRoute, routeMode, selectedListings, t]);

  const handleGenerateShare = useCallback(() => {
    if (selectedListings.length < 2) {
      toast.error(t("showingTour.minListings"));
      return;
    }
    createTour.mutate({
      propertyIds: selectedListings.map((listing) => listing.listingKey),
      routeMode,
      agentName: agentName || undefined,
      agentPhone: agentPhone || undefined,
      clientName: clientName || undefined,
      tourDate: tourDate || undefined,
    });
  }, [agentName, agentPhone, clientName, createTour, routeMode, selectedListings, t, tourDate]);

  const copyLink = useCallback(async () => {
    if (!generatedUrl) return;
    try {
      await navigator.clipboard.writeText(generatedUrl);
      toast.success(t("showingTour.linkCopied"));
    } catch {
      toast.error(t("showingTour.copyFailed"));
    }
  }, [generatedUrl, t]);

  const isBusy = previewRoute.isPending || createTour.isPending;
  const searchableResults = (searchResults.data ?? [])
    .map((listing) => normalizeSearchListing(listing as Record<string, unknown>))
    .filter((listing): listing is MlsListing => listing !== null);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="flex items-center gap-2 text-2xl font-serif tracking-tight">
          <Navigation className="h-6 w-6 text-primary" />
          {t("showingTour.title")}
        </h1>
        <p className="text-muted-foreground">{t("showingTour.subtitle")}</p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_420px]">
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Search className="h-4 w-4" />
                {t("showingTour.searchTitle")}
              </CardTitle>
              <CardDescription>{t("showingTour.searchDescription")}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder={t("showingTour.searchPlaceholder")}
                  className="pl-10"
                />
              </div>

              {searchQuery.trim().length >= 2 ? (
                <div className="mt-3 rounded-lg border">
                  {searchResults.isLoading ? (
                    <div className="flex items-center justify-center p-4 text-sm text-muted-foreground">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t("showingTour.searching")}
                    </div>
                  ) : searchableResults.length ? (
                    searchableResults.map((listing) => (
                        <button
                          key={listing.listingKey}
                          className="flex w-full items-start justify-between gap-3 border-b px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-accent/40"
                          onClick={() => addListing(listing)}
                        >
                          <div className="min-w-0">
                            <div className="text-sm font-medium">
                              {displayAddress(listing, t("showingTour.addressUnknown"))}
                            </div>
                            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                              <span>{formatPrice(listing.listPrice, t("showingTour.pricePending"))}</span>
                              {listing.listingId ? <span>MLS {listing.listingId}</span> : null}
                              {listing.propertyType ? <span>{listing.propertyType}</span> : null}
                              {listing.bedroomsTotal ? <span>{listing.bedroomsTotal} {t("showingTour.beds")}</span> : null}
                              {listing.bathroomsTotalInteger ? <span>{listing.bathroomsTotalInteger} {t("showingTour.baths")}</span> : null}
                            </div>
                          </div>
                          <Badge variant="secondary">{t("showingTour.add")}</Badge>
                        </button>
                    ))
                  ) : (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      {t("showingTour.noResults")}
                    </div>
                  )}
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <MapPin className="h-4 w-4" />
                    {t("showingTour.selectedListings")}
                  </CardTitle>
                  <CardDescription>{t("showingTour.selectedDescription")}</CardDescription>
                  {routeMode === "manual" ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      {t("showingTour.dragHint")}
                    </p>
                  ) : null}
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="secondary">{selectedListings.length} / 10</Badge>
                  <Tabs
                    value={routeMode}
                    onValueChange={(value) => {
                      setRouteMode(value as "optimized" | "manual");
                      resetDerivedState();
                    }}
                  >
                    <TabsList className="grid w-[220px] grid-cols-2">
                      <TabsTrigger value="optimized">{t("showingTour.optimizedMode")}</TabsTrigger>
                      <TabsTrigger value="manual">{t("showingTour.manualMode")}</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {selectedListings.length === 0 ? (
                <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                  <Route className="mx-auto mb-3 h-8 w-8 opacity-50" />
                  {t("showingTour.emptyState")}
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedListings.map((listing, index) => {
                    const routeStop = routePreview?.stops.find((stop) => stop.listingKey === listing.listingKey);
                    return (
                      <div key={listing.listingKey} className="rounded-xl border bg-accent/20 p-4">
                        <div
                          className={`flex items-start gap-3 ${dragOverListingKey === listing.listingKey ? "rounded-lg bg-primary/5" : ""}`}
                          draggable={routeMode === "manual"}
                          onDragStart={(event) => {
                            if (routeMode !== "manual") return;
                            setDraggingListingKey(listing.listingKey);
                            event.dataTransfer.effectAllowed = "move";
                            event.dataTransfer.setData("text/plain", listing.listingKey);
                          }}
                          onDragOver={(event) => {
                            if (routeMode !== "manual") return;
                            event.preventDefault();
                            setDragOverListingKey(listing.listingKey);
                          }}
                          onDragLeave={() => {
                            if (dragOverListingKey === listing.listingKey) {
                              setDragOverListingKey(null);
                            }
                          }}
                          onDrop={(event) => {
                            if (routeMode !== "manual") return;
                            event.preventDefault();
                            const draggedKey = event.dataTransfer.getData("text/plain") || draggingListingKey;
                            if (draggedKey) {
                              moveListingByDrag(draggedKey, listing.listingKey);
                            }
                            setDraggingListingKey(null);
                            setDragOverListingKey(null);
                          }}
                          onDragEnd={() => {
                            setDraggingListingKey(null);
                            setDragOverListingKey(null);
                          }}
                        >
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                            {index + 1}
                          </div>
                          {routeMode === "manual" ? (
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center text-muted-foreground">
                              <GripVertical className="h-4 w-4" />
                            </div>
                          ) : null}
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium">
                              {displayAddress(listing, t("showingTour.addressUnknown"))}
                            </div>
                            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                              <span>{formatPrice(listing.listPrice, t("showingTour.pricePending"))}</span>
                              {listing.listingId ? <span>MLS {listing.listingId}</span> : null}
                              {listing.propertyType ? <span>{listing.propertyType}</span> : null}
                              {listing.bedroomsTotal ? <span>{listing.bedroomsTotal} {t("showingTour.beds")}</span> : null}
                              {listing.bathroomsTotalInteger ? <span>{listing.bathroomsTotalInteger} {t("showingTour.baths")}</span> : null}
                            </div>
                            {routeStop?.driveFromPreviousText ? (
                              <div className="mt-2 text-xs text-primary">
                                {t("showingTour.driveFromPrevious", {
                                  duration: routeStop.driveFromPreviousText,
                                  distance: routeStop.distanceFromPreviousText ?? "N/A",
                                })}
                              </div>
                            ) : null}
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              disabled={routeMode !== "manual" || index === 0}
                              onClick={() => moveListing(index, -1)}
                            >
                              <ArrowUp className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              disabled={routeMode !== "manual" || index === selectedListings.length - 1}
                              onClick={() => moveListing(index, 1)}
                            >
                              <ArrowDown className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              onClick={() => removeListing(listing.listingKey)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t("showingTour.tourInfo")}</CardTitle>
              <CardDescription>{t("showingTour.tourInfoDescription")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-xs text-muted-foreground">{t("showingTour.agentName")}</label>
                <Input value={agentName} onChange={(event) => setAgentName(event.target.value)} placeholder={t("showingTour.agentNamePlaceholder")} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">{t("showingTour.agentPhone")}</label>
                <Input value={agentPhone} onChange={(event) => setAgentPhone(event.target.value)} placeholder={t("showingTour.agentPhonePlaceholder")} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">{t("showingTour.clientName")}</label>
                <Input value={clientName} onChange={(event) => setClientName(event.target.value)} placeholder={t("showingTour.clientNamePlaceholder")} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">{t("showingTour.tourDate")}</label>
                <Input type="date" value={tourDate} onChange={(event) => setTourDate(event.target.value)} />
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <Button type="button" variant="outline" disabled={selectedListings.length < 2 || isBusy} onClick={handlePreviewRoute}>
                  {previewRoute.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Navigation className="mr-2 h-4 w-4" />}
                  {routeMode === "optimized" ? t("showingTour.optimizeRoute") : t("showingTour.recalculateRoute")}
                </Button>
                <Button type="button" disabled={selectedListings.length < 2 || isBusy} onClick={handleGenerateShare}>
                  {createTour.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Route className="mr-2 h-4 w-4" />}
                  {t("showingTour.generateShare")}
                </Button>
              </div>
              {selectedListings.length > 0 && selectedListings.length < 2 ? (
                <p className="text-center text-xs text-muted-foreground">
                  {t("showingTour.needMore", { count: String(2 - selectedListings.length) })}
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t("showingTour.routeSummaryTitle")}</CardTitle>
              <CardDescription>{t("showingTour.routeSummaryDescription")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {routePreview ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl border p-3">
                      <div className="text-xs text-muted-foreground">{t("showingTour.totalDistance")}</div>
                      <div className="mt-2 text-lg font-semibold">{routePreview.totalDistance ?? "N/A"}</div>
                    </div>
                    <div className="rounded-xl border p-3">
                      <div className="text-xs text-muted-foreground">{t("showingTour.driveTime")}</div>
                      <div className="mt-2 text-lg font-semibold">{routePreview.totalDuration ?? "N/A"}</div>
                    </div>
                  </div>
                  <div className="rounded-xl border p-4 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">{t("showingTour.routeModeLabel")}</span>
                      <Badge variant={routePreview.routeStatus === "fallback" ? "outline" : "secondary"}>
                        {routePreview.routeStatus === "optimized"
                          ? t("showingTour.routeStatusOptimized")
                          : routePreview.routeStatus === "manual"
                            ? t("showingTour.routeStatusManual")
                            : t("showingTour.routeStatusFallback")}
                      </Badge>
                    </div>
                    {routePreview.message ? (
                      <p className="mt-3 text-xs text-muted-foreground">{routePreview.message}</p>
                    ) : null}
                    {routePreview.googleMapsUrl ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="mt-4 w-full"
                        onClick={() => window.open(routePreview.googleMapsUrl!, "_blank", "noopener,noreferrer")}
                      >
                        <ExternalLink className="mr-2 h-4 w-4" />
                        {t("showingTour.openGoogleMaps")}
                      </Button>
                    ) : null}
                  </div>
                  <ShowingTourRouteMap
                    stops={routePreview.stops}
                    emptyState={t("showingTour.routeMapEmpty")}
                  />
                </>
              ) : (
                <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                  {t("showingTour.routeSummaryEmpty")}
                </div>
              )}
            </CardContent>
          </Card>

          {generatedUrl ? (
            <Card className="border-primary/30 bg-primary/5">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{t("showingTour.shareCardTitle")}</CardTitle>
                <CardDescription>{t("showingTour.shareCardDescription")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Input readOnly value={generatedUrl} className="text-xs" />
                <div className="grid gap-2 sm:grid-cols-2">
                  <Button type="button" variant="outline" onClick={copyLink}>
                    <Copy className="mr-2 h-4 w-4" />
                    {t("showingTour.copyLink")}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => window.open(generatedUrl, "_blank", "noopener,noreferrer")}>
                    <ExternalLink className="mr-2 h-4 w-4" />
                    {t("showingTour.preview")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
