// legacy page — incrementally migrated
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { useT } from "@/i18n";
import {
    Bath,
    BedDouble,
    Car,
    Clock,
    Copy,
    ExternalLink,
    Loader2,
    MapPin,
    Navigation,
    Plus,
    Ruler,
    Search,
    Share2,
    Trash2,
    X,
} from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";

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
    bedroomsTotal: number | null;
    bathroomsTotalInteger: number | null;
    livingArea: string | null;
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
    city?: string | null;
    stateOrProvince?: string | null;
    postalCode?: string | null;
}, fallback: string) {
    const full = item.unparsedAddress?.trim();
    if (full) return full;
    const fb = [item.city, item.stateOrProvince, item.postalCode]
        .filter(Boolean)
        .join(" · ");
    return fb || fallback;
}

export default function ShowingTour() {
    const { t } = useT();
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedListings, setSelectedListings] = useState<MlsListing[]>([]);
    const [agentName, setAgentName] = useState("");
    const [agentPhone, setAgentPhone] = useState("");
    const [clientName, setClientName] = useState("");
    const [tourDate, setTourDate] = useState(
        new Date().toISOString().split("T")[0]
    );
    const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);

    const searchResults = trpc.mls.getProperties.useQuery(
        { search: searchQuery || undefined, limit: 10, offset: 0, status: "Active" },
        { enabled: searchQuery.length >= 2 }
    );

    const createTour = trpc.showingTour.createTour.useMutation({
        onSuccess: (data) => {
            setGeneratedUrl(data.shareUrl);
            toast.success(t("showingTour.tourSuccess"), {
                description: t("showingTour.tourSuccessDescription", { count: String(data.propertyCount), distance: data.totalDistance ?? "N/A" }),
            });
        },
        onError: (err) => {
            toast.error(t("showingTour.tourFailed"), { description: err.message });
        },
    });

    const addListing = useCallback(
        (listing: MlsListing) => {
            if (selectedListings.find((l) => l.listingKey === listing.listingKey)) {
                toast.info(t("showingTour.alreadyAdded"));
                return;
            }
            if (selectedListings.length >= 10) {
                toast.warning(t("showingTour.maxListings"));
                return;
            }
            setSelectedListings((prev) => [...prev, listing]);
            setSearchQuery("");
        },
        [selectedListings, t]
    );

    const removeListing = useCallback((listingKey: string) => {
        setSelectedListings((prev) =>
            prev.filter((l) => l.listingKey !== listingKey)
        );
    }, []);

    const handleGenerate = () => {
        if (selectedListings.length < 2) {
            toast.error(t("showingTour.minListings"));
            return;
        }
        createTour.mutate({
            propertyIds: selectedListings.map((l) => l.listingKey),
            agentName: agentName || undefined,
            agentPhone: agentPhone || undefined,
            clientName: clientName || undefined,
            tourDate: tourDate || undefined,
        });
    };

    const copyLink = () => {
        if (!generatedUrl) return;
        navigator.clipboard.writeText(generatedUrl);
        toast.success(t("showingTour.linkCopied"));
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-serif tracking-tight flex items-center gap-2">
                    <Navigation className="h-6 w-6 text-primary" />
                    {t("showingTour.title")}
                </h1>
                <p className="text-muted-foreground mt-1">
                    {t("showingTour.subtitle")}
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-4">
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2">
                                <Search className="h-4 w-4" />
                                {t("showingTour.searchTitle")}
                            </CardTitle>
                            <CardDescription>
                                {t("showingTour.searchDescription")}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder={t("showingTour.searchPlaceholder")}
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-10"
                                />
                            </div>

                            {searchQuery.length >= 2 && (
                                <div className="mt-2 border rounded-lg max-h-60 overflow-y-auto">
                                    {searchResults.isLoading ? (
                                        <div className="p-4 flex items-center justify-center text-muted-foreground text-sm">
                                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                            {t("showingTour.searching")}
                                        </div>
                                    ) : searchResults.data?.length === 0 ? (
                                        <div className="p-4 text-center text-muted-foreground text-sm">
                                            {t("showingTour.noResults")}
                                        </div>
                                    ) : (
                                        searchResults.data?.map((listing: any) => (
                                            <button
                                                key={listing.listingKey}
                                                className="w-full text-left px-4 py-3 hover:bg-accent/50 border-b last:border-b-0 transition-colors"
                                                onClick={() => addListing(listing)}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <div className="font-medium text-sm">
                                                            {displayAddress(listing, t("showingTour.addressUnknown"))}
                                                        </div>
                                                        <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                                                            <span>{formatPrice(listing.listPrice, t("showingTour.pricePending"))}</span>
                                                            {listing.bedroomsTotal && (
                                                                <span>{listing.bedroomsTotal} {t("showingTour.beds")}</span>
                                                            )}
                                                            {listing.bathroomsTotalInteger && (
                                                                <span>{listing.bathroomsTotalInteger} {t("showingTour.baths")}</span>
                                                            )}
                                                            {listing.propertyType && (
                                                                <span>{listing.propertyType}</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <Plus className="h-4 w-4 text-primary flex-shrink-0" />
                                                </div>
                                            </button>
                                        ))
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center justify-between">
                                <span className="flex items-center gap-2">
                                    <MapPin className="h-4 w-4" />
                                    {t("showingTour.selectedListings")}
                                </span>
                                <Badge variant="secondary">
                                    {selectedListings.length} / 10
                                </Badge>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {selectedListings.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground">
                                    <MapPin className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                    <p className="text-sm">{t("showingTour.emptyState")}</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {selectedListings.map((listing, index) => (
                                        <div
                                            key={listing.listingKey}
                                            className="flex items-center gap-3 p-3 bg-accent/30 rounded-lg"
                                        >
                                            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
                                                {index + 1}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="font-medium text-sm truncate">
                                                    {displayAddress(listing, t("showingTour.addressUnknown"))}
                                                </div>
                                                <div className="text-xs text-muted-foreground flex items-center gap-2">
                                                    <span>{formatPrice(listing.listPrice, t("showingTour.pricePending"))}</span>
                                                    {listing.bedroomsTotal && (
                                                        <span className="flex items-center gap-0.5">
                                                            <BedDouble className="h-3 w-3" />
                                                            {listing.bedroomsTotal}
                                                        </span>
                                                    )}
                                                    {listing.bathroomsTotalInteger && (
                                                        <span className="flex items-center gap-0.5">
                                                            <Bath className="h-3 w-3" />
                                                            {listing.bathroomsTotalInteger}
                                                        </span>
                                                    )}
                                                    {listing.livingArea && (
                                                        <span className="flex items-center gap-0.5">
                                                            <Ruler className="h-3 w-3" />
                                                            {Number(listing.livingArea).toLocaleString()} sqft
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => removeListing(listing.listingKey)}
                                                className="text-muted-foreground hover:text-destructive transition-colors"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                <div className="space-y-4">
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base">{t("showingTour.tourInfo")}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div>
                                <label className="text-xs text-muted-foreground">
                                    {t("showingTour.agentName")}
                                </label>
                                <Input
                                    placeholder={t("showingTour.agentNamePlaceholder")}
                                    value={agentName}
                                    onChange={(e) => setAgentName(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="text-xs text-muted-foreground">
                                    {t("showingTour.agentPhone")}
                                </label>
                                <Input
                                    placeholder="917-xxx-xxxx"
                                    value={agentPhone}
                                    onChange={(e) => setAgentPhone(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="text-xs text-muted-foreground">
                                    {t("showingTour.clientName")}
                                </label>
                                <Input
                                    placeholder={t("showingTour.clientNamePlaceholder")}
                                    value={clientName}
                                    onChange={(e) => setClientName(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="text-xs text-muted-foreground">
                                    {t("showingTour.tourDate")}
                                </label>
                                <Input
                                    type="date"
                                    value={tourDate}
                                    onChange={(e) => setTourDate(e.target.value)}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    <Button
                        className="w-full h-12 text-base font-semibold"
                        disabled={selectedListings.length < 2 || createTour.isPending}
                        onClick={handleGenerate}
                    >
                        {createTour.isPending ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                {t("showingTour.generating")}
                            </>
                        ) : (
                            <>
                                <Navigation className="h-4 w-4 mr-2" />
                                {t("showingTour.generateTour")}
                            </>
                        )}
                    </Button>

                    {selectedListings.length < 2 && selectedListings.length > 0 && (
                        <p className="text-xs text-muted-foreground text-center">
                            {t("showingTour.needMore", { count: String(2 - selectedListings.length) })}
                        </p>
                    )}

                    {generatedUrl && (
                        <Card className="border-primary/30 bg-primary/5">
                            <CardContent className="pt-4 space-y-3">
                                <div className="flex items-center gap-2 text-primary font-semibold text-sm">
                                    <Share2 className="h-4 w-4" />
                                    {t("showingTour.tourGenerated")}
                                </div>

                                <div className="flex items-center gap-2">
                                    <Input
                                        readOnly
                                        value={generatedUrl}
                                        className="text-xs bg-background"
                                    />
                                    <Button size="icon" variant="outline" onClick={copyLink}>
                                        <Copy className="h-4 w-4" />
                                    </Button>
                                </div>

                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        className="flex-1 text-xs"
                                        onClick={() => window.open(generatedUrl, "_blank")}
                                    >
                                        <ExternalLink className="h-3 w-3 mr-1" />
                                        {t("showingTour.preview")}
                                    </Button>
                                    <Button
                                        variant="outline"
                                        className="flex-1 text-xs"
                                        onClick={copyLink}
                                    >
                                        <Copy className="h-3 w-3 mr-1" />
                                        {t("showingTour.copyLink")}
                                    </Button>
                                </div>

                                {createTour.data && (
                                    <div className="text-xs text-muted-foreground space-y-1 pt-1 border-t">
                                        <div className="flex items-center gap-1">
                                            <Car className="h-3 w-3" />
                                            {t("showingTour.totalDistance")}: {createTour.data.totalDistance ?? "N/A"}
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <Clock className="h-3 w-3" />
                                            {t("showingTour.driveTime")}: {createTour.data.totalDuration ?? "N/A"}
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <MapPin className="h-3 w-3" />
                                            {t("showingTour.stops", { count: String(createTour.data.propertyCount) })}
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    );
}
