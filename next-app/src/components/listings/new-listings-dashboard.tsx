"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useT } from "@/i18n";
import {
  Bath,
  BedDouble,
  Clock,
  Flame,
  MapPin,
  Ruler,
  X,
} from "lucide-react";
import { ListingImage } from "@/components/listings/listing-image";
import type { NewListingItem } from "@/server/mls/listingCache";

// ─── Helpers ───────────────────────────────────────────────────

function formatPrice(price: string | null | undefined, fallback: string) {
  if (!price) return fallback;
  const num = Number(price);
  if (!Number.isFinite(num)) return price;
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000) return `$${(num / 1_000).toFixed(0)}K`;
  return `$${num.toLocaleString()}`;
}

function displayAddress(
  item: {
    unparsedAddress?: string | null;
    listingId?: string | null;
    city?: string | null;
    stateOrProvince?: string | null;
  },
  fallback: string
) {
  const full = item.unparsedAddress?.trim();
  if (full) return full;
  return (
    [item.city, item.stateOrProvince].filter(Boolean).join(", ") ||
    item.listingId ||
    fallback
  );
}

function timeAgo(dateStr: string | null | undefined, justNowLabel: string) {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return justNowLabel;
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ─── Props ─────────────────────────────────────────────────────

type NewListingsDashboardProps = {
  /** Server-fetched listings (ISR cached) */
  initialListings: NewListingItem[];
};

// ─── Component ─────────────────────────────────────────────────

export default function NewListingsDashboard({
  initialListings,
}: NewListingsDashboardProps) {
  const { t } = useT();
  const [hours, setHours] = useState("24");
  const [selectedListing, setSelectedListing] =
    useState<NewListingItem | null>(null);

  const recentHours = Number(hours) || 24;

  // Client-side time filtering on server-fetched data
  const listings = useMemo(() => {
    const cutoff = Date.now() - recentHours * 60 * 60 * 1000;
    return initialListings.filter((item) => {
      if (!item.modificationTimestamp) return true;
      return new Date(item.modificationTimestamp).getTime() >= cutoff;
    });
  }, [initialListings, recentHours]);

  const stats = useMemo(() => {
    const total = listings.length;
    const cities = new Map<string, number>();
    for (const item of listings) {
      const city = item.city || "Unknown";
      cities.set(city, (cities.get(city) || 0) + 1);
    }
    const topCities = Array.from(cities.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    return { total, topCities };
  }, [listings]);

  return (
    <div className="space-y-6 pb-8">
      {/* Hero */}
      <div className="rounded-3xl border border-orange-400/20 bg-gradient-to-br from-orange-500/10 via-amber-500/5 to-transparent p-6 text-foreground shadow-sm md:p-8">
        <div className="flex items-center gap-2 text-sm text-orange-500">
          <Flame className="h-4 w-4" />
          {t("newListings.eyebrow")}
        </div>
        <h1 className="mt-2 text-3xl font-serif tracking-tight md:text-4xl">
          {t("newListings.heroTitle")}
        </h1>
        <p className="mt-3 max-w-3xl text-sm text-muted-foreground md:text-base">
          {t("newListings.heroDescription", { hours: String(recentHours) })}
        </p>
      </div>

      {/* Filters & Stats */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={hours} onValueChange={setHours}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="6">{t("newListings.last6h")}</SelectItem>
            <SelectItem value="12">{t("newListings.last12h")}</SelectItem>
            <SelectItem value="24">{t("newListings.last24h")}</SelectItem>
            <SelectItem value="48">{t("newListings.last48h")}</SelectItem>
            <SelectItem value="72">{t("newListings.last3d")}</SelectItem>
          </SelectContent>
        </Select>

        <Badge variant="secondary" className="gap-1">
          <Flame className="h-3 w-3" />
          {t("newListings.newCount", { count: String(stats.total) })}
        </Badge>

        {stats.topCities.slice(0, 3).map(([city, count]) => (
          <Badge key={city} variant="outline">
            {city} ({count})
          </Badge>
        ))}
      </div>

      {/* Main Content */}
      <div className="flex gap-6">
        <div className="min-w-0 flex-1">
          {listings.length === 0 ? (
            <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">
              <Flame className="mx-auto mb-3 h-8 w-8 opacity-30" />
              <p>
                {t("newListings.noResults", { hours: String(recentHours) })}
              </p>
              <p className="mt-1 text-xs">
                {t("newListings.expandTimeRange")}
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {listings.map((item, index) => (
                <Card
                  key={item.listingKey}
                  className={`cursor-pointer overflow-hidden transition-all hover:border-primary/30 hover:shadow-md ${
                    selectedListing?.listingKey === item.listingKey
                      ? "ring-2 ring-primary/40 border-primary/40"
                      : ""
                  }`}
                  onClick={() => setSelectedListing(item)}
                >
                  <div className="relative">
                    <ListingImage
                      src={item.thumbnailUrl}
                      alt={displayAddress(
                        item,
                        t("newListings.addressUnknown")
                      )}
                      width={400}
                      height={144}
                      className="h-36 w-full object-cover"
                      priority={index < 6}
                      sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
                    />
                    <Badge className="absolute left-2 top-2 gap-1 border-0 bg-orange-500/90 text-[10px] text-white">
                      <Flame className="h-3 w-3" />
                      New
                    </Badge>
                  </div>

                  <CardContent className="p-3.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">
                          {formatPrice(
                            item.listPrice,
                            t("newListings.pricePending")
                          )}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {displayAddress(
                            item,
                            t("newListings.addressUnknown")
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="mt-2.5 flex flex-wrap items-center gap-2.5 text-xs text-muted-foreground">
                      {item.bedroomsTotal != null && (
                        <span className="inline-flex items-center gap-1">
                          <BedDouble className="h-3 w-3" />
                          {item.bedroomsTotal}
                        </span>
                      )}
                      {item.bathroomsTotalInteger != null && (
                        <span className="inline-flex items-center gap-1">
                          <Bath className="h-3 w-3" />
                          {item.bathroomsTotalInteger}
                        </span>
                      )}
                      {item.livingArea && (
                        <span className="inline-flex items-center gap-1">
                          <Ruler className="h-3 w-3" />
                          {Number(item.livingArea).toLocaleString()} ft²
                        </span>
                      )}
                    </div>

                    <div className="mt-2.5 flex items-center justify-between">
                      <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        {item.city || "NYC"}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[11px] text-orange-500">
                        <Clock className="h-3 w-3" />
                        {timeAgo(
                          item.modificationTimestamp,
                          t("newListings.justNow")
                        )}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Detail Sidebar */}
        {selectedListing && (
          <div className="hidden w-[380px] shrink-0 lg:block">
            <Card className="sticky top-4">
              <div className="flex items-center justify-between border-b p-4">
                <h3 className="text-sm font-semibold">
                  {t("newListings.listingDetail")}
                </h3>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setSelectedListing(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <ScrollArea className="h-[calc(100vh-200px)]">
                <div className="space-y-4 p-4">
                  <ListingImage
                    src={selectedListing.thumbnailUrl}
                    alt="Listing"
                    width={380}
                    height={260}
                    className="w-full rounded-lg object-cover"
                    sizes="380px"
                    priority
                  />

                  <div>
                    <p className="text-lg font-bold">
                      {formatPrice(
                        selectedListing.listPrice,
                        t("newListings.pricePending")
                      )}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {displayAddress(
                        selectedListing,
                        t("newListings.addressUnknown")
                      )}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {[
                        selectedListing.city,
                        selectedListing.stateOrProvince,
                        selectedListing.postalCode,
                      ]
                        .filter(Boolean)
                        .join(", ")}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {selectedListing.propertyType && (
                      <Badge variant="secondary">
                        {selectedListing.propertyType}
                      </Badge>
                    )}
                    {selectedListing.bedroomsTotal != null && (
                      <Badge variant="outline">
                        <BedDouble className="mr-1 h-3 w-3" />
                        {selectedListing.bedroomsTotal} bed
                      </Badge>
                    )}
                    {selectedListing.bathroomsTotalInteger != null && (
                      <Badge variant="outline">
                        <Bath className="mr-1 h-3 w-3" />
                        {selectedListing.bathroomsTotalInteger} bath
                      </Badge>
                    )}
                    {selectedListing.livingArea && (
                      <Badge variant="outline">
                        <Ruler className="mr-1 h-3 w-3" />
                        {Number(
                          selectedListing.livingArea
                        ).toLocaleString()}{" "}
                        ft²
                      </Badge>
                    )}
                  </div>

                  <Badge className="gap-1 border-0 bg-orange-500/90 text-white">
                    <Clock className="h-3 w-3" />
                    Listed{" "}
                    {timeAgo(
                      selectedListing.modificationTimestamp,
                      t("newListings.justNow")
                    )}
                  </Badge>

                  <p className="border-t pt-2 text-[10px] text-muted-foreground">
                    Listing Key: {selectedListing.listingKey}
                    {selectedListing.listingId &&
                      ` · MLS #${selectedListing.listingId}`}
                  </p>
                </div>
              </ScrollArea>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
