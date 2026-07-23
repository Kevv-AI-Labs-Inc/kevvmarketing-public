// legacy page — incrementally migrated
import { useEffect, useMemo, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapView } from "@/components/Map";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Building2,
    Search,
    MapPin,
    BedDouble,
    Bath,
    Ruler,
    ChevronLeft,
    ChevronRight,
    Loader2,
    Share2,
    SlidersHorizontal,
    X,
    CheckSquare,
    Square,
    Route,
    Map as MapIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n";
import { ListingImage } from "@/components/listings/listing-image";

const PAGE_SIZE = 24;

const STATUS_COLORS: Record<string, string> = {
    Active: "bg-emerald-500/10 text-emerald-700 border-emerald-200",
    Pending: "bg-amber-500/10 text-amber-700 border-amber-200",
    Sold: "bg-blue-500/10 text-blue-700 border-blue-200",
    Closed: "bg-gray-500/10 text-gray-700 border-gray-200",
};

function formatPrice(price: string | null | undefined, fallback: string) {
    if (!price) return fallback;
    const num = parseFloat(price);
    if (isNaN(num)) return price;
    if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(2)}M`;
    if (num >= 1_000) return `$${(num / 1_000).toFixed(0)}K`;
    return `$${num.toLocaleString()}`;
}

function getDisplayAddress(property: {
    unparsedAddress?: string | null;
    listingId?: string | null;
    city?: string | null;
    stateOrProvince?: string | null;
    postalCode?: string | null;
}, fallback: string) {
    const primary = property.unparsedAddress?.trim();
    if (primary) return primary;

    const fb = [property.listingId, property.city, property.stateOrProvince, property.postalCode]
        .filter(Boolean)
        .join(" · ");

    return fb || fallback;
}

function parseCoordinate(value: unknown, type: "lat" | "lng") {
    if (value === null || value === undefined) return null;
    if (typeof value === "string" && value.trim().length === 0) return null;

    const parsed = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(parsed)) return null;
    if (type === "lat" && (parsed < -90 || parsed > 90)) return null;
    if (type === "lng" && (parsed < -180 || parsed > 180)) return null;

    return parsed;
}

export default function Listings() {
    const { t } = useT();
    const router = useRouter();
    const [search, setSearch] = useState("");
    const [city, setCity] = useState("");
    const [minPrice, setMinPrice] = useState("");
    const [maxPrice, setMaxPrice] = useState("");
    const [propertyType, setPropertyType] = useState("all");
    const [status, setStatus] = useState("all");
    const [page, setPage] = useState(0);
    const [showFilters, setShowFilters] = useState(false);
    const [showMapView, setShowMapView] = useState(false);
    const [selectedListingKey, setSelectedListingKey] = useState<string | null>(null);
    const [brokenThumbnailByListingKey, setBrokenThumbnailByListingKey] = useState<Record<string, boolean>>({});
    const [detailImageBroken, setDetailImageBroken] = useState(false);
    const [brokenDetailImageUrls, setBrokenDetailImageUrls] = useState<Record<string, boolean>>({});
    const [mapReady, setMapReady] = useState(false);
    const mapInstanceRef = useRef<any>(null);
    const markerRefs = useRef<any[]>([]);

    // Multi-select touring mode
    const [isSelectMode, setIsSelectMode] = useState(false);
    const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());

    const toggleSelectKey = (key: string) => {
        setSelectedKeys((prev) => {
            const next = new Set(prev);
            if (next.has(key)) {
                next.delete(key);
            } else {
                if (next.size >= 15) return prev;
                next.add(key);
            }
            return next;
        });
    };

    const exitSelectMode = () => {
        setIsSelectMode(false);
        setSelectedKeys(new Set());
    };

    const goToTourRoute = () => {
        if (selectedKeys.size === 0) return;
        const keys = Array.from(selectedKeys).join(",");
        const params = new URLSearchParams();
        params.set("listingKeys", keys);
        params.set("source", "listings");
        params.set("title", t("listings.tourRouteTitle", { count: String(selectedKeys.size) }));
        router.push(`/magic-share?${params.toString()}`);
    };

    // Build query params
    const queryInput = {
        search: search || undefined,
        city: city || undefined,
        minPrice: minPrice ? Number(minPrice) : undefined,
        maxPrice: maxPrice ? Number(maxPrice) : undefined,
        propertyType: propertyType !== "all" ? propertyType : undefined,
        status: status !== "all" ? status : undefined,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
    };

    const { data: properties, isLoading, isFetching } = trpc.mls.getProperties.useQuery(queryInput);
    const { data: propertyDetails, isLoading: isLoadingDetails } = trpc.mls.getPropertyById.useQuery(
        { listingKey: selectedListingKey ?? "" },
        {
            enabled: Boolean(selectedListingKey),
            refetchOnWindowFocus: false,
        }
    );

    useEffect(() => {
        setDetailImageBroken(false);
        setBrokenDetailImageUrls({});
    }, [propertyDetails?.listingKey]);

    const clearMarkers = () => {
        markerRefs.current.forEach((marker) => {
            if (typeof marker?.setMap === "function") {
                marker.setMap(null);
            } else if ("map" in (marker ?? {})) {
                marker.map = null;
            }
        });
        markerRefs.current = [];
    };

    const coordinateReadyProperties = useMemo(
        () =>
            (properties ?? []).flatMap((property) => {
                const lat = parseCoordinate(property.latitude, "lat");
                const lng = parseCoordinate(property.longitude, "lng");
                if (lat === null || lng === null) return [];
                if (Math.abs(lat) < 1e-8 && Math.abs(lng) < 1e-8) return [];
                return [{ property, lat, lng }];
            }),
        [properties]
    );

    useEffect(() => {
        if (!showMapView || !mapReady || !mapInstanceRef.current) {
            clearMarkers();
            return;
        }

        const gmaps = (window as any).google?.maps;
        if (!gmaps) return;

        clearMarkers();

        if (coordinateReadyProperties.length === 0) return;

        const bounds = new gmaps.LatLngBounds();
        const map = mapInstanceRef.current;
        const duplicateCounter = new Map<string, number>();

        const getDisplayPosition = (lat: number, lng: number) => {
            const key = `${lat.toFixed(6)},${lng.toFixed(6)}`;
            const seen = duplicateCounter.get(key) ?? 0;
            duplicateCounter.set(key, seen + 1);
            if (seen === 0) return { lat, lng };

            const radiusMeters = 10 + seen * 4;
            const angle = (seen * 137.5 * Math.PI) / 180;
            const latOffset = (radiusMeters / 111_320) * Math.cos(angle);
            const lngOffset =
                (radiusMeters / (111_320 * Math.max(Math.cos((lat * Math.PI) / 180), 0.2))) *
                Math.sin(angle);

            return { lat: lat + latOffset, lng: lng + lngOffset };
        };

        const AdvancedMarkerElement = gmaps?.marker?.AdvancedMarkerElement;

        coordinateReadyProperties.forEach(({ property, lat, lng }) => {
            const onSelect = () => setSelectedListingKey(property.listingKey ?? null);
            const position = getDisplayPosition(lat, lng);

            if (AdvancedMarkerElement) {
                const markerEl = document.createElement("button");
                markerEl.type = "button";
                markerEl.textContent = formatPrice(property.listPrice, t("listings.pricePending"));
                markerEl.style.cssText = [
                    "background:#ffffff",
                    "color:#0f172a",
                    "border:2px solid #0f766e",
                    "border-radius:999px",
                    "padding:4px 10px",
                    "font-size:12px",
                    "font-weight:700",
                    "line-height:1",
                    "white-space:nowrap",
                    "cursor:pointer",
                    "box-shadow:0 4px 12px rgba(15,23,42,.18)",
                    "transition:transform .15s ease",
                ].join(";");
                markerEl.addEventListener("mouseenter", () => {
                    markerEl.style.transform = "scale(1.06)";
                });
                markerEl.addEventListener("mouseleave", () => {
                    markerEl.style.transform = "scale(1)";
                });
                markerEl.addEventListener("click", onSelect);

                const marker = new AdvancedMarkerElement({
                    map,
                    position,
                    title: getDisplayAddress(property, t("listings.addressUnknown")),
                    content: markerEl,
                });

                marker.addListener?.("click", onSelect);
                marker.addListener?.("gmp-click", onSelect);

                markerRefs.current.push(marker);
            } else {
                const marker = new gmaps.Marker({
                    map,
                    position,
                    title: getDisplayAddress(property, t("listings.addressUnknown")),
                    label: {
                        text: formatPrice(property.listPrice, t("listings.pricePending")),
                        color: "#0f172a",
                        fontSize: "12px",
                        fontWeight: "700",
                    },
                    icon: {
                        path: gmaps.SymbolPath.CIRCLE,
                        scale: 24,
                        fillColor: "#ffffff",
                        fillOpacity: 1,
                        strokeColor: "#0f766e",
                        strokeWeight: 2,
                    },
                });

                marker.addListener("click", onSelect);
                markerRefs.current.push(marker);
            }

            bounds.extend(position);
        });
        if (coordinateReadyProperties.length === 1) {
            map.setCenter(bounds.getCenter());
            map.setZoom(13);
        } else {
            map.fitBounds(bounds, 72);
        }

        return () => {
            clearMarkers();
        };
    }, [coordinateReadyProperties, mapReady, showMapView]);

    const hasMore = properties && properties.length === PAGE_SIZE;

    const clearFilters = () => {
        setSearch("");
        setCity("");
        setMinPrice("");
        setMaxPrice("");
        setPropertyType("all");
        setStatus("all");
        setPage(0);
    };

    const hasActiveFilters = search || city || minPrice || maxPrice || propertyType !== "all" || status !== "all";

    const goToShareStudio = (listingKey: string, address: string | null) => {
        const params = new URLSearchParams();
        params.set("listingKeys", listingKey);
        params.set("source", "listings");
        if (address && address.trim().length > 0) {
            params.set("title", t("listings.shareTitle", { address: address.trim() }));
        }
        router.push(`/magic-share?${params.toString()}`);
    };

    return (
        <>
            <div className="space-y-6 pb-8">
                {/* Header */}
                <div className="flex flex-col gap-1">
                    <h1 className="text-3xl font-bold tracking-tight">{t("listings.title")}</h1>
                    <p className="text-muted-foreground">
                        {t("listings.subtitle")}
                    </p>
                </div>

                {/* Search Bar */}
                <div className="flex gap-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder={t("listings.searchPlaceholder")}
                            value={search}
                            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                            className="pl-10"
                        />
                    </div>
                    <Button
                        variant={showFilters ? "default" : "outline"}
                        onClick={() => setShowFilters(!showFilters)}
                        className="gap-2"
                    >
                        <SlidersHorizontal className="h-4 w-4" />
                        {t("listings.filter")}
                        {hasActiveFilters && (
                            <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                                !
                            </Badge>
                        )}
                    </Button>
                    <Button
                        variant={isSelectMode ? "default" : "outline"}
                        onClick={() => isSelectMode ? exitSelectMode() : setIsSelectMode(true)}
                        className="gap-2"
                    >
                        <Route className="h-4 w-4" />
                        {isSelectMode ? t("listings.cancelSelect") : t("listings.selectForTour")}
                    </Button>
                    <Button
                        variant={showMapView ? "default" : "outline"}
                        onClick={() => setShowMapView((prev) => !prev)}
                        className="gap-2"
                    >
                        <MapIcon className="h-4 w-4" />
                        {showMapView ? t("listings.hideMap") : t("listings.mapMode")}
                    </Button>
                </div>

                {/* Filters Panel */}
                {showFilters && (
                    <Card>
                        <CardContent className="pt-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                                <div>
                                    <label className="text-sm font-medium mb-1.5 block">{t("listings.city")}</label>
                                    <Input
                                        placeholder={t("listings.cityPlaceholder")}
                                        value={city}
                                        onChange={(e) => { setCity(e.target.value); setPage(0); }}
                                    />
                                </div>
                                <div>
                                    <label className="text-sm font-medium mb-1.5 block">{t("listings.minPrice")}</label>
                                    <Input
                                        type="number"
                                        placeholder="0"
                                        value={minPrice}
                                        onChange={(e) => { setMinPrice(e.target.value); setPage(0); }}
                                    />
                                </div>
                                <div>
                                    <label className="text-sm font-medium mb-1.5 block">{t("listings.maxPrice")}</label>
                                    <Input
                                        type="number"
                                        placeholder={t("listings.noLimit")}
                                        value={maxPrice}
                                        onChange={(e) => { setMaxPrice(e.target.value); setPage(0); }}
                                    />
                                </div>
                                <div>
                                    <label className="text-sm font-medium mb-1.5 block">{t("listings.propertyType")}</label>
                                    <Select value={propertyType} onValueChange={(v) => { setPropertyType(v); setPage(0); }}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">{t("listings.allTypes")}</SelectItem>
                                            <SelectItem value="Single Family">{t("listings.singleFamily")}</SelectItem>
                                            <SelectItem value="Condominium">{t("listings.condominium")}</SelectItem>
                                            <SelectItem value="Townhouse">{t("listings.townhouse")}</SelectItem>
                                            <SelectItem value="Multi Family">{t("listings.multiFamily")}</SelectItem>
                                            <SelectItem value="Land">{t("listings.land")}</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <label className="text-sm font-medium mb-1.5 block">{t("listings.statusLabel")}</label>
                                    <Select value={status} onValueChange={(v) => { setStatus(v); setPage(0); }}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">{t("listings.allStatuses")}</SelectItem>
                                            <SelectItem value="Active">{t("listings.active")}</SelectItem>
                                            <SelectItem value="Pending">{t("listings.pending")}</SelectItem>
                                            <SelectItem value="Sold">{t("listings.sold")}</SelectItem>
                                            <SelectItem value="Closed">{t("listings.closed")}</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            {hasActiveFilters && (
                                <div className="mt-4 flex justify-end">
                                    <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1.5">
                                        <X className="h-3.5 w-3.5" />
                                        {t("listings.clearFilters")}
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}

                {/* Loading State */}
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-3">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        <p className="text-muted-foreground">{t("listings.loading")}</p>
                    </div>
                ) : !properties || properties.length === 0 ? (
                    /* Empty State */
                    <div className="flex flex-col items-center justify-center py-20 gap-3">
                        <Building2 className="h-12 w-12 text-muted-foreground/50" />
                        <p className="text-lg font-medium">{t("listings.noResults")}</p>
                        <p className="text-muted-foreground text-sm">{t("listings.adjustFilters")}</p>
                        {hasActiveFilters && (
                            <Button variant="outline" size="sm" onClick={clearFilters}>
                                {t("listings.clearAll")}
                            </Button>
                        )}
                    </div>
                ) : (
                    <>
                        {showMapView && (
                            <Card>
                                <CardContent className="pt-6 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <p className="text-sm font-medium">{t("listings.mapTitle")}</p>
                                        <Badge variant="secondary">
                                            {t("listings.coordinateAvailable", { available: String(coordinateReadyProperties.length), total: String(properties.length) })}
                                        </Badge>
                                    </div>
                                    <MapView
                                        provider="google"
                                        className="h-[460px] rounded-xl border"
                                        onMapReady={(map) => {
                                            mapInstanceRef.current = map;
                                            setMapReady(true);
                                        }}
                                    />
                                    {coordinateReadyProperties.length === 0 && (
                                        <p className="text-sm text-muted-foreground">
                                            {t("listings.noCoordinates")}
                                        </p>
                                    )}
                                </CardContent>
                            </Card>
                        )}

                        {/* Results Count */}
                        <div className="flex items-center justify-between">
                            <p className="text-sm text-muted-foreground">
                                {t("listings.showingResults", { from: String(page * PAGE_SIZE + 1), to: String(page * PAGE_SIZE + properties.length) })}
                                {isFetching && <Loader2 className="inline-block ml-2 h-3 w-3 animate-spin" />}
                            </p>
                        </div>

                        {/* Property Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {properties.map((property) => {
                                const isChecked = selectedKeys.has(property.listingKey ?? '');
                                return (
                                    <Card
                                        key={property.id}
                                        className={`group overflow-hidden rounded-xl border-border/50 hover:shadow-md hover:ring-1 hover:ring-primary/20 transition-all duration-300 cursor-pointer ${isSelectMode && isChecked ? "ring-2 ring-primary border-primary" : ""
                                            }`}
                                        onClick={() => isSelectMode ? toggleSelectKey(property.listingKey ?? '') : setSelectedListingKey(property.listingKey ?? null)}
                                    >
                                        {/* Image placeholder */}
                                        <div className="relative aspect-[4/3] bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 flex items-center justify-center">
                                            {isSelectMode && (
                                                <div className="absolute top-3 right-3 z-10">
                                                    {isChecked ? (
                                                        <CheckSquare className="h-6 w-6 text-primary drop-shadow-md" />
                                                    ) : (
                                                        <Square className="h-6 w-6 text-white drop-shadow-md" />
                                                    )}
                                                </div>
                                            )}
                                            <ListingImage
                                                src={property.thumbnailUrl}
                                                alt={getDisplayAddress(property, t("listings.addressUnknown"))}
                                                width={400}
                                                height={300}
                                                className="h-full w-full object-cover"
                                                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                                            />
                                            {/* Status badge */}
                                            {property.standardStatus && (
                                                <Badge
                                                    variant="outline"
                                                    className={`absolute top-3 left-3 ${STATUS_COLORS[property.standardStatus] || "bg-gray-100 text-gray-700"}`}
                                                >
                                                    {property.standardStatus}
                                                </Badge>
                                            )}
                                            {/* Price */}
                                            <div className="absolute bottom-3 left-3">
                                                <span className="text-lg font-bold bg-black/70 text-white px-3 py-1 rounded-lg backdrop-blur-sm">
                                                    {formatPrice(property.listPrice, t("listings.pricePending"))}
                                                </span>
                                            </div>
                                        </div>

                                        <CardContent className="p-4 space-y-2">
                                            {/* Address */}
                                            <div className="flex items-start gap-1.5">
                                                <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                                                <div className="min-w-0">
                                                    <p className="font-medium text-sm leading-tight truncate">
                                                        {getDisplayAddress(property, t("listings.addressUnknown"))}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground truncate">
                                                        {[property.city, property.stateOrProvince, property.postalCode]
                                                            .filter(Boolean)
                                                            .join(", ")}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Property Details */}
                                            <div className="flex items-center gap-3 text-xs text-muted-foreground pt-1">
                                                {property.bedroomsTotal != null && (
                                                    <span className="flex items-center gap-1">
                                                        <BedDouble className="h-3.5 w-3.5" />
                                                        {property.bedroomsTotal}{t("listings.beds")}
                                                    </span>
                                                )}
                                                {property.bathroomsTotalInteger != null && (
                                                    <span className="flex items-center gap-1">
                                                        <Bath className="h-3.5 w-3.5" />
                                                        {property.bathroomsTotalInteger}{t("listings.baths")}
                                                    </span>
                                                )}
                                                {property.livingArea && (
                                                    <span className="flex items-center gap-1">
                                                        <Ruler className="h-3.5 w-3.5" />
                                                        {Number(property.livingArea).toLocaleString()}sqft
                                                    </span>
                                                )}
                                            </div>

                                            {/* Property Type */}
                                            {property.propertyType && (
                                                <p className="text-xs text-muted-foreground">
                                                    {property.propertyType}
                                                </p>
                                            )}
                                        </CardContent>
                                    </Card>);
                            })}
                        </div>

                        {/* Pagination */}
                        <div className="flex items-center justify-center gap-4 pt-4">
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={page === 0}
                                onClick={() => setPage((p) => Math.max(0, p - 1))}
                                className="gap-1.5"
                            >
                                <ChevronLeft className="h-4 w-4" />
                                {t("listings.prevPage")}
                            </Button>
                            <span className="text-sm text-muted-foreground">
                                {t("listings.page", { page: String(page + 1) })}
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={!hasMore}
                                onClick={() => setPage((p) => p + 1)}
                                className="gap-1.5"
                            >
                                {t("listings.nextPage")}
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </>
                )}

                {/* Floating Action Bar for Multi-Select */}
                {isSelectMode && selectedKeys.size > 0 && (
                    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-2xl border border-primary/20 bg-background/80 px-5 py-3 shadow-xl backdrop-blur-md">
                        <Badge variant="secondary" className="text-sm px-3 py-1">
                            {t("listings.selected", { count: String(selectedKeys.size) })}
                        </Badge>
                        <Button
                            className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
                            onClick={goToTourRoute}
                        >
                            <Route className="h-4 w-4" />
                            {t("listings.generateTourRoute")}
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedKeys(new Set())}
                        >
                            {t("listings.deselectAll")}
                        </Button>
                    </div>
                )}
            </div>

            <Dialog
                open={Boolean(selectedListingKey)}
                onOpenChange={(open) => {
                    if (!open) setSelectedListingKey(null);
                }}
            >
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{propertyDetails ? getDisplayAddress(propertyDetails, t("listings.addressUnknown")) : t("listings.listingDetails")}</DialogTitle>
                        <DialogDescription>
                            {propertyDetails?.listingId ? `Listing ID: ${propertyDetails.listingId}` : t("listings.clickToView")}
                        </DialogDescription>
                    </DialogHeader>

                    {isLoadingDetails ? (
                        <div className="flex items-center justify-center py-12 text-muted-foreground">
                            <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                            {t("listings.loadingDetails")}
                        </div>
                    ) : !propertyDetails ? (
                        <div className="py-8 text-center text-muted-foreground">
                            {t("listings.noDetails")}
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {(() => {
                                const detailImages = (propertyDetails.media ?? [])
                                    .map((m) => m.mediaURL)
                                    .filter((url): url is string => Boolean(url));
                                const mainImageUrl =
                                    detailImages.find((url) => !brokenDetailImageUrls[url]) ?? null;

                                return detailImages.length > 0 ? (
                                <div className="space-y-2">
                                    {!detailImageBroken && mainImageUrl ? (
                                        <ListingImage
                                            src={mainImageUrl}
                                            alt={getDisplayAddress(propertyDetails, t("listings.addressUnknown"))}
                                            width={700}
                                            height={256}
                                            className="w-full h-64 object-cover rounded-lg border"
                                            sizes="(max-width: 768px) 100vw, 700px"
                                        />
                                    ) : (
                                        <div className="w-full h-64 rounded-lg border bg-muted/40 flex items-center justify-center text-muted-foreground">
                                            {t("listings.mainImageFailed")}
                                        </div>
                                    )}
                                    <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
                                        {(propertyDetails.media ?? []).slice(0, 10).map((m) =>
                                            m.mediaURL ? (
                                                <ListingImage
                                                    key={m.id}
                                                    src={m.mediaURL}
                                                    alt="Property"
                                                    width={160}
                                                    height={80}
                                                    className="w-full h-20 object-cover rounded border"
                                                    sizes="(max-width: 768px) 33vw, 20vw"
                                                />
                                            ) : null
                                        )}
                                    </div>
                                </div>
                                ) : (
                                <div className="h-52 rounded-lg border bg-muted/40 flex items-center justify-center text-muted-foreground">
                                    {t("listings.noPhotos")}
                                </div>
                                );
                            })()}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div className="p-3 rounded-lg border">
                                    <p className="text-xs text-muted-foreground">{t("listings.listPrice")}</p>
                                    <p className="text-lg font-semibold">{formatPrice(propertyDetails.listPrice, t("listings.pricePending"))}</p>
                                </div>
                                <div className="p-3 rounded-lg border">
                                    <p className="text-xs text-muted-foreground">{t("listings.address")}</p>
                                    <p className="font-medium">{getDisplayAddress(propertyDetails, t("listings.addressUnknown"))}</p>
                                    <p className="text-sm text-muted-foreground">
                                        {[propertyDetails.city, propertyDetails.stateOrProvince, propertyDetails.postalCode]
                                            .filter(Boolean)
                                            .join(", ")}
                                    </p>
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-2">
                                {propertyDetails.propertyType ? (
                                    <Badge variant="secondary">{propertyDetails.propertyType}</Badge>
                                ) : null}
                                {propertyDetails.standardStatus ? (
                                    <Badge variant="outline">{propertyDetails.standardStatus}</Badge>
                                ) : null}
                                {propertyDetails.bedroomsTotal != null ? (
                                    <Badge variant="outline">{propertyDetails.bedroomsTotal} {t("listings.beds")}</Badge>
                                ) : null}
                                {propertyDetails.bathroomsTotalInteger != null ? (
                                    <Badge variant="outline">{propertyDetails.bathroomsTotalInteger} {t("listings.baths")}</Badge>
                                ) : null}
                                {propertyDetails.livingArea ? (
                                    <Badge variant="outline">{Number(propertyDetails.livingArea).toLocaleString()} sqft</Badge>
                                ) : null}
                            </div>

                            <div className="rounded-lg border p-3">
                                <p className="text-xs text-muted-foreground mb-1">{t("listings.publicRemarks")}</p>
                                <p className="text-sm leading-relaxed">
                                    {propertyDetails.publicRemarks || t("listings.noRemarks")}
                                </p>
                            </div>

                            <div className="flex flex-wrap gap-2">
                                <Button
                                    variant="outline"
                                    onClick={() =>
                                        goToShareStudio(
                                            propertyDetails.listingKey ?? '',
                                            propertyDetails.unparsedAddress ?? null
                                        )
                                    }
                                >
                                    <Share2 className="mr-2 h-4 w-4" />
                                    {t("listings.addToShare")}
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}
