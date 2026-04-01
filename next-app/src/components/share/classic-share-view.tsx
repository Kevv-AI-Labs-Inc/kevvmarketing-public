"use client";

import { useMemo, useState } from "react";
import {
  Bath,
  BedDouble,
  ChevronDown,
  ChevronUp,
  Copy,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Ruler,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useT } from "@/i18n";
import { localeTag } from "@/i18n/copy";
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
/*  Classic Share View                                           */
/*  Clean, light, data-focused — "just the facts" for buyers     */
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

  const agentName = getString(agentBranding.agentName) || "Agent";
  const agentTitle = getString(agentBranding.agentTitle);
  const brokerageName = getString(agentBranding.brokerageName);
  const phone = getString(agentBranding.phone);
  const email = getString(agentBranding.email);
  const wechatId = getString(agentBranding.wechatId);
  const avatarUrl = getString(agentBranding.avatarUrl);
  const agentNote = getString(shareConfig.agentNote);

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
            <Button size="sm" onClick={handleCall} className="rounded-full h-9 px-4">
              <Phone className="h-3.5 w-3.5 mr-1.5" />
              Call
            </Button>
          )}
          {email && (
            <Button size="sm" variant="outline" onClick={handleEmail} className="rounded-full h-9 px-4">
              <Mail className="h-3.5 w-3.5 mr-1.5" />
              Email
            </Button>
          )}
        </div>
      </div>

      {/* ─── Main content ──────────────────────────── */}
      <div className="mx-auto max-w-3xl px-4 py-6 pb-24 sm:pb-8 md:px-6">
        {/* Header — minimal */}
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
                <Button size="sm" variant="outline" onClick={handleCall} className="rounded-full">
                  <Phone className="h-3.5 w-3.5 mr-1.5" />
                  {phone}
                </Button>
              )}
              {email && (
                <Button size="sm" variant="outline" onClick={handleEmail} className="rounded-full">
                  <Mail className="h-3.5 w-3.5 mr-1.5" />
                  Email
                </Button>
              )}
              {wechatId && (
                <Button size="sm" variant="outline" onClick={handleCopyWechat} className="rounded-full">
                  <MessageCircle className="h-3.5 w-3.5 mr-1.5" />
                  WeChat
                </Button>
              )}
            </div>
          </div>

          {session.clientName && (
            <p className="text-xs text-stone-400 uppercase tracking-wider mb-2">
              Prepared for {session.clientName}
            </p>
          )}

          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {session.title}
          </h1>

          {agentNote && (
            <div className="mt-4 rounded-xl bg-stone-50 border border-stone-100 px-4 py-3">
              <p className="text-sm text-stone-600 leading-relaxed italic">
                "{agentNote}"
              </p>
              <p className="text-xs text-stone-400 mt-1.5">— {agentName}</p>
            </div>
          )}

          <p className="mt-3 text-sm text-stone-500">
            {listings.length} {listings.length === 1 ? "listing" : "listings"}
          </p>
        </header>

        {/* ─── Listings ──────────────────────────────── */}
        <div className="space-y-4">
          {listings.map((listing, index) => {
            const address = buildAddress(listing);
            const price = formatPrice(listing.listPrice);
            const ppsqft = formatPricePerSqft(listing.listPrice, listing.livingArea);
            const images = listing.images ?? [];
            const mainImage = images[0] ?? null;
            const expanded = expandedId === listing.listingKey;

            return (
              <article
                key={listing.listingKey}
                className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm"
              >
                {/* Image */}
                {mainImage && (
                  <div className="aspect-[16/9] w-full bg-stone-100 overflow-hidden">
                    <img
                      src={mainImage}
                      alt={address}
                      className="h-full w-full object-cover"
                      loading={index < 3 ? "eager" : "lazy"}
                    />
                  </div>
                )}

                <div className="p-4 sm:p-5">
                  {/* Address + Price */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="text-lg font-semibold text-stone-900 leading-tight">
                        {address}
                      </h2>
                      {listing.city && (
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-stone-500">
                          <MapPin className="h-3 w-3" />
                          {[listing.city, listing.stateOrProvince, listing.postalCode]
                            .filter(Boolean)
                            .join(", ")}
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      {price && (
                        <p className="text-xl font-bold text-stone-900">
                          {price}
                        </p>
                      )}
                      {ppsqft && (
                        <p className="text-xs text-stone-500">{ppsqft}</p>
                      )}
                    </div>
                  </div>

                  {/* Key metrics */}
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-stone-600">
                    {listing.bedroomsTotal != null && (
                      <span className="inline-flex items-center gap-1.5">
                        <BedDouble className="h-4 w-4 text-stone-400" />
                        {listing.bedroomsTotal} Beds
                      </span>
                    )}
                    {listing.bathroomsTotalInteger != null && (
                      <span className="inline-flex items-center gap-1.5">
                        <Bath className="h-4 w-4 text-stone-400" />
                        {listing.bathroomsTotalInteger} Baths
                      </span>
                    )}
                    {listing.livingArea && (
                      <span className="inline-flex items-center gap-1.5">
                        <Ruler className="h-4 w-4 text-stone-400" />
                        {Number(listing.livingArea).toLocaleString()} sqft
                      </span>
                    )}
                    {listing.propertyType && (
                      <span className="text-stone-400">
                        {listing.propertyType}
                      </span>
                    )}
                    {listing.yearBuilt && (
                      <span className="text-stone-400">
                        Built {listing.yearBuilt}
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="mt-4 flex items-center gap-2">
                    <Button
                      size="sm"
                      className="rounded-full"
                      onClick={() => handleInterested(listing)}
                    >
                      {copy.interestedHome}
                    </Button>
                    {listing.publicRemarks && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="rounded-full text-stone-500"
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
                  </div>

                  {/* Expanded details */}
                  {expanded && listing.publicRemarks && (
                    <div className="mt-4 rounded-xl bg-stone-50 border border-stone-100 p-4">
                      <p className="text-sm leading-relaxed text-stone-600">
                        {listing.publicRemarks}
                      </p>

                      {/* Thumbnail strip */}
                      {images.length > 1 && (
                        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                          {images.slice(1, 7).map((url, i) => (
                            <img
                              key={url}
                              src={url}
                              alt={`Photo ${i + 2}`}
                              className="h-16 w-20 shrink-0 rounded-lg border object-cover"
                              loading="lazy"
                            />
                          ))}
                          {images.length > 7 && (
                            <div className="flex h-16 w-20 shrink-0 items-center justify-center rounded-lg border bg-stone-100 text-xs text-stone-500">
                              +{images.length - 7}
                            </div>
                          )}
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
        <footer className="mt-10 text-center">
          <p className="text-xs text-stone-400">
            Shared by {agentName}
            {brokerageName ? ` · ${brokerageName}` : ""}
          </p>
        </footer>
      </div>
    </div>
  );
}
