"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Heart,
  Home,
  ImageOff,
  Mail,
  MessageCircle,
  Phone,
  X,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useT } from "@/i18n";
import { getSharePageCopy } from "@/i18n/share-pages";
import { toast } from "sonner";

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

type AgentBranding = Record<string, unknown>;

type ClassicShareProps = {
  token: string;
  session: {
    title: string | null;
    introMessage?: string | null;
    clientName?: string | null;
    viewCount: number;
    createdAt: string | null;
  };
  agentBranding: AgentBranding;
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

function formatPrice(price: string | null | undefined) {
  if (!price) return null;
  const parsed = Number(price);
  if (!Number.isFinite(parsed)) return price;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(parsed);
}

function formatPricePerSqft(price: string | null | undefined, sqft: string | null | undefined) {
  if (!price || !sqft) return null;
  const p = Number(price);
  const s = Number(sqft);
  if (!Number.isFinite(p) || !Number.isFinite(s) || s === 0) return null;
  return `$${Math.round(p / s)}/sqft`;
}

function buildAddress(listing: MlsListing) {
  return (
    getString(listing.unparsedAddress) ||
    [getString(listing.city), getString(listing.stateOrProvince), getString(listing.postalCode)]
      .filter(Boolean)
      .join(", ") ||
    "Unknown address"
  );
}

/* ────────────────────────────────────────────────────────────── */
/*  Lightbox Component                                           */
/* ────────────────────────────────────────────────────────────── */

function Lightbox({
  images,
  index,
  onClose,
  onChange,
}: {
  images: string[];
  index: number;
  onClose: () => void;
  onChange: (index: number) => void;
}) {
  const handlePrev = useCallback(() => {
    onChange(index <= 0 ? images.length - 1 : index - 1);
  }, [index, images.length, onChange]);

  const handleNext = useCallback(() => {
    onChange(index >= images.length - 1 ? 0 : index + 1);
  }, [index, images.length, onChange]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") handlePrev();
      if (e.key === "ArrowRight") handleNext();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, handlePrev, handleNext]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Close */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 transition-colors"
        aria-label="Close"
      >
        <X className="h-6 w-6" />
      </button>

      {/* Counter */}
      <div className="absolute top-5 left-1/2 -translate-x-1/2 text-sm text-white/80 font-medium">
        {index + 1} / {images.length}
      </div>

      {/* Prev */}
      {images.length > 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); handlePrev(); }}
          className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 transition-colors"
          aria-label="Previous image"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
      )}

      {/* Image */}
      <img
        src={images[index]}
        alt={`Photo ${index + 1}`}
        className="max-h-[85vh] max-w-[90vw] rounded-lg object-contain"
        onClick={(e) => e.stopPropagation()}
      />

      {/* Next */}
      {images.length > 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); handleNext(); }}
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 transition-colors"
          aria-label="Next image"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────── */
/*  Classic Share View                                           */
/*  Magazine-quality, editorial feel — refined for buyers        */
/* ────────────────────────────────────────────────────────────── */

export default function ClassicShareView({
  token,
  session,
  agentBranding,
  shareConfig,
  listings,
  trackEvent,
}: ClassicShareProps) {
  const { locale } = useT();
  const copy = getSharePageCopy(locale).listingShare;
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{ images: string[]; index: number } | null>(null);

  const agentName = getString(agentBranding.agentName) || "Agent";
  const agentTitle = getString(agentBranding.agentTitle);
  const brokerageName = getString(agentBranding.brokerageName);
  const phone = getString(agentBranding.phone);
  const email = getString(agentBranding.email);
  const wechatId = getString(agentBranding.wechatId);
  const avatarUrl = getString(agentBranding.avatarUrl);
  const agentNote = getString(shareConfig.agentNote);

  /* Price range summary */
  const priceSummary = useMemo(() => {
    const prices = listings
      .map((l) => Number(l.listPrice))
      .filter((p) => Number.isFinite(p) && p > 0);
    if (prices.length === 0) return null;
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const fmt = (n: number) =>
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      }).format(n);
    if (min === max) return fmt(min);
    return `${fmt(min)} \u2013 ${fmt(max)}`;
  }, [listings]);

  const handleCall = () => {
    if (!phone) return;
    trackEvent("contact_click", { channel: "phone", source: "classic_bar" });
    window.location.href = "tel:" + phone;
  };

  const handleEmail = () => {
    if (!email) return;
    trackEvent("contact_click", { channel: "email", source: "classic_bar" });
    const subject = encodeURIComponent(session.title || "");
    window.location.href = "mailto:" + email + "?subject=" + subject;
  };

  const handleCopyWechat = async () => {
    if (!wechatId) return;
    try {
      await navigator.clipboard.writeText(wechatId);
      trackEvent("wechat_copy", { source: "classic_bar" });
      toast.success(copy.wechatCopied);
    } catch {
      toast.error(copy.copyFailed);
    }
  };

  const handleInterested = (listing: MlsListing) => {
    trackEvent("tour_interest", {
      source: "classic_listing",
      listingId: listing.listingKey,
    });
    toast.success(copy.interestLogged);
  };

  const openLightbox = (images: string[], index: number) => {
    setLightbox({ images, index });
  };

  /** Replace broken image with placeholder */
  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    img.style.display = "none";
    const fallback = img.parentElement?.querySelector("[data-img-fallback]");
    if (fallback instanceof HTMLElement) fallback.style.display = "flex";
  };

  return (
    <div className="min-h-[100dvh] bg-white text-gray-900">
      {/* Lightbox overlay */}
      {lightbox && (
        <Lightbox
          images={lightbox.images}
          index={lightbox.index}
          onClose={() => setLightbox(null)}
          onChange={(i) => setLightbox({ images: lightbox.images, index: i })}
        />
      )}

      {/* ─── Sticky bottom CTA bar (mobile) ─────── */}
      <div className="fixed bottom-0 inset-x-0 z-50 bg-white/95 backdrop-blur-sm px-4 py-3 flex items-center justify-between gap-3 sm:hidden shadow-[0_-4px_12px_rgba(0,0,0,0.06)]">
        <div className="flex items-center gap-2.5 min-w-0">
          <Avatar className="h-8 w-8 shrink-0">
            {avatarUrl && <AvatarImage src={avatarUrl} alt={agentName} />}
            <AvatarFallback className="text-xs bg-gray-100">
              {agentName.slice(0, 1).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <p className="truncate text-sm font-medium text-gray-900">{agentName}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {phone && (
            <Button
              size="sm"
              onClick={handleCall}
              className="rounded-full h-9 px-4 bg-[#0d9488] hover:bg-[#0f766e] text-white"
            >
              <Phone className="h-3.5 w-3.5 mr-1.5" />
              Call
            </Button>
          )}
          {email && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleEmail}
              className="rounded-full h-9 px-4 border-gray-200 text-gray-700 hover:bg-gray-50"
            >
              <Mail className="h-3.5 w-3.5 mr-1.5" />
              Email
            </Button>
          )}
        </div>
      </div>

      {/* ─── Main content ──────────────────────────── */}
      <div className="mx-auto max-w-4xl px-4 py-8 pb-28 sm:pb-10 md:px-8">
        {/* ─── Header ──────────────────────────────── */}
        <header className="mb-10">
          {/* Agent bar */}
          <div className="flex items-center gap-3.5 pb-6 mb-6 border-b border-gray-100">
            <Avatar className="h-11 w-11 border border-gray-200 shadow-sm">
              {avatarUrl && <AvatarImage src={avatarUrl} alt={agentName} />}
              <AvatarFallback className="bg-gray-50 text-sm font-medium">
                {agentName.slice(0, 1).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900">{agentName}</p>
              <p className="text-xs text-gray-500">
                {[agentTitle, brokerageName].filter(Boolean).join(" \u00b7 ")}
              </p>
            </div>

            {/* Desktop contact buttons */}
            <div className="hidden sm:flex items-center gap-2 ml-auto">
              {phone && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCall}
                  className="rounded-full border-gray-200 text-gray-700 hover:bg-gray-50"
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
                  className="rounded-full border-gray-200 text-gray-700 hover:bg-gray-50"
                >
                  <Mail className="h-3.5 w-3.5 mr-1.5" />
                  Email
                </Button>
              )}
              {wechatId && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCopyWechat}
                  className="rounded-full border-gray-200 text-gray-700 hover:bg-gray-50"
                >
                  <MessageCircle className="h-3.5 w-3.5 mr-1.5" />
                  WeChat
                </Button>
              )}
            </div>
          </div>

          {/* Prepared for */}
          {session.clientName && (
            <p className="text-[11px] text-gray-400 uppercase tracking-[0.15em] font-medium mb-3">
              Prepared for {session.clientName}
            </p>
          )}

          {/* Title */}
          <h1 className="text-3xl font-semibold tracking-tight text-gray-900 sm:text-4xl">
            {session.title}
          </h1>

          {/* Agent note — quote block */}
          {agentNote && (
            <div className="mt-5 pl-4 border-l-2 border-[#0d9488]/40">
              <p className="text-sm text-gray-600 leading-relaxed italic">
                &ldquo;{agentNote}&rdquo;
              </p>
              <p className="text-xs text-gray-400 mt-1.5">&mdash; {agentName}</p>
            </div>
          )}

          {/* Summary line */}
          <p className="mt-4 text-sm text-gray-500">
            {listings.length} {listings.length === 1 ? "listing" : "listings"}
            {priceSummary && <span className="ml-1">&middot; {priceSummary}</span>}
          </p>
        </header>

        {/* ─── Empty State ─────────────────────────────── */}
        {listings.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
              <Home className="h-8 w-8 text-gray-400" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">{copy.emptyStateTitle}</h2>
            <p className="mt-2 max-w-sm text-sm text-gray-500">{copy.emptyStateDescription}</p>
            {(phone || email) && (
              <Button
                className="mt-6 rounded-full bg-[#0d9488] hover:bg-[#0f766e] text-white px-6"
                onClick={() => phone ? handleCall() : handleEmail()}
              >
                {copy.contactAgent}
              </Button>
            )}
          </div>
        )}

        {/* ─── Listings ──────────────────────────────── */}
        <div className="space-y-6">
          {listings.map((listing, index) => {
            const address = buildAddress(listing);
            const price = formatPrice(listing.listPrice);
            const ppsqft = formatPricePerSqft(listing.listPrice, listing.livingArea);
            const images = listing.images ?? [];
            const expanded = expandedId === listing.listingKey;

            /* Build compact metrics string */
            const metrics: string[] = [];
            if (listing.bedroomsTotal != null) metrics.push(`${listing.bedroomsTotal} bd`);
            if (listing.bathroomsTotalInteger != null) metrics.push(`${listing.bathroomsTotalInteger} ba`);
            if (listing.livingArea) metrics.push(`${Number(listing.livingArea).toLocaleString()} sqft`);
            if (ppsqft) metrics.push(ppsqft);

            /* Secondary info */
            const secondaryParts: string[] = [];
            if (listing.yearBuilt) secondaryParts.push(`Built ${listing.yearBuilt}`);
            if (listing.propertyType) secondaryParts.push(listing.propertyType);

            return (
              <article
                key={listing.listingKey}
                className="overflow-hidden rounded-2xl bg-white border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
              >
                {/* Image carousel or hero */}
                {images.length === 1 && (
                  <div className="relative aspect-[16/9] w-full bg-gray-100 overflow-hidden">
                    {listing.standardStatus && (
                      <span className="absolute top-3 right-3 z-10 rounded-full bg-white/90 backdrop-blur-sm px-3 py-1 text-xs font-medium text-gray-700 shadow-sm">
                        {listing.standardStatus}
                      </span>
                    )}
                    <img
                      src={images[0]}
                      alt={address}
                      className="h-full w-full object-cover cursor-pointer hover:scale-[1.02] transition-transform duration-300"
                      loading={index < 3 ? "eager" : "lazy"}
                      onClick={() => openLightbox(images, 0)}
                      onError={handleImageError}
                    />
                    <div data-img-fallback className="hidden absolute inset-0 items-center justify-center bg-gray-100 flex-col gap-2">
                      <ImageOff className="h-8 w-8 text-gray-300" />
                      <p className="text-xs text-gray-400">{copy.imageLoadFailed}</p>
                      <p className="text-xs text-gray-500 font-medium">{address}</p>
                    </div>
                  </div>
                )}

                {images.length > 1 && (
                  <div className="relative">
                    {listing.standardStatus && (
                      <span className="absolute top-3 right-3 z-10 rounded-full bg-white/90 backdrop-blur-sm px-3 py-1 text-xs font-medium text-gray-700 shadow-sm">
                        {listing.standardStatus}
                      </span>
                    )}
                    <div className="flex gap-2 overflow-x-auto snap-x snap-mandatory scrollbar-hide pb-2 px-2 pt-2">
                      {images.map((url, i) => (
                        <div
                          key={url}
                          className="snap-start shrink-0 first:rounded-l-xl last:rounded-r-xl overflow-hidden relative"
                        >
                          <img
                            src={url}
                            alt={`${address} photo ${i + 1}`}
                            className="h-48 w-72 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                            loading={index < 3 && i < 3 ? "eager" : "lazy"}
                            onClick={() => openLightbox(images, i)}
                            onError={handleImageError}
                          />
                          <div data-img-fallback className="hidden h-48 w-72 items-center justify-center bg-gray-100 flex-col gap-1">
                            <ImageOff className="h-6 w-6 text-gray-300" />
                            <p className="text-[10px] text-gray-400">{copy.imageLoadFailed}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {images.length === 0 && (
                  <div className="aspect-[16/9] w-full bg-gray-50 flex items-center justify-center flex-col gap-2">
                    <Home className="h-8 w-8 text-gray-300" />
                    <p className="text-xs text-gray-400">{address}</p>
                    {listing.standardStatus && (
                      <span className="inline-block rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
                        {listing.standardStatus}
                      </span>
                    )}
                  </div>
                )}

                <div className="p-5 sm:p-6">
                  {/* Price */}
                  {price && (
                    <p className="text-2xl font-bold text-gray-900 mb-1">{price}</p>
                  )}

                  {/* Address */}
                  <h2 className="text-lg text-gray-900 leading-tight">{address}</h2>

                  {/* Compact metrics */}
                  {metrics.length > 0 && (
                    <p className="mt-2 text-sm text-gray-600">
                      {metrics.join(" \u00b7 ")}
                    </p>
                  )}

                  {/* Secondary info */}
                  {secondaryParts.length > 0 && (
                    <p className="mt-1 text-xs text-gray-500">
                      {secondaryParts.join(" \u00b7 ")}
                    </p>
                  )}

                  {/* Action row */}
                  <div className="mt-4 flex items-center gap-2">
                    {/* Primary: Schedule Showing */}
                    <Button
                      size="sm"
                      className="rounded-full bg-[#0d9488] hover:bg-[#0f766e] text-white px-5"
                      onClick={() => handleInterested(listing)}
                    >
                      {copy.interestedHome}
                    </Button>

                    {/* Secondary: Details toggle */}
                    {(listing.publicRemarks || images.length > 1) && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="rounded-full text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                        onClick={() => {
                          if (!expanded) {
                            trackEvent("listing_open", {
                              listingId: listing.listingKey,
                              source: "classic_details",
                            });
                          }
                          setExpandedId(expanded ? null : listing.listingKey);
                        }}
                      >
                        {expanded ? (
                          <ChevronUp className="h-4 w-4 mr-1" />
                        ) : (
                          <ChevronDown className="h-4 w-4 mr-1" />
                        )}
                        {expanded ? copy.hideDetails : copy.showDetails}
                      </Button>
                    )}

                    {/* Save / heart icon */}
                    <button
                      onClick={() => handleInterested(listing)}
                      className="ml-auto rounded-full p-2 text-gray-400 hover:text-[#0d9488] hover:bg-[#0d9488]/5 transition-colors"
                      aria-label="Save listing"
                    >
                      <Heart className="h-5 w-5" />
                    </button>
                  </div>

                  {/* Expanded section */}
                  {expanded && (
                    <div className="mt-5 pt-5 border-t border-gray-100">
                      {listing.publicRemarks && (
                        <p className="text-sm leading-relaxed text-gray-600 mb-4">
                          {listing.publicRemarks}
                        </p>
                      )}

                      {/* Full thumbnail strip */}
                      {images.length > 1 && (
                        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
                          {images.map((url, i) => (
                            <img
                              key={url}
                              src={url}
                              alt={`Photo ${i + 1}`}
                              className="h-20 w-28 shrink-0 rounded-lg border border-gray-100 object-cover cursor-pointer hover:opacity-80 transition-opacity"
                              loading="lazy"
                              onClick={() => openLightbox(images, i)}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>

        {/* ─── Footer ──────────────────────────────── */}
        <footer className="mt-12 pt-6 border-t border-gray-100 text-center space-y-1.5">
          <p className="text-xs text-gray-400">
            Shared by {agentName}
            {brokerageName ? ` \u00b7 ${brokerageName}` : ""}
          </p>
          <p className="text-[10px] text-gray-300 tracking-wide">
            Powered by Kevv
          </p>
        </footer>
      </div>
    </div>
  );
}
