"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bath,
  BedDouble,
  ChevronDown,
  ChevronUp,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Ruler,
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

type BuyerBoardViewProps = {
  token: string;
  session: {
    title: string | null;
    clientName?: string | null;
    introMessage?: string | null;
  };
  agentBranding: Record<string, unknown>;
  shareConfig: Record<string, unknown>;
  listings: MlsListing[];
  trackEvent: (eventType: string, eventData?: Record<string, unknown>) => void;
  onReaction?: (listingKey: string, reaction: Reaction | null) => void;
};

type Reaction = "favorite" | "interested" | "pass";

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

function getStorageKey(token: string) {
  return `buyer-board-reactions-${token}`;
}

function loadReactions(token: string): Record<string, Reaction> {
  try {
    const raw = localStorage.getItem(getStorageKey(token));
    if (raw) return JSON.parse(raw) as Record<string, Reaction>;
  } catch {
    /* ignore */
  }
  return {};
}

function saveReactions(token: string, reactions: Record<string, Reaction>) {
  try {
    localStorage.setItem(getStorageKey(token), JSON.stringify(reactions));
  } catch {
    /* ignore */
  }
}

/* ────────────────────────────────────────────────────────────── */
/*  Reaction button config                                       */
/* ────────────────────────────────────────────────────────────── */

const REACTION_CONFIG: {
  key: Reaction;
  emoji: string;
  label: string;
  labelZh: string;
  activeBg: string;
  activeText: string;
  activeBorder: string;
}[] = [
  {
    key: "favorite",
    emoji: "\u2764\uFE0F",
    label: "Favorite",
    labelZh: "\u559C\u6B22",
    activeBg: "bg-emerald-50",
    activeText: "text-emerald-700",
    activeBorder: "border-emerald-400",
  },
  {
    key: "interested",
    emoji: "\uD83E\uDD14",
    label: "Interested",
    labelZh: "\u611F\u5174\u8DA3",
    activeBg: "bg-amber-50",
    activeText: "text-amber-700",
    activeBorder: "border-amber-400",
  },
  {
    key: "pass",
    emoji: "\uD83D\uDC4E",
    label: "Pass",
    labelZh: "\u8DF3\u8FC7",
    activeBg: "bg-red-50",
    activeText: "text-red-400",
    activeBorder: "border-red-300",
  },
];

const CARD_BORDER_MAP: Record<Reaction, string> = {
  favorite: "border-emerald-400",
  interested: "border-amber-400",
  pass: "border-red-300",
};

/* ────────────────────────────────────────────────────────────── */
/*  Buyer Board View                                             */
/*  Collaborative listing board — buyer marks favorites/pass     */
/* ────────────────────────────────────────────────────────────── */

export default function BuyerBoardView({
  token,
  session,
  agentBranding,
  shareConfig,
  listings,
  trackEvent,
  onReaction,
}: BuyerBoardViewProps) {
  const { locale } = useT();
  const shareCopy = getSharePageCopy(locale);
  const copy = shareCopy.listingShare;
  const boardCopy = shareCopy.buyerBoard;

  const agentName = getString(agentBranding.agentName) || "Agent";
  const agentTitle = getString(agentBranding.agentTitle);
  const brokerageName = getString(agentBranding.brokerageName);
  const phone = getString(agentBranding.phone);
  const email = getString(agentBranding.email);
  const wechatId = getString(agentBranding.wechatId);
  const avatarUrl = getString(agentBranding.avatarUrl);
  const boardDescription = getString(shareConfig.boardDescription);

  const listingNotes = useMemo(() => {
    const raw = shareConfig.listingNotes;
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      return raw as Record<string, string>;
    }
    return {} as Record<string, string>;
  }, [shareConfig.listingNotes]);

  /* ── Reactions state (localStorage-backed) ── */
  const [reactions, setReactions] = useState<Record<string, Reaction>>({});

  useEffect(() => {
    setReactions(loadReactions(token));
  }, [token]);

  const toggleReaction = useCallback(
    (listingKey: string, reaction: Reaction) => {
      let newReaction: Reaction | null = null;
      setReactions((prev) => {
        const next = { ...prev };
        if (next[listingKey] === reaction) {
          delete next[listingKey];
          newReaction = null;
        } else {
          next[listingKey] = reaction;
          newReaction = reaction;
        }
        saveReactions(token, next);
        return next;
      });
      trackEvent("listing_reaction", { listingKey, reaction });
      onReaction?.(listingKey, newReaction);
    },
    [token, trackEvent, onReaction],
  );

  /* ── Expanded details ── */
  const [expandedId, setExpandedId] = useState<string | null>(null);

  /* ── Contact handlers ── */
  const handleCall = () => {
    if (!phone) return;
    trackEvent("contact_click", { channel: "phone", source: "buyer_board_bar" });
    window.location.href = "tel:" + phone;
  };

  const handleEmail = () => {
    if (!email) return;
    trackEvent("contact_click", { channel: "email", source: "buyer_board_bar" });
    const subject = encodeURIComponent(session.title || "");
    window.location.href = "mailto:" + email + "?subject=" + subject;
  };

  const handleCopyWechat = async () => {
    if (!wechatId) return;
    try {
      await navigator.clipboard.writeText(wechatId);
      trackEvent("wechat_copy", { source: "buyer_board_bar" });
      toast.success(copy.wechatCopied);
    } catch {
      toast.error(copy.copyFailed);
    }
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
              {boardCopy.call}
            </Button>
          )}
          {email && (
            <Button size="sm" variant="outline" onClick={handleEmail} className="rounded-full h-9 px-4">
              <Mail className="h-3.5 w-3.5 mr-1.5" />
              {boardCopy.email}
            </Button>
          )}
        </div>
      </div>

      {/* ─── Main content ──────────────────────────── */}
      <div className="mx-auto max-w-5xl px-4 py-6 pb-24 sm:pb-8 md:px-6">
        {/* ─── Hero section ──────────────────────────── */}
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
                  {boardCopy.email}
                </Button>
              )}
              {wechatId && (
                <Button size="sm" variant="outline" onClick={handleCopyWechat} className="rounded-full">
                  <MessageCircle className="h-3.5 w-3.5 mr-1.5" />
                  {boardCopy.wechat}
                </Button>
              )}
            </div>
          </div>

          {session.clientName && (
            <p className="text-xs text-stone-400 uppercase tracking-wider mb-2">
              {boardCopy.preparedFor(session.clientName || "")}
            </p>
          )}

          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {session.title || boardCopy.defaultTitle}
          </h1>

          {boardDescription && (
            <p className="mt-2 text-sm text-stone-500 leading-relaxed">
              {boardDescription}
            </p>
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
            {listings.length} {listings.length === 1 ? boardCopy.listing : boardCopy.listings}
          </p>
        </header>

        {/* ─── Listing grid ─────────────────────────── */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {listings.map((listing, index) => {
            const address = buildAddress(listing);
            const price = formatPrice(listing.listPrice);
            const images = listing.images ?? [];
            const mainImage = images[0] ?? null;
            const expanded = expandedId === listing.listingKey;
            const currentReaction = reactions[listing.listingKey] ?? null;
            const note = getString(listingNotes[listing.listingKey]);

            return (
              <article
                key={listing.listingKey}
                className={`overflow-hidden rounded-2xl border bg-white shadow-sm transition-colors ${
                  currentReaction
                    ? CARD_BORDER_MAP[currentReaction]
                    : "border-stone-200"
                }`}
              >
                {/* Hero image */}
                {mainImage ? (
                  <div className="aspect-[16/9] w-full bg-stone-100 overflow-hidden">
                    <img
                      src={mainImage}
                      alt={address}
                      className="h-full w-full object-cover"
                      loading={index < 3 ? "eager" : "lazy"}
                    />
                  </div>
                ) : (
                  <div className="aspect-[16/9] w-full bg-stone-100 flex items-center justify-center">
                    <MapPin className="h-8 w-8 text-stone-300" />
                  </div>
                )}

                <div className="p-4">
                  {/* Address + Price */}
                  <h2 className="text-base font-semibold text-stone-900 leading-tight truncate">
                    {address}
                  </h2>
                  {price && (
                    <p className="mt-0.5 text-lg font-bold text-stone-900">{price}</p>
                  )}

                  {/* Beds / Baths / Sqft badges */}
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {listing.bedroomsTotal != null && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2.5 py-0.5 text-xs text-stone-600">
                        <BedDouble className="h-3 w-3" />
                        {listing.bedroomsTotal} {boardCopy.beds}
                      </span>
                    )}
                    {listing.bathroomsTotalInteger != null && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2.5 py-0.5 text-xs text-stone-600">
                        <Bath className="h-3 w-3" />
                        {listing.bathroomsTotalInteger} {boardCopy.baths}
                      </span>
                    )}
                    {listing.livingArea && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2.5 py-0.5 text-xs text-stone-600">
                        <Ruler className="h-3 w-3" />
                        {Number(listing.livingArea).toLocaleString()} {boardCopy.sqft}
                      </span>
                    )}
                  </div>

                  {/* Agent's note for this listing */}
                  {note && (
                    <p className="mt-3 text-xs text-stone-500 italic leading-relaxed">
                      &ldquo;{note}&rdquo; &mdash; {agentName}
                    </p>
                  )}

                  {/* Reaction buttons */}
                  <div className="mt-3 flex items-center gap-1.5">
                    {REACTION_CONFIG.map((r) => {
                      const isActive = currentReaction === r.key;
                      return (
                        <button
                          key={r.key}
                          type="button"
                          onClick={() => toggleReaction(listing.listingKey, r.key)}
                          className={`flex-1 inline-flex items-center justify-center gap-1 rounded-full border px-2 py-1.5 text-xs font-medium transition-colors ${
                            isActive
                              ? `${r.activeBg} ${r.activeText} ${r.activeBorder}`
                              : "border-stone-200 text-stone-500 hover:bg-stone-50"
                          }`}
                        >
                          <span>{r.emoji}</span>
                          <span className="hidden min-[400px]:inline">
                            {boardCopy[r.key]}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Expand / collapse details */}
                  {listing.publicRemarks && (
                    <button
                      type="button"
                      className="mt-2 flex items-center gap-1 text-xs text-stone-400 hover:text-stone-600 transition-colors"
                      onClick={() => {
                        if (!expanded) {
                          trackEvent("listing_open", {
                            listingId: listing.listingKey,
                            source: "buyer_board_details",
                          });
                        }
                        setExpandedId(expanded ? null : listing.listingKey);
                      }}
                    >
                      {expanded ? (
                        <ChevronUp className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5" />
                      )}
                      {expanded ? copy.hideDetails : copy.showDetails}
                    </button>
                  )}

                  {expanded && listing.publicRemarks && (
                    <div className="mt-2 rounded-xl bg-stone-50 border border-stone-100 p-3">
                      <p className="text-xs leading-relaxed text-stone-600">
                        {listing.publicRemarks}
                      </p>
                      {images.length > 1 && (
                        <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
                          {images.slice(1, 5).map((url, i) => (
                            <img
                              key={url}
                              src={url}
                              alt={`Photo ${i + 2}`}
                              className="h-12 w-16 shrink-0 rounded-lg border object-cover"
                              loading="lazy"
                            />
                          ))}
                          {images.length > 5 && (
                            <div className="flex h-12 w-16 shrink-0 items-center justify-center rounded-lg border bg-stone-100 text-[10px] text-stone-500">
                              +{images.length - 5}
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
            {boardCopy.sharedBy(agentName)}
            {brokerageName ? ` · ${brokerageName}` : ""}
          </p>
        </footer>
      </div>
    </div>
  );
}
