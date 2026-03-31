// legacy page — incrementally migrated
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
import { trpc } from "@/lib/trpc";
import { useT } from "@/i18n";
import {
    Bath,
    BedDouble,
    Clock,
    Flame,
    Loader2,
    MapPin,
    Ruler,
    X,
} from "lucide-react";
import { useMemo, useState } from "react";

type MlsListing = {
    id: number;
    listingKey: string;
    listingId: string | null;
    unparsedAddress: string | null;
    city: string | null;
    stateOrProvince: string | null;
    postalCode: string | null;
    listPrice: string | null;
    propertyType: string | null;
    standardStatus: string | null;
    bedroomsTotal: number | null;
    bathroomsTotalInteger: number | null;
    livingArea: string | null;
    publicRemarks: string | null;
    modificationTimestamp: string | null;
    thumbnailUrl?: string | null;
};

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
    listingId?: string | null;
    city?: string | null;
    stateOrProvince?: string | null;
}, fallback: string) {
    const full = item.unparsedAddress?.trim();
    if (full) return full;
    return [item.city, item.stateOrProvince].filter(Boolean).join(", ") || item.listingId || fallback;
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

export default function NewListings() {
    const { t } = useT();
    const [hours, setHours] = useState("24");
    const [selectedListing, setSelectedListing] = useState<MlsListing | null>(null);

    const recentHours = Number(hours) || 24;

    const listingsQuery = trpc.mls.getProperties.useQuery(
        {
            status: "Active",
            limit: 100,
            offset: 0,
        },
        { refetchInterval: 5 * 60 * 1000 }
    );

    const detailQuery = trpc.mls.getPropertyById.useQuery(
        { listingKey: selectedListing?.listingKey ?? "" },
        { enabled: !!selectedListing }
    );

    const listings = (listingsQuery.data ?? []) as MlsListing[];

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

            <div className="flex gap-6">
                <div className="flex-1 min-w-0">
                    {listingsQuery.isLoading ? (
                        <div className="flex items-center justify-center py-16 text-muted-foreground">
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                            {t("newListings.loading")}
                        </div>
                    ) : listings.length === 0 ? (
                        <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">
                            <Flame className="mx-auto h-8 w-8 mb-3 opacity-30" />
                            <p>{t("newListings.noResults", { hours: String(recentHours) })}</p>
                            <p className="text-xs mt-1">{t("newListings.expandTimeRange")}</p>
                        </div>
                    ) : (
                        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                            {listings.map((item) => (
                                <Card
                                    key={item.listingKey}
                                    className={`overflow-hidden cursor-pointer transition-all hover:shadow-md hover:border-primary/30 ${selectedListing?.listingKey === item.listingKey
                                        ? "ring-2 ring-primary/40 border-primary/40"
                                        : ""
                                        }`}
                                    onClick={() => setSelectedListing(item)}
                                >
                                    {item.thumbnailUrl ? (
                                        <div className="relative">
                                            <img
                                                src={item.thumbnailUrl}
                                                alt={displayAddress(item, t("newListings.addressUnknown"))}
                                                className="h-36 w-full object-cover"
                                            />
                                            <Badge className="absolute top-2 left-2 gap-1 bg-orange-500/90 text-white border-0 text-[10px]">
                                                <Flame className="h-3 w-3" />
                                                New
                                            </Badge>
                                        </div>
                                    ) : (
                                        <div className="h-36 bg-gradient-to-br from-muted/60 to-muted/20 flex items-center justify-center">
                                            <Badge className="gap-1 bg-orange-500/90 text-white border-0 text-[10px]">
                                                <Flame className="h-3 w-3" />
                                                New
                                            </Badge>
                                        </div>
                                    )}

                                    <CardContent className="p-3.5">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <p className="font-semibold text-sm truncate">
                                                    {formatPrice(item.listPrice, t("newListings.pricePending"))}
                                                </p>
                                                <p className="text-xs text-muted-foreground truncate mt-0.5">
                                                    {displayAddress(item, t("newListings.addressUnknown"))}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex flex-wrap items-center gap-2.5 mt-2.5 text-xs text-muted-foreground">
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

                                        <div className="flex items-center justify-between mt-2.5">
                                            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                                                <MapPin className="h-3 w-3" />
                                                {item.city || "NYC"}
                                            </span>
                                            <span className="inline-flex items-center gap-1 text-[11px] text-orange-500">
                                                <Clock className="h-3 w-3" />
                                                {timeAgo(item.modificationTimestamp, t("newListings.justNow"))}
                                            </span>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </div>

                {selectedListing && (
                    <div className="hidden lg:block w-[380px] shrink-0">
                        <Card className="sticky top-4">
                            <div className="flex items-center justify-between p-4 border-b">
                                <h3 className="font-semibold text-sm">{t("newListings.listingDetail")}</h3>
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
                                <div className="p-4 space-y-4">
                                    {selectedListing.thumbnailUrl && (
                                        <img
                                            src={selectedListing.thumbnailUrl}
                                            alt="Listing"
                                            className="w-full rounded-lg object-cover"
                                        />
                                    )}

                                    <div>
                                        <p className="font-bold text-lg">{formatPrice(selectedListing.listPrice, t("newListings.pricePending"))}</p>
                                        <p className="text-sm text-muted-foreground">{displayAddress(selectedListing, t("newListings.addressUnknown"))}</p>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            {[selectedListing.city, selectedListing.stateOrProvince, selectedListing.postalCode]
                                                .filter(Boolean)
                                                .join(", ")}
                                        </p>
                                    </div>

                                    <div className="flex flex-wrap gap-2">
                                        {selectedListing.propertyType && (
                                            <Badge variant="secondary">{selectedListing.propertyType}</Badge>
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
                                                {Number(selectedListing.livingArea).toLocaleString()} ft²
                                            </Badge>
                                        )}
                                    </div>

                                    <Badge className="gap-1 bg-orange-500/90 text-white border-0">
                                        <Clock className="h-3 w-3" />
                                        Listed {timeAgo(selectedListing.modificationTimestamp, t("newListings.justNow"))}
                                    </Badge>

                                    {(detailQuery.data as any)?.publicRemarks && (
                                        <div>
                                            <p className="text-xs font-semibold text-muted-foreground mb-1">{t("newListings.description")}</p>
                                            <p className="text-sm leading-relaxed">
                                                {(detailQuery.data as any).publicRemarks}
                                            </p>
                                        </div>
                                    )}

                                    <p className="text-[10px] text-muted-foreground pt-2 border-t">
                                        Listing Key: {selectedListing.listingKey}
                                        {selectedListing.listingId && ` · MLS #${selectedListing.listingId}`}
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
