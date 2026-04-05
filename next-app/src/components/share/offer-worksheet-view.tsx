"use client";

import { useMemo, useState } from "react";
import {
  Bath,
  BedDouble,
  Calendar,
  ChevronDown,
  ChevronUp,
  Home,
  Mail,
  MapPin,
  Phone,
  Ruler,
  TrendingUp,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useT } from "@/i18n";
import { getSharePageCopy } from "@/i18n/share-pages";

/* ────────────────────────────────────────────────────────────── */
/*  Types                                                        */
/* ────────────────────────────────────────────────────────────── */

type MlsListing = {
  listingKey: string;
  unparsedAddress?: string | null;
  city?: string | null;
  stateOrProvince?: string | null;
  postalCode?: string | null;
  listPrice?: string | null;
  bedroomsTotal?: number | null;
  bathroomsTotalInteger?: number | null;
  livingArea?: string | null;
  publicRemarks?: string | null;
  standardStatus?: string | null;
  propertyType?: string | null;
  lotSizeArea?: string | null;
  yearBuilt?: number | null;
  images?: string[];
};

type ComparableEntry = {
  listingKey: string;
  whyComparable: string;
  soldPrice?: number;
  soldDate?: string;
  adjustmentNotes?: string;
};

type OfferWorksheetViewProps = {
  token: string;
  session: {
    title: string | null;
    clientName: string | null;
    introMessage: string | null;
  };
  agentBranding: Record<string, unknown>;
  shareConfig: Record<string, unknown>;
  listings: MlsListing[];
  trackEvent: (eventType: string, eventData?: Record<string, unknown>) => void;
};

/* ────────────────────────────────────────────────────────────── */
/*  Helpers                                                      */
/* ────────────────────────────────────────────────────────────── */

function getString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function formatPrice(value: string | number | null | undefined): string | null {
  if (value == null) return null;
  const parsed = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(parsed)) return typeof value === "string" ? value : null;
  if (parsed >= 1_000_000) {
    const millions = parsed / 1_000_000;
    // Show decimals only if needed: $1.25M vs $2M
    const formatted =
      millions % 1 === 0
        ? millions.toFixed(0)
        : millions.toFixed(2).replace(/0+$/, "");
    return `$${formatted}M`;
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(parsed);
}

function formatPriceFullCurrency(
  value: string | number | null | undefined,
): string | null {
  if (value == null) return null;
  const parsed = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(parsed)) return null;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(parsed);
}

function computePricePerSqft(
  price: string | number | null | undefined,
  sqft: string | null | undefined,
): number | null {
  if (price == null || !sqft) return null;
  const p = typeof price === "string" ? Number(price) : price;
  const s = Number(sqft);
  if (!Number.isFinite(p) || !Number.isFinite(s) || s === 0) return null;
  return Math.round(p / s);
}

function buildAddress(listing: MlsListing) {
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

/* ────────────────────────────────────────────────────────────── */
/*  Offer Worksheet View                                         */
/*  Pre-offer decision tool: target property + comps + range     */
/* ────────────────────────────────────────────────────────────── */

export default function OfferWorksheetView({
  token,
  session,
  agentBranding,
  shareConfig,
  listings,
  trackEvent,
}: OfferWorksheetViewProps) {
  const { locale } = useT();
  const copy = getSharePageCopy(locale);

  const [remarksExpanded, setRemarksExpanded] = useState(false);

  /* ── Agent branding ── */
  const agentName = getString(agentBranding.agentName) || "Agent";
  const agentTitle = getString(agentBranding.agentTitle);
  const brokerageName = getString(agentBranding.brokerageName);
  const phone = getString(agentBranding.phone);
  const email = getString(agentBranding.email);
  const avatarUrl = getString(agentBranding.avatarUrl);

  /* ── Share config ── */
  const targetListingKey = getString(shareConfig.targetListingKey);
  const suggestedOfferLow = shareConfig.suggestedOfferLow as number | undefined;
  const suggestedOfferHigh = shareConfig.suggestedOfferHigh as
    | number
    | undefined;
  const agentRecommendation = getString(shareConfig.agentRecommendation);
  const comparables = (shareConfig.comparables ?? []) as ComparableEntry[];

  /* ── Resolve target listing ── */
  const targetListing = useMemo(
    () => listings.find((l) => l.listingKey === targetListingKey) ?? null,
    [listings, targetListingKey],
  );

  /* ── Resolve comparable listings ── */
  const compListings = useMemo(() => {
    const listingMap = new Map(listings.map((l) => [l.listingKey, l]));
    return comparables
      .map((comp) => ({
        ...comp,
        listing: listingMap.get(comp.listingKey) ?? null,
      }))
      .filter((c) => c.listing !== null) as Array<
      ComparableEntry & { listing: MlsListing }
    >;
  }, [listings, comparables]);

  /* ── Handlers ── */
  const handleCall = () => {
    if (!phone) return;
    trackEvent("contact_click", { channel: "phone", source: "offer_worksheet_bar" });
    window.location.href = "tel:" + phone;
  };

  const handleEmail = () => {
    if (!email) return;
    trackEvent("contact_click", { channel: "email", source: "offer_worksheet_bar" });
    const subject = encodeURIComponent(
      session.title || copy.offerWorksheet.defaultTitle,
    );
    window.location.href = "mailto:" + email + "?subject=" + subject;
  };

  const targetAddress = targetListing ? buildAddress(targetListing) : "";
  const targetPrice = targetListing
    ? formatPrice(targetListing.listPrice)
    : null;

  return (
    <div className="min-h-[100dvh] bg-white text-stone-900">
      {/* ─── Sticky bottom CTA bar (mobile) ─────── */}
      <div className="fixed bottom-0 inset-x-0 z-50 border-t bg-white/95 backdrop-blur-sm px-4 py-3 flex items-center justify-between gap-3 sm:hidden">
        <div className="flex items-center gap-2.5 min-w-0">
          <Avatar className="h-8 w-8 shrink-0">
            {avatarUrl && <AvatarImage src={avatarUrl} alt={agentName} />}
            <AvatarFallback className="text-xs bg-stone-100">
              {agentName.slice(0, 1).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <p className="truncate text-sm font-medium">{agentName}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {phone && (
            <Button
              size="sm"
              onClick={handleCall}
              className="rounded-full h-9 px-4"
            >
              <Phone className="h-3.5 w-3.5 mr-1.5" />
              {copy.offerWorksheet.call}
            </Button>
          )}
          {email && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleEmail}
              className="rounded-full h-9 px-4"
            >
              <Mail className="h-3.5 w-3.5 mr-1.5" />
              {copy.offerWorksheet.email}
            </Button>
          )}
        </div>
      </div>

      {/* ─── Main content ──────────────────────────── */}
      <div className="mx-auto max-w-3xl px-4 py-6 pb-24 sm:pb-8 md:px-6">
        {/* ─── Hero header ──────────────────────────── */}
        <header className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Avatar className="h-10 w-10 border">
              {avatarUrl && <AvatarImage src={avatarUrl} alt={agentName} />}
              <AvatarFallback className="bg-stone-100 text-sm">
                {agentName.slice(0, 1).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-sm font-semibold">{agentName}</p>
              <p className="text-xs text-stone-500">
                {[agentTitle, brokerageName].filter(Boolean).join(" · ")}
              </p>
            </div>

            {/* Desktop contact buttons */}
            <div className="hidden sm:flex items-center gap-2 ml-auto">
              {phone && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCall}
                  className="rounded-full"
                >
                  <Phone className="h-3.5 w-3.5 mr-1.5" />
                  {phone}
                </Button>
              )}
              {email && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleEmail}
                  className="rounded-full"
                >
                  <Mail className="h-3.5 w-3.5 mr-1.5" />
                  {copy.offerWorksheet.email}
                </Button>
              )}
            </div>
          </div>

          {session.clientName && (
            <p className="text-xs text-stone-400 uppercase tracking-wider mb-2">
              {copy.offerWorksheet.preparedFor(session.clientName || "")}
            </p>
          )}

          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {copy.offerWorksheet.defaultTitle}
          </h1>
          {targetAddress && (
            <p className="mt-1 text-base text-stone-500">{targetAddress}</p>
          )}

          {session.introMessage && (
            <div className="mt-4 rounded-xl bg-stone-50 border border-stone-100 px-4 py-3">
              <p className="text-sm text-stone-600 leading-relaxed italic">
                &ldquo;{session.introMessage}&rdquo;
              </p>
              <p className="text-xs text-stone-400 mt-1.5">&mdash; {agentName}</p>
            </div>
          )}
        </header>

        {/* ─── Target Property (featured card) ──────── */}
        {targetListing && (
          <section className="mb-8">
            <article className="overflow-hidden rounded-2xl border-2 border-stone-300 bg-white shadow-md">
              {/* Hero image */}
              {targetListing.images?.[0] && (
                <div className="aspect-[16/9] w-full bg-stone-100 overflow-hidden">
                  <img
                    src={targetListing.images[0]}
                    alt={targetAddress}
                    className="h-full w-full object-cover"
                    loading="eager"
                  />
                </div>
              )}

              <div className="p-5 sm:p-6">
                {/* Address + Price */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-xl font-bold text-stone-900 leading-tight">
                      {targetAddress}
                    </h2>
                    {targetListing.city && (
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-stone-500">
                        <MapPin className="h-3 w-3" />
                        {[
                          targetListing.city,
                          targetListing.stateOrProvince,
                          targetListing.postalCode,
                        ]
                          .filter(Boolean)
                          .join(", ")}
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    {targetPrice && (
                      <p className="text-2xl font-bold text-stone-900">
                        {targetPrice}
                      </p>
                    )}
                    <p className="text-xs text-stone-500">{copy.offerWorksheet.listPrice}</p>
                  </div>
                </div>

                {/* Key stats */}
                <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-stone-600">
                  {targetListing.bedroomsTotal != null && (
                    <span className="inline-flex items-center gap-1.5">
                      <BedDouble className="h-4 w-4 text-stone-400" />
                      {targetListing.bedroomsTotal} {copy.offerWorksheet.beds}
                    </span>
                  )}
                  {targetListing.bathroomsTotalInteger != null && (
                    <span className="inline-flex items-center gap-1.5">
                      <Bath className="h-4 w-4 text-stone-400" />
                      {targetListing.bathroomsTotalInteger} {copy.offerWorksheet.baths}
                    </span>
                  )}
                  {targetListing.livingArea && (
                    <span className="inline-flex items-center gap-1.5">
                      <Ruler className="h-4 w-4 text-stone-400" />
                      {Number(targetListing.livingArea).toLocaleString()} {copy.offerWorksheet.sqft}
                    </span>
                  )}
                  {targetListing.lotSizeArea && (
                    <span className="inline-flex items-center gap-1.5">
                      <Home className="h-4 w-4 text-stone-400" />
                      {Number(targetListing.lotSizeArea).toLocaleString()} {copy.offerWorksheet.sqft}{" "}
                      {copy.offerWorksheet.lot}
                    </span>
                  )}
                  {targetListing.yearBuilt && (
                    <span className="text-stone-400">
                      {copy.offerWorksheet.built(targetListing.yearBuilt)}
                    </span>
                  )}
                </div>

                {/* Public remarks (expandable) */}
                {targetListing.publicRemarks && (
                  <div className="mt-4">
                    <p
                      className={`text-sm leading-relaxed text-stone-600 ${
                        remarksExpanded ? "" : "line-clamp-3"
                      }`}
                    >
                      {targetListing.publicRemarks}
                    </p>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="mt-1 rounded-full text-stone-500 px-2 h-7 text-xs"
                      onClick={() => {
                        if (!remarksExpanded) {
                          trackEvent("remarks_expand", {
                            listingId: targetListing.listingKey,
                            source: "offer_worksheet_target",
                          });
                        }
                        setRemarksExpanded(!remarksExpanded);
                      }}
                    >
                      {remarksExpanded ? (
                        <>
                          <ChevronUp className="h-3.5 w-3.5 mr-1" />
                          {copy.offerWorksheet.showLess}
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-3.5 w-3.5 mr-1" />
                          {copy.offerWorksheet.readMore}
                        </>
                      )}
                    </Button>
                  </div>
                )}

                {/* Thumbnail strip */}
                {(targetListing.images?.length ?? 0) > 1 && (
                  <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                    {targetListing.images!.slice(1, 7).map((url, i) => (
                      <img
                        key={url}
                        src={url}
                        alt={`Photo ${i + 2}`}
                        className="h-16 w-20 shrink-0 rounded-lg border object-cover"
                        loading="lazy"
                      />
                    ))}
                    {targetListing.images!.length > 7 && (
                      <div className="flex h-16 w-20 shrink-0 items-center justify-center rounded-lg border bg-stone-100 text-xs text-stone-500">
                        +{targetListing.images!.length - 7}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </article>
          </section>
        )}

        {/* ─── Agent's Recommendation callout ───────── */}
        {(suggestedOfferLow || suggestedOfferHigh || agentRecommendation) && (
          <section className="mb-8">
            <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50/50 p-5 sm:p-6">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="h-5 w-5 text-emerald-600" />
                <h3 className="text-sm font-semibold uppercase tracking-wider text-emerald-700">
                  {copy.offerWorksheet.agentRecommendation}
                </h3>
              </div>

              {(suggestedOfferLow || suggestedOfferHigh) && (
                <p className="text-2xl sm:text-3xl font-bold text-emerald-800 mb-3">
                  {copy.offerWorksheet.suggestedOfferRange(
                    formatPrice(suggestedOfferLow) ?? "N/A",
                    formatPrice(suggestedOfferHigh) ?? "N/A"
                  )}
                </p>
              )}

              {agentRecommendation && (
                <p className="text-sm leading-relaxed text-emerald-900/80">
                  {agentRecommendation}
                </p>
              )}
            </div>
          </section>
        )}

        {/* ─── Comparable Properties ────────────────── */}
        {compListings.length > 0 && (
          <section className="mb-8">
            <h3 className="text-lg font-semibold text-stone-900 mb-4">
              {copy.offerWorksheet.marketComparables}
            </h3>

            {/* Mobile: cards */}
            <div className="space-y-4 lg:hidden">
              {compListings.map(
                ({ listing, whyComparable, soldPrice, soldDate, adjustmentNotes }) => {
                  const addr = buildAddress(listing);
                  const displayPrice = soldPrice
                    ? formatPrice(soldPrice)
                    : formatPrice(listing.listPrice);
                  const mainImage = listing.images?.[0] ?? null;

                  return (
                    <article
                      key={listing.listingKey}
                      className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm"
                    >
                      {mainImage && (
                        <div className="aspect-[16/9] w-full bg-stone-100 overflow-hidden">
                          <img
                            src={mainImage}
                            alt={addr}
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        </div>
                      )}

                      <div className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <h4 className="text-base font-semibold text-stone-900 leading-tight">
                            {addr}
                          </h4>
                          <div className="text-right shrink-0">
                            {displayPrice && (
                              <p className="text-lg font-bold text-stone-900">
                                {displayPrice}
                              </p>
                            )}
                            {soldPrice && (
                              <p className="text-xs text-emerald-600 font-medium">
                                {copy.offerWorksheet.sold}
                              </p>
                            )}
                          </div>
                        </div>

                        {soldDate && (
                          <p className="mt-1 flex items-center gap-1 text-xs text-stone-500">
                            <Calendar className="h-3 w-3" />
                            {copy.offerWorksheet.soldDate(soldDate)}
                          </p>
                        )}

                        <div className="mt-3 rounded-lg bg-stone-50 border border-stone-100 p-3">
                          <p className="text-xs font-medium text-stone-500 uppercase tracking-wider mb-1">
                            {copy.offerWorksheet.whyComparable}
                          </p>
                          <p className="text-sm text-stone-700 leading-relaxed">
                            {whyComparable}
                          </p>
                        </div>

                        {adjustmentNotes && (
                          <div className="mt-2 rounded-lg bg-amber-50 border border-amber-100 p-3">
                            <p className="text-xs font-medium text-amber-600 uppercase tracking-wider mb-1">
                              {copy.offerWorksheet.adjustmentNotes}
                            </p>
                            <p className="text-sm text-amber-800 leading-relaxed">
                              {adjustmentNotes}
                            </p>
                          </div>
                        )}
                      </div>
                    </article>
                  );
                },
              )}
            </div>

            {/* Desktop: comparison table */}
            <div className="hidden lg:block overflow-x-auto rounded-xl border border-stone-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-stone-50 border-b border-stone-200">
                    <th className="text-left px-4 py-3 font-semibold text-stone-600">
                      {copy.offerWorksheet.tableAddress}
                    </th>
                    <th className="text-right px-4 py-3 font-semibold text-stone-600">
                      {copy.offerWorksheet.tableListPrice}
                    </th>
                    <th className="text-right px-4 py-3 font-semibold text-stone-600">
                      {copy.offerWorksheet.tableSoldPrice}
                    </th>
                    <th className="text-right px-4 py-3 font-semibold text-stone-600">
                      {copy.offerWorksheet.tablePricePerSqft}
                    </th>
                    <th className="text-left px-4 py-3 font-semibold text-stone-600">
                      {copy.offerWorksheet.tableNotes}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {compListings.map(
                    (
                      {
                        listing,
                        whyComparable,
                        soldPrice,
                        soldDate,
                        adjustmentNotes,
                      },
                      idx,
                    ) => {
                      const addr = buildAddress(listing);
                      const priceSrc = soldPrice ?? listing.listPrice;
                      const ppsqft = computePricePerSqft(
                        priceSrc,
                        listing.livingArea,
                      );

                      return (
                        <tr
                          key={listing.listingKey}
                          className={
                            idx % 2 === 0 ? "bg-white" : "bg-stone-50/50"
                          }
                        >
                          <td className="px-4 py-3">
                            <p className="font-medium text-stone-900">
                              {addr}
                            </p>
                            {soldDate && (
                              <p className="text-xs text-stone-400 mt-0.5">
                                {copy.offerWorksheet.soldDate(soldDate)}
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right text-stone-700">
                            {formatFullCurrencyOrDash(listing.listPrice)}
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-emerald-700">
                            {soldPrice
                              ? formatFullCurrencyOrDash(soldPrice)
                              : "\u2014"}
                          </td>
                          <td className="px-4 py-3 text-right text-stone-600">
                            {ppsqft ? `$${ppsqft}` : "\u2014"}
                          </td>
                          <td className="px-4 py-3 text-stone-600 max-w-xs">
                            <p className="text-xs leading-relaxed">
                              {whyComparable}
                            </p>
                            {adjustmentNotes && (
                              <p className="text-xs text-amber-600 mt-1 italic">
                                {adjustmentNotes}
                              </p>
                            )}
                          </td>
                        </tr>
                      );
                    },
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* ─── Footer ──────────────────────────────── */}
        <footer className="mt-10 text-center">
          <p className="text-xs text-stone-400">
            {copy.offerWorksheet.sharedBy(agentName)}
            {brokerageName ? ` \u00b7 ${brokerageName}` : ""}
          </p>
        </footer>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────── */
/*  Table cell helper                                            */
/* ────────────────────────────────────────────────────────────── */

function formatFullCurrencyOrDash(
  value: string | number | null | undefined,
): string {
  const f = formatPriceFullCurrency(value);
  return f ?? "\u2014";
}
