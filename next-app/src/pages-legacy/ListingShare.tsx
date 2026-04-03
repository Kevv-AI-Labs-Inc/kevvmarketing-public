"use client";

import { useMemo, useState } from "react";
import type { inferRouterOutputs } from "@trpc/server";
import {
  Bath,
  BedDouble,
  CalendarClock,
  Clock3,
  Copy,
  ExternalLink,
  Eye,
  Loader2,
  Mail,
  Phone,
  Route,
  Ruler,
  Sparkles,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
// Card/CardContent removed — no longer used in Magic Share view
import { ShowingTourRouteMap } from "@/components/showing-tour/showing-tour-route-map";
import { Separator } from "@/components/ui/separator";
import { useT } from "@/i18n";
import { localeTag } from "@/i18n/copy";
import { getSharePageCopy } from "@/i18n/share-pages";
import AreaMagnetShare from "@/components/share/area-magnet-share";
import BuyerBoardView from "@/components/share/buyer-board-view";
import ClassicShareView from "@/components/share/classic-share-view";
import OfferWorksheetView from "@/components/share/offer-worksheet-view";
import TourRecapView from "@/components/share/tour-recap-view";
import { trpc } from "@/lib/trpc";
import type { AppRouter } from "@/routers";
import { toast } from "sonner";

type RouterOutput = inferRouterOutputs<AppRouter>;
type SharePayload = RouterOutput["share"]["getSessionByToken"];
type MlsListing = SharePayload["listings"][number];
type TourStop = {
  order: number;
  listingKey: string;
  address: string | null;
  startAt: string;
  endAt: string;
  isExternal?: boolean;
  latitude?: number | null;
  longitude?: number | null;
  driveFromPreviousText?: string | null;
  distanceFromPreviousText?: string | null;
};

type TourRouteSummary = {
  totalDistanceText: string | null;
  totalDurationText: string | null;
  googleMapsUrl: string | null;
  message: string | null;
};

type ListingShareProps = {
  token: string;
};

type DisplayListing = {
  id: string;
  kind: "mls" | "external";
  address: string;
  price: string;
  beds: string | null;
  baths: string | null;
  sqft: string | null;
  notes: string | null;
  image: string | null;
  source: string | null;
  externalUrl: string | null;
};

function getString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function getTourStops(value: unknown): TourStop[] {
  if (!value || typeof value !== "object") return [];
  const rawStops = (value as { stops?: unknown }).stops;
  if (!Array.isArray(rawStops)) return [];

  return rawStops
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .map((item) => ({
      order: typeof item.order === "number" ? item.order : 0,
      listingKey: getString(item.listingKey),
      address: getString(item.address) || null,
      startAt: getString(item.startAt),
      endAt: getString(item.endAt),
      isExternal: Boolean(item.isExternal),
      latitude:
        typeof item.latitude === "number"
          ? item.latitude
          : Number.isFinite(Number(item.latitude))
            ? Number(item.latitude)
            : null,
      longitude:
        typeof item.longitude === "number"
          ? item.longitude
          : Number.isFinite(Number(item.longitude))
            ? Number(item.longitude)
            : null,
      driveFromPreviousText: getString(item.driveFromPreviousText) || null,
      distanceFromPreviousText: getString(item.distanceFromPreviousText) || null,
    }))
    .filter((item) => item.listingKey.length > 0)
    .sort((a, b) => a.order - b.order);
}

function getTourRouteSummary(value: unknown): TourRouteSummary {
  if (!value || typeof value !== "object") {
    return {
      totalDistanceText: null,
      totalDurationText: null,
      googleMapsUrl: null,
      message: null,
    };
  }

  const route = (value as { route?: unknown }).route;
  if (!route || typeof route !== "object") {
    return {
      totalDistanceText: null,
      totalDurationText: null,
      googleMapsUrl: null,
      message: null,
    };
  }

  const source = route as Record<string, unknown>;
  return {
    totalDistanceText: getString(source.totalDistanceText) || null,
    totalDurationText: getString(source.totalDurationText) || null,
    googleMapsUrl: getString(source.googleMapsUrl) || null,
    message: getString(source.message) || null,
  };
}

function formatPrice(price: string | null | undefined, fallback: string) {
  if (!price) return fallback;
  const parsed = Number(price);
  if (!Number.isFinite(parsed)) return price;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(parsed);
}

function formatMetric(value: string | number | null | undefined) {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
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

function buildListingAddress(listing: MlsListing) {
  return (
    getString(listing.unparsedAddress) ||
    [getString(listing.city), getString(listing.stateOrProvince), getString(listing.postalCode)]
      .filter(Boolean)
      .join(", ") ||
    "Unknown address"
  );
}

export default function ListingShare({ token }: ListingShareProps) {
  const { locale } = useT();
  const copy = getSharePageCopy(locale).listingShare;
  const pick = (value: string) => value;
  const [expandedById, setExpandedById] = useState<Record<string, boolean>>({});

  const { data, isLoading, error } = trpc.share.getSessionByToken.useQuery(
    { token },
    { retry: 1, staleTime: 60_000 }
  );
  const trackEventMutation = trpc.share.trackEvent.useMutation({
    onError: () => {
      // Public share interactions should not interrupt the browsing flow.
    },
  });

  const trackEvent = (eventType: string, eventData?: Record<string, unknown>) => {
    trackEventMutation.mutate({ token, eventType, eventData });
  };

  const displayListings = useMemo<DisplayListing[]>(() => {
    if (!data) return [];

    const mlsItems = data.listings.map((listing) => ({
      id: listing.listingKey,
      kind: "mls" as const,
      address: buildListingAddress(listing),
      price: formatPrice(listing.listPrice, pick(copy.pricePending)),
      beds: formatMetric(listing.bedroomsTotal),
      baths: formatMetric(listing.bathroomsTotalInteger),
      sqft: formatMetric(listing.livingArea),
      notes: getString(listing.publicRemarks) || null,
      image: getStringArray(listing.images)[0] || null,
      source: getString(listing.standardStatus) || null,
      externalUrl: null,
    }));

    const externalItems = (data.externalListings as Array<Record<string, unknown>>).map((listing, index) => ({
      id: getString(listing.id) || `external-${index}`,
      kind: "external" as const,
      address: getString(listing.address) || copy.externalListingFallback,
      price: formatPrice(getString(listing.price) || null, pick(copy.pricePending)),
      beds: formatMetric(getString(listing.beds) || null),
      baths: formatMetric(getString(listing.baths) || null),
      sqft: formatMetric(getString(listing.sqft) || null),
      notes: getString(listing.notes) || null,
      image: null,
      source: getString(listing.source) || null,
      externalUrl: getString(listing.url) || null,
    }));

    return [...mlsItems, ...externalItems];
  }, [copy.externalListingFallback, copy.pricePending, data, pick]);

  const tourStops = useMemo(() => getTourStops(data?.tourPlan), [data?.tourPlan]);
  const tourRouteSummary = useMemo(() => getTourRouteSummary(data?.tourPlan), [data?.tourPlan]);

  const agentBranding = (data?.agentBranding ?? {}) as Record<string, unknown>;
  const shareConfig = (data?.shareConfig ?? {}) as Record<string, unknown>;
  const strategyPoints = getStringArray(shareConfig.strategyPoints);
  const accentColor = getString(agentBranding.accentColor) || "#1F5A4A";
  const agentName = getString(agentBranding.agentName) || copy.brandLabel;
  const agentTitle = getString(agentBranding.agentTitle);
  const brokerageName = getString(agentBranding.brokerageName);
  const phone = getString(agentBranding.phone);
  const email = getString(agentBranding.email);
  const wechatId = getString(agentBranding.wechatId);
  const avatarUrl = getString(agentBranding.avatarUrl);
  const clientName = data?.session.clientName || "";

  const handleContact = (channel: "phone" | "email") => {
    if (channel === "phone") {
      if (!phone) {
        toast.error(pick(copy.noContactInfo));
        return;
      }
      trackEvent("contact_click", { channel, source: "contact_card" });
      window.location.href =         "tel:" + phone;
      return;
    }

    if (!email) {
      toast.error(pick(copy.noContactInfo));
      return;
    }

    trackEvent("contact_click", { channel, source: "contact_card" });
    const subject = encodeURIComponent(data?.session.title || copy.emailSubjectFallback);
    window.location.href = "mailto:" + email + "?subject=" + subject;
  };

  const handleCopyWechat = async () => {
    if (!wechatId) {
      toast.error(pick(copy.noContactInfo));
      return;
    }

    try {
      await navigator.clipboard.writeText(wechatId);
      trackEvent("wechat_copy", { source: "contact_card" });
      toast.success(pick(copy.wechatCopied));
    } catch {
      toast.error(pick(copy.copyFailed));
    }
  };

  const handleRequestTour = (listing?: DisplayListing) => {
    trackEvent("tour_interest", {
      source: listing ? "listing_card" : "route_plan",
      listingId: listing?.id ?? null,
      listingKind: listing?.kind ?? null,
    });
    toast.success(pick(copy.interestLogged));
  };

  const handleOpenListing = (listing: DisplayListing, source: "details" | "external_link") => {
    trackEvent("listing_open", {
      listingId: listing.id,
      listingKind: listing.kind,
      source,
    });
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[#101412] px-6 text-stone-100">
        <div className="flex flex-col items-center gap-4 text-center">
          <Loader2 className="h-10 w-10 animate-spin text-emerald-300" />
          <p className="text-sm text-stone-300">{pick(copy.loading)}</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[#101412] px-6 text-stone-100">
        <div className="max-w-md rounded-[28px] border border-white/10 bg-white/5 p-8 text-center shadow-2xl shadow-black/30">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-white/10">
            <Route className="h-7 w-7 text-emerald-300" />
          </div>
          <h1 className="text-2xl font-semibold">{pick(copy.notFoundTitle)}</h1>
          <p className="mt-3 text-sm text-stone-300">{pick(copy.notFoundDescription)}</p>
        </div>
      </div>
    );
  }

  if (data.session.sessionType === "area_magnet") {
    return <AreaMagnetShare token={token} data={data} trackEvent={trackEvent} />;
  }

  // Buyer Board — collaborative listing board
  if (data.session.sessionType === "buyer_board") {
    const shareConfigRaw = (data.shareConfig ?? {}) as Record<string, unknown>;
    return (
      <BuyerBoardView
        token={token}
        session={data.session}
        agentBranding={(data.agentBranding ?? {}) as Record<string, unknown>}
        shareConfig={shareConfigRaw}
        listings={data.listings}
        trackEvent={trackEvent}
      />
    );
  }

  // Tour Recap — post-showing summary
  if (data.session.sessionType === "tour_recap") {
    const shareConfigRaw = (data.shareConfig ?? {}) as Record<string, unknown>;
    return (
      <TourRecapView
        token={token}
        session={data.session}
        agentBranding={(data.agentBranding ?? {}) as Record<string, unknown>}
        shareConfig={shareConfigRaw}
        listings={data.listings}
        trackEvent={trackEvent}
      />
    );
  }

  // Offer Worksheet — pre-offer comparison tool
  if (data.session.sessionType === "offer_worksheet") {
    const shareConfigRaw = (data.shareConfig ?? {}) as Record<string, unknown>;
    return (
      <OfferWorksheetView
        token={token}
        session={data.session}
        agentBranding={(data.agentBranding ?? {}) as Record<string, unknown>}
        shareConfig={shareConfigRaw}
        listings={data.listings}
        trackEvent={trackEvent}
      />
    );
  }

  // Classic share mode — clean, light, data-focused
  const shareConfigRaw = (data.shareConfig ?? {}) as Record<string, unknown>;
  if (getString(shareConfigRaw.shareMode) === "classic") {
    return (
      <ClassicShareView
        token={token}
        session={data.session}
        agentBranding={(data.agentBranding ?? {}) as Record<string, unknown>}
        shareConfig={shareConfigRaw}
        listings={data.listings}
        trackEvent={trackEvent}
      />
    );
  }

  /* ── Lightbox state ─────────────────────────────────── */
  const [lightboxImages, setLightboxImages] = useState<string[] | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  /* ── Derived data for the new layout ─────────────────── */
  const mlsListingMap = useMemo(() => {
    const map = new Map<string, MlsListing>();
    if (data) {
      for (const l of data.listings) map.set(l.listingKey, l);
    }
    return map;
  }, [data]);

  const heroListing = displayListings[0] ?? null;
  const heroImages = heroListing
    ? getStringArray(mlsListingMap.get(heroListing.id)?.images)
    : [];
  const heroImage = heroImages[0] ?? heroListing?.image ?? null;

  const priceRange = useMemo(() => {
    const nums = displayListings
      .map((l) => {
        const n = Number(l.price.replace(/[^0-9.]/g, ""));
        return Number.isFinite(n) && n > 0 ? n : null;
      })
      .filter((n): n is number => n !== null);
    if (nums.length === 0) return null;
    const min = Math.min(...nums);
    const max = Math.max(...nums);
    const fmt = (v: number) =>
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      }).format(v);
    return min === max ? fmt(min) : `${fmt(min)} - ${fmt(max)}`;
  }, [displayListings]);

  return (
    <div className="min-h-[100dvh] bg-[#0a0f0d] text-stone-100">

      {/* ═══════════════════════════════════════════════════════
          1. FULL-BLEED HERO (first listing image)
         ═══════════════════════════════════════════════════════ */}
      <section className="relative w-full overflow-hidden" style={{ minHeight: heroImage ? 520 : 320 }}>
        {heroImage ? (
          <img
            src={heroImage}
            alt={heroListing?.address ?? ""}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-white/5" />
        )}
        {/* gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0f0d] via-[#0a0f0d]/70 to-transparent" />

        {/* agent avatar top-right */}
        <div className="absolute right-4 top-4 z-10 flex items-center gap-3 rounded-full bg-black/40 py-2 pl-2 pr-4 backdrop-blur-md md:right-8 md:top-8">
          <Avatar className="h-9 w-9 border border-white/20">
            {avatarUrl ? <AvatarImage src={avatarUrl} alt={agentName} /> : null}
            <AvatarFallback className="bg-white/10 text-sm text-stone-100">
              {agentName.slice(0, 1).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="text-sm font-medium text-white">{agentName}</span>
        </div>

        {/* hero content */}
        <div className="relative z-10 mx-auto flex max-w-7xl flex-col justify-end px-5 pb-10 pt-40 md:px-8 md:pb-14 md:pt-56">
          <p className="text-xs uppercase tracking-[0.3em] text-stone-400">{copy.brandLabel}</p>
          <h1 className="mt-3 max-w-3xl font-serif text-4xl tracking-tight text-white md:text-5xl lg:text-6xl">
            {data.session.title || pick(copy.inventoryTitle)}
          </h1>
          {clientName ? (
            <p className="mt-3 text-base text-stone-300">{pick(copy.curatedFor(clientName))}</p>
          ) : null}
          {data.session.introMessage ? (
            <p className="mt-3 max-w-2xl text-sm leading-7 text-stone-400">{data.session.introMessage}</p>
          ) : null}
          <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-stone-400">
            {priceRange ? <span className="font-medium text-white">{priceRange}</span> : null}
            <span className="text-stone-500">{"\u00B7"}</span>
            <span>{pick(copy.listingCount(displayListings.length))}</span>
            {tourStops.length > 0 ? (
              <>
                <span className="text-stone-500">{"\u00B7"}</span>
                <span>{pick(copy.routeCount(tourStops.length))}</span>
              </>
            ) : null}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          MAIN CONTENT GRID
         ═══════════════════════════════════════════════════════ */}
      <div className="relative mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-10">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
          <div className="space-y-8">

            {/* ── 2. Strategy Points as Pills ──────────────────── */}
            {strategyPoints.length > 0 ? (
              <section>
                <div className="flex items-center gap-3 mb-4">
                  <Sparkles className="h-5 w-5 text-emerald-300" />
                  <h2 className="font-serif text-xl text-white">{pick(copy.strategyTitle)}</h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  {strategyPoints.map((point) => (
                    <span
                      key={point}
                      className="inline-block rounded-full border px-4 py-1.5 text-xs leading-5 text-stone-300"
                      style={{ borderColor: accentColor + "44" }}
                    >
                      {point}
                    </span>
                  ))}
                </div>
              </section>
            ) : null}

            {/* ── 3. Tour Section ──────────────────────────────── */}
            {tourStops.length > 0 ? (
              <section className="rounded-3xl border border-white/8 bg-[rgba(255,255,255,0.03)] p-6 md:p-8">
                <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                  <div className="flex items-center gap-3">
                    <Route className="h-5 w-5 text-emerald-300" />
                    <div>
                      <p className="text-xs uppercase tracking-[0.28em] text-stone-500">{copy.tourEyebrow}</p>
                      <h2 className="font-serif text-2xl text-white">{pick(copy.timelineTitle)}</h2>
                    </div>
                  </div>
                  <Button
                    className="rounded-full px-5"
                    style={{ backgroundColor: accentColor }}
                    onClick={() => {
                      trackEvent("route_request", { source: "route_section" });
                      toast.success(pick(copy.interestLogged));
                    }}
                  >
                    {pick(copy.requestTour)}
                  </Button>
                </div>

                <p className="mt-4 text-sm leading-7 text-stone-400">
                  {tourRouteSummary.totalDistanceText || tourRouteSummary.totalDurationText
                    ? pick(
                        copy.routeSummary(
                          tourRouteSummary.totalDistanceText ?? "-",
                          tourRouteSummary.totalDurationText ?? "-"
                        )
                      )
                    : pick(copy.timelineFallback)}
                </p>

                {tourRouteSummary.googleMapsUrl ? (
                  <Button
                    variant="outline"
                    className="mt-4 rounded-full border-white/10 bg-white/5 text-stone-100 hover:bg-white/10"
                    onClick={() => {
                      trackEvent("route_open_google_maps", { source: "route_section" });
                      window.open(tourRouteSummary.googleMapsUrl!, "_blank", "noopener,noreferrer");
                    }}
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    {copy.openGoogleMaps}
                  </Button>
                ) : null}

                <ShowingTourRouteMap
                  stops={tourStops}
                  emptyState={pick(copy.timelineFallback)}
                  className="mt-6 h-[320px] rounded-2xl overflow-hidden"
                />

                <div className="mt-6 space-y-2">
                  {tourStops.map((stop) => (
                    <div
                      key={`${stop.order}-${stop.listingKey}`}
                      className="flex flex-col gap-2 rounded-2xl border border-white/8 bg-white/[0.02] p-4 md:flex-row md:items-center md:justify-between"
                    >
                      <div>
                        <p className="text-sm font-semibold text-white">#{stop.order} {stop.address || stop.listingKey}</p>
                        <p className="mt-0.5 text-xs text-stone-500">
                          {stop.driveFromPreviousText
                            ? pick(
                                copy.stopDriveSummary(
                                  stop.driveFromPreviousText,
                                  stop.distanceFromPreviousText || "-"
                                )
                              )
                            : stop.startAt || stop.endAt
                              ? `${formatDateTime(stop.startAt, locale)} - ${formatDateTime(stop.endAt, locale)}`
                              : pick(copy.stopStartLabel)}
                        </p>
                      </div>
                      <Badge variant="outline" className="w-fit rounded-full border-white/10 bg-white/5 text-xs text-stone-400">
                        {stop.isExternal ? pick(copy.sourceExternal) : pick(copy.sourceMls)}
                      </Badge>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {/* ── 4. Listing Cards ─────────────────────────────── */}
            <section>
              <div className="flex items-center justify-between gap-4 mb-6">
                <div>
                  <p className="text-xs uppercase tracking-[0.28em] text-stone-500">{copy.inventoryEyebrow}</p>
                  <h2 className="font-serif text-2xl text-white">{pick(copy.inventoryTitle)}</h2>
                </div>
                <Badge variant="outline" className="rounded-full border-white/10 bg-white/5 px-3 py-1 text-stone-400">
                  {pick(copy.listingCount(displayListings.length))}
                </Badge>
              </div>

              <div className="grid gap-6 xl:grid-cols-2">
                {displayListings.map((listing, idx) => {
                  const expanded = Boolean(expandedById[listing.id]);
                  const rawMls = mlsListingMap.get(listing.id);
                  const allImages = rawMls ? getStringArray(rawMls.images) : listing.image ? [listing.image] : [];
                  const gridImages = allImages.slice(0, 4);
                  const statusLabel = listing.source;
                  const yearBuilt: string | null = null;
                  const propertyType: string | null = null;

                  return (
                    <article
                      key={listing.id}
                      className="overflow-hidden rounded-3xl border bg-[rgba(255,255,255,0.03)] shadow-[0_16px_48px_rgba(0,0,0,0.2)]"
                      style={{ borderColor: accentColor + "33" }}
                    >
                      {/* ── Image Gallery ── */}
                      <div className="relative">
                        {gridImages.length >= 4 ? (
                          <div className="grid grid-cols-2 grid-rows-2 gap-0.5">
                            <button
                              type="button"
                              className="row-span-2 aspect-[3/4] w-full overflow-hidden focus:outline-none"
                              onClick={() => { setLightboxImages(allImages); setLightboxIndex(0); }}
                            >
                              <img src={gridImages[0]} alt={listing.address} className="h-full w-full object-cover transition-transform hover:scale-105" loading={idx < 2 ? "eager" : "lazy"} />
                            </button>
                            {gridImages.slice(1, 4).map((img, i) => (
                              <button
                                key={img}
                                type="button"
                                className="aspect-[4/3] w-full overflow-hidden focus:outline-none"
                                onClick={() => { setLightboxImages(allImages); setLightboxIndex(i + 1); }}
                              >
                                <img src={img} alt={listing.address} className="h-full w-full object-cover transition-transform hover:scale-105" loading="lazy" />
                              </button>
                            ))}
                          </div>
                        ) : gridImages.length > 0 ? (
                          <button
                            type="button"
                            className="aspect-[16/9] w-full overflow-hidden bg-gradient-to-br from-white/10 via-transparent to-white/5 focus:outline-none"
                            onClick={() => { setLightboxImages(allImages); setLightboxIndex(0); }}
                          >
                            <img src={gridImages[0]} alt={listing.address} className="h-full w-full object-cover transition-transform hover:scale-105" loading={idx < 2 ? "eager" : "lazy"} />
                          </button>
                        ) : (
                          <div className="flex aspect-[16/9] w-full items-center justify-center bg-gradient-to-br from-white/10 via-transparent to-white/5 text-sm text-stone-500">
                            {pick(copy.noPhoto)}
                          </div>
                        )}

                        {/* Status badge overlay */}
                        {statusLabel ? (
                          <span
                            className="absolute left-3 top-3 rounded-full px-3 py-1 text-xs font-medium text-white backdrop-blur-sm"
                            style={{ backgroundColor: accentColor + "cc" }}
                          >
                            {statusLabel}
                          </span>
                        ) : null}
                      </div>

                      {/* ── Card Body ── */}
                      <div className="space-y-4 p-5">
                        {/* Price */}
                        <p className="text-3xl font-bold tracking-tight text-white">{listing.price}</p>

                        {/* Address */}
                        <p className="text-sm text-stone-300">{listing.address}</p>

                        {/* Metrics row */}
                        <div className="flex flex-wrap items-center gap-2 text-xs text-stone-400">
                          {listing.beds ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-white/8 bg-white/[0.03] px-2.5 py-1">
                              <BedDouble className="h-3.5 w-3.5" /> {listing.beds} {pick(copy.bedsShort)}
                            </span>
                          ) : null}
                          {listing.baths ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-white/8 bg-white/[0.03] px-2.5 py-1">
                              <Bath className="h-3.5 w-3.5" /> {listing.baths} {pick(copy.bathsShort)}
                            </span>
                          ) : null}
                          {listing.sqft ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-white/8 bg-white/[0.03] px-2.5 py-1">
                              <Ruler className="h-3.5 w-3.5" /> {listing.sqft} {pick(copy.sqftShort)}
                            </span>
                          ) : null}
                          {yearBuilt ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-white/8 bg-white/[0.03] px-2.5 py-1">
                              {yearBuilt}
                            </span>
                          ) : null}
                          {propertyType ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-white/8 bg-white/[0.03] px-2.5 py-1">
                              {propertyType}
                            </span>
                          ) : null}
                        </div>

                        {/* CTA buttons */}
                        <div className="flex flex-wrap gap-2">
                          <Button
                            className="rounded-full px-5 text-sm"
                            style={{ backgroundColor: accentColor }}
                            onClick={() => handleRequestTour(listing)}
                          >
                            <CalendarClock className="mr-2 h-4 w-4" />
                            {pick(copy.requestTour)}
                          </Button>
                          <Button
                            variant="outline"
                            className="rounded-full border-white/10 bg-transparent text-sm text-stone-100 hover:bg-white/10"
                            onClick={() => {
                              if (!expanded) {
                                handleOpenListing(listing, "details");
                              }
                              setExpandedById((prev) => ({ ...prev, [listing.id]: !expanded }));
                            }}
                          >
                            {expanded ? pick(copy.hideDetails) : pick(copy.showDetails)}
                          </Button>
                          {listing.externalUrl ? (
                            <Button
                              variant="outline"
                              className="rounded-full border-white/10 bg-transparent text-sm text-stone-100 hover:bg-white/10"
                              onClick={() => {
                                handleOpenListing(listing, "external_link");
                                window.open(listing.externalUrl as string, "_blank", "noopener,noreferrer");
                              }}
                            >
                              <ExternalLink className="mr-2 h-4 w-4" />
                              {pick(copy.openSource)}
                            </Button>
                          ) : null}
                        </div>

                        {/* Expanded remarks */}
                        {expanded && listing.notes ? (
                          <div className="rounded-2xl border border-white/8 bg-black/20 p-4 text-sm leading-7 text-stone-300">
                            <p className="mb-2 text-xs uppercase tracking-[0.24em] text-stone-500">{pick(copy.notesTitle)}</p>
                            <p>{listing.notes}</p>
                          </div>
                        ) : null}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          </div>

          {/* ═══════════════════════════════════════════════════════
              SIDEBAR — Agent Card
             ═══════════════════════════════════════════════════════ */}
          <aside className="hidden space-y-6 lg:sticky lg:top-6 lg:block">
            <section className="overflow-hidden rounded-3xl border border-white/8 bg-[rgba(255,255,255,0.03)] shadow-[0_20px_64px_rgba(0,0,0,0.28)]">
              {/* Accent top line */}
              <div className="h-1 w-full" style={{ backgroundColor: accentColor }} />

              <div className="p-6">
                <div className="flex flex-col items-center text-center">
                  <Avatar className="h-24 w-24 border-2 border-white/10">
                    {avatarUrl ? <AvatarImage src={avatarUrl} alt={agentName} /> : null}
                    <AvatarFallback className="bg-white/10 text-2xl text-stone-100">
                      {agentName.slice(0, 1).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <p className="mt-4 text-lg font-semibold text-white">{agentName}</p>
                  {agentTitle ? <p className="mt-1 text-sm text-stone-400">{agentTitle}</p> : null}
                  {brokerageName ? <p className="mt-1 text-xs uppercase tracking-[0.22em] text-stone-500">{brokerageName}</p> : null}
                </div>

                <Separator className="my-5 bg-white/8" />

                <div className="space-y-3">
                  <p className="text-xs uppercase tracking-[0.24em] text-stone-500">{pick(copy.contactTitle)}</p>
                  {phone ? (
                    <Button
                      className="w-full justify-start rounded-2xl text-left"
                      style={{ backgroundColor: accentColor }}
                      onClick={() => handleContact("phone")}
                    >
                      <Phone className="mr-2 h-4 w-4" />
                      {pick(copy.callAgent)}
                    </Button>
                  ) : null}
                  {email ? (
                    <Button
                      variant="outline"
                      className="w-full justify-start rounded-2xl border-white/10 bg-transparent text-stone-100 hover:bg-white/10"
                      onClick={() => handleContact("email")}
                    >
                      <Mail className="mr-2 h-4 w-4" />
                      {pick(copy.emailAgent)}
                    </Button>
                  ) : null}
                  {wechatId ? (
                    <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs uppercase tracking-[0.24em] text-stone-500">{pick(copy.wechatLabel)}</p>
                          <p className="mt-1 text-sm text-stone-100">{wechatId}</p>
                        </div>
                        <Button
                          variant="outline"
                          className="rounded-full border-white/10 bg-transparent text-stone-100 hover:bg-white/10"
                          onClick={handleCopyWechat}
                        >
                          <Copy className="mr-2 h-4 w-4" />
                          {pick(copy.copyWechat)}
                        </Button>
                      </div>
                    </div>
                  ) : null}
                  {!phone && !email && !wechatId ? (
                    <p className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-stone-400">
                      {pick(copy.noContactInfo)}
                    </p>
                  ) : null}
                </div>

                {/* Service info (moved from separate card) */}
                <Separator className="my-5 bg-white/8" />
                <div className="space-y-2 text-xs text-stone-500">
                  <div className="flex items-center gap-2">
                    <Eye className="h-3.5 w-3.5 text-emerald-400" />
                    <span>{pick(copy.serviceNote)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CalendarClock className="h-3.5 w-3.5 text-emerald-400" />
                    <span>{pick(copy.createdAt)}: {formatDateTime(data.session.createdAt, locale)}</span>
                  </div>
                  {(tourRouteSummary.totalDistanceText || tourRouteSummary.totalDurationText) ? (
                    <div className="flex items-center gap-2">
                      <Clock3 className="h-3.5 w-3.5 text-emerald-400" />
                      <span>
                        {pick(
                          copy.routeSummary(
                            tourRouteSummary.totalDistanceText ?? "-",
                            tourRouteSummary.totalDurationText ?? "-"
                          )
                        )}
                      </span>
                    </div>
                  ) : null}
                </div>
              </div>
            </section>
          </aside>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════
          5. MOBILE STICKY CTA BAR
         ═══════════════════════════════════════════════════════ */}
      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-[#0a0f0d]/95 px-4 py-3 backdrop-blur-lg lg:hidden">
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9 shrink-0 border border-white/15">
            {avatarUrl ? <AvatarImage src={avatarUrl} alt={agentName} /> : null}
            <AvatarFallback className="bg-white/10 text-sm text-stone-100">
              {agentName.slice(0, 1).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-white">{agentName}</span>
          {phone ? (
            <Button
              size="sm"
              className="rounded-full px-4"
              style={{ backgroundColor: accentColor }}
              onClick={() => handleContact("phone")}
            >
              <Phone className="mr-1.5 h-3.5 w-3.5" />
              {pick(copy.callAgent)}
            </Button>
          ) : null}
          {email ? (
            <Button
              size="sm"
              variant="outline"
              className="rounded-full border-white/10 bg-transparent px-4 text-stone-100 hover:bg-white/10"
              onClick={() => handleContact("email")}
            >
              <Mail className="mr-1.5 h-3.5 w-3.5" />
              {pick(copy.emailAgent)}
            </Button>
          ) : null}
        </div>
      </div>

      {/* Add bottom padding on mobile so content isn't hidden behind sticky bar */}
      <div className="h-20 lg:hidden" />

      {/* ═══════════════════════════════════════════════════════
          6. LIGHTBOX
         ═══════════════════════════════════════════════════════ */}
      {lightboxImages && lightboxImages.length > 0 ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm"
          onClick={() => setLightboxImages(null)}
        >
          {/* Close button */}
          <button
            type="button"
            className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
            onClick={() => setLightboxImages(null)}
          >
            &times;
          </button>

          {/* Previous */}
          {lightboxImages.length > 1 ? (
            <button
              type="button"
              className="absolute left-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
              onClick={(e) => {
                e.stopPropagation();
                setLightboxIndex((prev) => (prev - 1 + lightboxImages.length) % lightboxImages.length);
              }}
            >
              &#8249;
            </button>
          ) : null}

          {/* Image */}
          <img
            src={lightboxImages[lightboxIndex]}
            alt=""
            className="max-h-[85vh] max-w-[90vw] rounded-2xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />

          {/* Next */}
          {lightboxImages.length > 1 ? (
            <button
              type="button"
              className="absolute right-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
              onClick={(e) => {
                e.stopPropagation();
                setLightboxIndex((prev) => (prev + 1) % lightboxImages.length);
              }}
            >
              &#8250;
            </button>
          ) : null}

          {/* Counter */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-4 py-1.5 text-xs text-stone-300">
            {lightboxIndex + 1} / {lightboxImages.length}
          </div>
        </div>
      ) : null}
    </div>
  );
}
