"use client";

import { useMemo } from "react";
import {
  Bath,
  BedDouble,
  Calendar,
  CheckSquare,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Ruler,
  Square,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

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

type ListingFeedback = {
  agentNotes: string;
  tourOrder: number;
  highlights?: string;
  concerns?: string;
};

type TourRecapViewProps = {
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

function buildAddress(listing: MlsListing) {
  return (
    getString(listing.unparsedAddress) ||
    [getString(listing.city), getString(listing.stateOrProvince), getString(listing.postalCode)]
      .filter(Boolean)
      .join(", ") ||
    "Unknown address"
  );
}

function formatTourDate(iso: string): string {
  try {
    const date = new Date(iso);
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

/* ────────────────────────────────────────────────────────────── */
/*  Tour Recap View                                              */
/*  Post-showing summary with timeline layout                    */
/* ────────────────────────────────────────────────────────────── */

export default function TourRecapView({
  token,
  session,
  agentBranding,
  shareConfig,
  listings,
  trackEvent,
}: TourRecapViewProps) {
  const agentName = getString(agentBranding.agentName) || "Agent";
  const agentTitle = getString(agentBranding.agentTitle);
  const brokerageName = getString(agentBranding.brokerageName);
  const phone = getString(agentBranding.phone);
  const email = getString(agentBranding.email);
  const avatarUrl = getString(agentBranding.avatarUrl);

  const tourDate = getString(shareConfig.tourDate);
  const overallSummary = getString(shareConfig.overallSummary);
  const nextSteps = Array.isArray(shareConfig.nextSteps)
    ? (shareConfig.nextSteps as string[])
    : [];
  const listingFeedback = (shareConfig.listingFeedback ?? {}) as Record<
    string,
    ListingFeedback
  >;

  /* Sort listings by tourOrder when feedback exists, else keep array order */
  const sortedListings = useMemo(() => {
    const hasFeedback = Object.keys(listingFeedback).length > 0;
    if (!hasFeedback) return listings;

    return [...listings].sort((a, b) => {
      const fa = listingFeedback[a.listingKey];
      const fb = listingFeedback[b.listingKey];
      const orderA = fa?.tourOrder ?? Number.MAX_SAFE_INTEGER;
      const orderB = fb?.tourOrder ?? Number.MAX_SAFE_INTEGER;
      return orderA - orderB;
    });
  }, [listings, listingFeedback]);

  const handleCall = () => {
    if (!phone) return;
    trackEvent("contact_click", { channel: "phone", source: "tour_recap_bar" });
    window.location.href = "tel:" + phone;
  };

  const handleEmail = () => {
    if (!email) return;
    trackEvent("contact_click", { channel: "email", source: "tour_recap_bar" });
    const subject = encodeURIComponent(session.title || "Tour Recap");
    window.location.href = "mailto:" + email + "?subject=" + subject;
  };

  return (
    <div className="min-h-[100dvh] bg-white text-stone-900">
      {/* ─── Sticky bottom contact bar (mobile) ───── */}
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
        {/* ─── Hero header ─────────────────────────── */}
        <header className="mb-10">
          <div className="flex items-center gap-3 mb-6">
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
            </div>
          </div>

          {session.clientName && (
            <p className="text-xs text-stone-400 uppercase tracking-wider mb-2">
              Prepared for {session.clientName}
            </p>
          )}

          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Tour Recap
          </h1>

          {tourDate && (
            <div className="mt-2 flex items-center gap-1.5 text-sm text-stone-500">
              <Calendar className="h-4 w-4" />
              {formatTourDate(tourDate)}
            </div>
          )}

          {session.introMessage && (
            <div className="mt-4 rounded-xl bg-stone-50 border border-stone-100 px-4 py-3">
              <p className="text-sm text-stone-600 leading-relaxed italic">
                &ldquo;{session.introMessage}&rdquo;
              </p>
              <p className="text-xs text-stone-400 mt-1.5">&mdash; {agentName}</p>
            </div>
          )}

          <p className="mt-3 text-sm text-stone-500">
            {sortedListings.length}{" "}
            {sortedListings.length === 1 ? "property visited" : "properties visited"}
          </p>
        </header>

        {/* ─── Timeline ────────────────────────────── */}
        <div className="relative">
          {sortedListings.map((listing, index) => {
            const address = buildAddress(listing);
            const price = formatPrice(listing.listPrice);
            const images = listing.images ?? [];
            const mainImage = images[0] ?? null;
            const feedback = listingFeedback[listing.listingKey];
            const stepNumber = index + 1;
            const isLast = index === sortedListings.length - 1;

            return (
              <div key={listing.listingKey} className="flex gap-4 sm:gap-6">
                {/* ─ Left: numbered circle + vertical line ─ */}
                <div className="flex flex-col items-center shrink-0">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-stone-900 text-white text-sm font-semibold">
                    {stepNumber}
                  </div>
                  {!isLast && (
                    <div className="w-px flex-1 bg-stone-200 my-2" />
                  )}
                </div>

                {/* ─ Right: listing card ──────────────── */}
                <div className={`flex-1 min-w-0 ${isLast ? "pb-0" : "pb-8"}`}>
                  <article className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
                    {/* Hero image */}
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
                      </div>

                      {/* ─ Agent feedback section ────── */}
                      {feedback && (
                        <div className="mt-4 space-y-3">
                          {feedback.highlights && (
                            <div className="rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2.5">
                              <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wider mb-1">
                                Highlights
                              </p>
                              <p className="text-sm text-emerald-800 leading-relaxed">
                                {feedback.highlights}
                              </p>
                            </div>
                          )}

                          {feedback.concerns && (
                            <div className="rounded-lg bg-amber-50 border border-amber-100 px-3 py-2.5">
                              <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider mb-1">
                                Concerns
                              </p>
                              <p className="text-sm text-amber-800 leading-relaxed">
                                {feedback.concerns}
                              </p>
                            </div>
                          )}

                          {feedback.agentNotes && (
                            <p className="text-sm text-stone-500 italic leading-relaxed pl-1">
                              &ldquo;{feedback.agentNotes}&rdquo;
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </article>
                </div>
              </div>
            );
          })}
        </div>

        {/* ─── Summary section ─────────────────────── */}
        {(overallSummary || nextSteps.length > 0) && (
          <section className="mt-10 rounded-2xl border border-stone-200 bg-stone-50 p-5 sm:p-6">
            {overallSummary && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-stone-900 mb-2">
                  Summary
                </h3>
                <p className="text-sm text-stone-600 leading-relaxed">
                  {overallSummary}
                </p>
              </div>
            )}

            {nextSteps.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-stone-900 mb-3">
                  Next Steps
                </h3>
                <ul className="space-y-2">
                  {nextSteps.map((step, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm text-stone-600">
                      <Square className="h-4 w-4 mt-0.5 shrink-0 text-stone-400" />
                      <span className="leading-relaxed">{step}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}

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
