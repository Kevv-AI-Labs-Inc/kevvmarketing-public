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
  MapPin,
  Phone,
  Route,
  Ruler,
  Sparkles,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
    }))
    .filter((item) => item.listingKey.length > 0)
    .sort((a, b) => a.order - b.order);
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

  return (
    <div className="min-h-[100dvh] bg-[#0f1412] text-stone-100">
      <div
        className="absolute inset-x-0 top-0 h-[420px] opacity-80"
        style={{
          background: `radial-gradient(circle at top, ${accentColor}33 0%, rgba(15, 20, 18, 0) 55%)`,
        }}
      />

      <div className="relative mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
          <div className="space-y-6">
            <section className="overflow-hidden rounded-[30px] border border-white/10 bg-[#171d1a]/90 shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur">
              <div className="grid gap-8 p-6 md:p-8">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="rounded-full border-white/15 bg-white/5 px-3 py-1 text-stone-100">
                    {pick(copy.curatedFor(clientName))}
                  </Badge>
                  <Badge variant="outline" className="rounded-full border-white/15 bg-white/5 px-3 py-1 text-stone-300">
                    {pick(copy.curatedBy(agentName))}
                  </Badge>
                </div>

                <div className="grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(260px,0.75fr)]">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-stone-400">{copy.brandLabel}</p>
                    <h1 className="mt-3 text-4xl font-serif tracking-tight text-white md:text-5xl">
                      {data.session.title || pick(copy.inventoryTitle)}
                    </h1>
                    <p className="mt-4 max-w-3xl text-sm leading-7 text-stone-300 md:text-base">
                      {data.session.introMessage || pick(copy.strategyFallback)}
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                    <Card className="rounded-[24px] border-white/10 bg-white/5 text-stone-100">
                      <CardContent className="p-4">
                        <p className="text-xs uppercase tracking-[0.24em] text-stone-400">{copy.statInventory}</p>
                        <p className="mt-3 text-2xl font-semibold">{displayListings.length}</p>
                        <p className="mt-1 text-xs text-stone-400">{pick(copy.listingCount(displayListings.length))}</p>
                      </CardContent>
                    </Card>
                    <Card className="rounded-[24px] border-white/10 bg-white/5 text-stone-100">
                      <CardContent className="p-4">
                        <p className="text-xs uppercase tracking-[0.24em] text-stone-400">{copy.statViews}</p>
                        <p className="mt-3 text-2xl font-semibold">{data.session.viewCount}</p>
                        <p className="mt-1 text-xs text-stone-400">{pick(copy.viewCount(data.session.viewCount))}</p>
                      </CardContent>
                    </Card>
                    <Card className="rounded-[24px] border-white/10 bg-white/5 text-stone-100">
                      <CardContent className="p-4">
                        <p className="text-xs uppercase tracking-[0.24em] text-stone-400">{pick(copy.createdAt)}</p>
                        <p className="mt-3 text-lg font-semibold">{formatDateTime(data.session.createdAt, locale)}</p>
                        <p className="mt-1 text-xs text-stone-400">{agentName}</p>
                      </CardContent>
                    </Card>
                    <Card className="rounded-[24px] border-white/10 bg-white/5 text-stone-100">
                      <CardContent className="p-4">
                        <p className="text-xs uppercase tracking-[0.24em] text-stone-400">{copy.statRoute}</p>
                        <p className="mt-3 text-2xl font-semibold">{tourStops.length}</p>
                        <p className="mt-1 text-xs text-stone-400">{pick(copy.routeCount(tourStops.length))}</p>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-[30px] border border-white/10 bg-[#151a18]/90 p-6 shadow-[0_20px_64px_rgba(0,0,0,0.24)] md:p-8">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/5 text-emerald-300">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.28em] text-stone-400">{copy.strategyEyebrow}</p>
                  <h2 className="text-2xl font-serif text-white">{pick(copy.strategyTitle)}</h2>
                </div>
              </div>
              {strategyPoints.length > 0 ? (
                <div className="mt-6 grid gap-3 md:grid-cols-2">
                  {strategyPoints.map((point) => (
                    <div key={point} className="rounded-[22px] border border-white/10 bg-white/5 p-4 text-sm leading-6 text-stone-200">
                      {point}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-6 max-w-3xl text-sm leading-7 text-stone-300">{pick(copy.strategyFallback)}</p>
              )}
            </section>

            {tourStops.length > 0 ? (
              <section className="rounded-[30px] border border-white/10 bg-[#151a18]/90 p-6 shadow-[0_20px_64px_rgba(0,0,0,0.24)] md:p-8">
                <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/5 text-emerald-300">
                      <Route className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.28em] text-stone-400">{copy.tourEyebrow}</p>
                      <h2 className="text-2xl font-serif text-white">{pick(copy.timelineTitle)}</h2>
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
                <p className="mt-4 text-sm leading-7 text-stone-300">{pick(copy.timelineFallback)}</p>
                <div className="mt-6 space-y-3">
                  {tourStops.map((stop) => (
                    <div key={`${stop.order}-${stop.listingKey}`} className="rounded-[22px] border border-white/10 bg-white/5 p-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-white">#{stop.order} {stop.address || stop.listingKey}</p>
                          <p className="mt-1 text-xs text-stone-400">
                            {formatDateTime(stop.startAt, locale)} - {formatDateTime(stop.endAt, locale)}
                          </p>
                        </div>
                        <Badge variant="outline" className="w-fit rounded-full border-white/15 bg-white/5 text-stone-300">
                          {stop.isExternal ? pick(copy.sourceExternal) : pick(copy.sourceMls)}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            <section className="rounded-[30px] border border-white/10 bg-[#151a18]/90 p-6 shadow-[0_20px_64px_rgba(0,0,0,0.24)] md:p-8">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.28em] text-stone-400">{copy.inventoryEyebrow}</p>
                  <h2 className="text-2xl font-serif text-white">{pick(copy.inventoryTitle)}</h2>
                </div>
                <Badge variant="outline" className="rounded-full border-white/15 bg-white/5 px-3 py-1 text-stone-300">
                  {pick(copy.listingCount(displayListings.length))}
                </Badge>
              </div>

              <div className="mt-6 grid gap-4 xl:grid-cols-2">
                {displayListings.map((listing) => {
                  const expanded = Boolean(expandedById[listing.id]);
                  return (
                    <article key={listing.id} className="overflow-hidden rounded-[26px] border border-white/10 bg-white/5 shadow-[0_16px_48px_rgba(0,0,0,0.18)]">
                      <div className="aspect-[4/3] w-full bg-gradient-to-br from-white/10 via-transparent to-white/5">
                        {listing.image ? (
                          <img src={listing.image} alt={listing.address} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full items-center justify-center text-sm text-stone-400">
                            {pick(copy.noPhoto)}
                          </div>
                        )}
                      </div>
                      <div className="space-y-4 p-5">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className="rounded-full border-white/15 bg-white/5 text-stone-300">
                            {listing.kind === "external" ? pick(copy.sourceExternal) : pick(copy.sourceMls)}
                          </Badge>
                          {listing.source ? (
                            <Badge variant="outline" className="rounded-full border-white/15 bg-white/5 text-stone-300">
                              {listing.source}
                            </Badge>
                          ) : null}
                        </div>

                        <div>
                          <h3 className="text-xl font-semibold text-white">{listing.address}</h3>
                          <p className="mt-2 text-2xl font-semibold text-white">{listing.price}</p>
                        </div>

                        <div className="flex flex-wrap gap-3 text-sm text-stone-300">
                          {listing.beds ? (
                            <span className="inline-flex items-center gap-1.5"><BedDouble className="h-4 w-4" />{listing.beds} {pick(copy.bedsShort)}</span>
                          ) : null}
                          {listing.baths ? (
                            <span className="inline-flex items-center gap-1.5"><Bath className="h-4 w-4" />{listing.baths} {pick(copy.bathsShort)}</span>
                          ) : null}
                          {listing.sqft ? (
                            <span className="inline-flex items-center gap-1.5"><Ruler className="h-4 w-4" />{listing.sqft} {pick(copy.sqftShort)}</span>
                          ) : null}
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Button
                            className="rounded-full px-5"
                            style={{ backgroundColor: accentColor }}
                            onClick={() => handleRequestTour(listing)}
                          >
                            {pick(copy.interestedHome)}
                          </Button>
                          <Button
                            variant="outline"
                            className="rounded-full border-white/15 bg-transparent text-stone-100 hover:bg-white/10"
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
                              className="rounded-full border-white/15 bg-transparent text-stone-100 hover:bg-white/10"
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

                        {expanded && listing.notes ? (
                          <div className="rounded-[20px] border border-white/10 bg-black/10 p-4 text-sm leading-7 text-stone-300">
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

          <aside className="space-y-6 lg:sticky lg:top-6">
            <section className="rounded-[30px] border border-white/10 bg-[#171d1a]/95 p-6 shadow-[0_20px_64px_rgba(0,0,0,0.28)]">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16 border border-white/10">
                  {avatarUrl ? <AvatarImage src={avatarUrl} alt={agentName} /> : null}
                  <AvatarFallback className="bg-white/10 text-lg text-stone-100">
                    {agentName.slice(0, 1).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-lg font-semibold text-white">{agentName}</p>
                  {agentTitle ? <p className="text-sm text-stone-300">{agentTitle}</p> : null}
                  {brokerageName ? <p className="text-xs uppercase tracking-[0.22em] text-stone-500">{brokerageName}</p> : null}
                </div>
              </div>

              <Separator className="my-5 bg-white/10" />

              <div className="space-y-3">
                <p className="text-xs uppercase tracking-[0.24em] text-stone-400">{pick(copy.contactTitle)}</p>
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
                    className="w-full justify-start rounded-2xl border-white/15 bg-transparent text-stone-100 hover:bg-white/10"
                    onClick={() => handleContact("email")}
                  >
                    <Mail className="mr-2 h-4 w-4" />
                    {pick(copy.emailAgent)}
                  </Button>
                ) : null}
                {wechatId ? (
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.24em] text-stone-500">{pick(copy.wechatLabel)}</p>
                        <p className="mt-1 text-sm text-stone-100">{wechatId}</p>
                      </div>
                      <Button
                        variant="outline"
                        className="rounded-full border-white/15 bg-transparent text-stone-100 hover:bg-white/10"
                        onClick={handleCopyWechat}
                      >
                        <Copy className="mr-2 h-4 w-4" />
                        {pick(copy.copyWechat)}
                      </Button>
                    </div>
                  </div>
                ) : null}
                {!phone && !email && !wechatId ? (
                  <p className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-stone-300">
                    {pick(copy.noContactInfo)}
                  </p>
                ) : null}
              </div>
            </section>

            <section className="rounded-[30px] border border-white/10 bg-[#171d1a]/95 p-6 shadow-[0_20px_64px_rgba(0,0,0,0.28)]">
              <div className="space-y-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-stone-400">{copy.serviceEyebrow}</p>
                  <h2 className="mt-1 text-2xl font-serif text-white">{copy.serviceTitle}</h2>
                </div>
                <div className="space-y-3 text-sm leading-7 text-stone-300">
                  <div className="flex items-start gap-3">
                    <Eye className="mt-1 h-4 w-4 text-emerald-300" />
                    <p>{pick(copy.serviceNote)}</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <CalendarClock className="mt-1 h-4 w-4 text-emerald-300" />
                    <p>{pick(copy.createdAt)}: {formatDateTime(data.session.createdAt, locale)}</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <Clock3 className="mt-1 h-4 w-4 text-emerald-300" />
                    <p>{tourStops.length > 0 ? pick(copy.routeCount(tourStops.length)) : pick(copy.timelineFallback)}</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <MapPin className="mt-1 h-4 w-4 text-emerald-300" />
                    <p>{pick(copy.listingCount(displayListings.length))}</p>
                  </div>
                </div>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
