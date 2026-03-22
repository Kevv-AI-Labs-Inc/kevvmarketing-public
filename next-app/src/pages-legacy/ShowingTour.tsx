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

// ─── Types ──────────────────────────────────────────────────

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

function formatPrice(price: string | null | undefined) {
    if (!price) return "价格待定";
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
}) {
    const full = item.unparsedAddress?.trim();
    if (full) return full;
    const fallback = [item.city, item.stateOrProvince, item.postalCode]
        .filter(Boolean)
        .join(" · ");
    return fallback || "地址未知";
}

// ─── Component ──────────────────────────────────────────────

export default function ShowingTour() {
    // State
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedListings, setSelectedListings] = useState<MlsListing[]>([]);
    const [agentName, setAgentName] = useState("");
    const [agentPhone, setAgentPhone] = useState("");
    const [clientName, setClientName] = useState("");
    const [tourDate, setTourDate] = useState(
        new Date().toISOString().split("T")[0]
    );
    const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);

    // Search listings
    const searchResults = trpc.mls.getProperties.useQuery(
        { search: searchQuery || undefined, limit: 10, offset: 0, status: "Active" },
        { enabled: searchQuery.length >= 2 }
    );

    // Create tour mutation
    const createTour = trpc.showingTour.createTour.useMutation({
        onSuccess: (data) => {
            setGeneratedUrl(data.shareUrl);
            toast.success("看房行程已生成！", {
                description: `${data.propertyCount} 套房源，总行程 ${data.totalDistance ?? "N/A"}`,
            });
        },
        onError: (err) => {
            toast.error("生成失败", { description: err.message });
        },
    });

    const addListing = useCallback(
        (listing: MlsListing) => {
            if (selectedListings.find((l) => l.listingKey === listing.listingKey)) {
                toast.info("已添加过该房源");
                return;
            }
            if (selectedListings.length >= 10) {
                toast.warning("最多支持 10 套房源");
                return;
            }
            setSelectedListings((prev) => [...prev, listing]);
            setSearchQuery("");
        },
        [selectedListings]
    );

    const removeListing = useCallback((listingKey: string) => {
        setSelectedListings((prev) =>
            prev.filter((l) => l.listingKey !== listingKey)
        );
    }, []);

    const handleGenerate = () => {
        if (selectedListings.length < 2) {
            toast.error("请至少选择 2 套房源");
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
        toast.success("链接已复制");
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-serif tracking-tight flex items-center gap-2">
                    <Navigation className="h-6 w-6 text-primary" />
                    智能看房行程
                </h1>
                <p className="text-muted-foreground mt-1">
                    选择要看的房源，系统自动计算最优驾驶路线，生成可分享的看房指南
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left: Search + Selected Listings */}
                <div className="lg:col-span-2 space-y-4">
                    {/* Search (same pattern as Magic Share) */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2">
                                <Search className="h-4 w-4" />
                                搜索房源
                            </CardTitle>
                            <CardDescription>
                                搜索并添加需要带看的房源（2-10 套）
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="输入地址、MLS 编号或关键词搜索..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-10"
                                />
                            </div>

                            {/* Search results dropdown */}
                            {searchQuery.length >= 2 && (
                                <div className="mt-2 border rounded-lg max-h-60 overflow-y-auto">
                                    {searchResults.isLoading ? (
                                        <div className="p-4 flex items-center justify-center text-muted-foreground text-sm">
                                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                            搜索中...
                                        </div>
                                    ) : searchResults.data?.length === 0 ? (
                                        <div className="p-4 text-center text-muted-foreground text-sm">
                                            未找到结果
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
                                                            {displayAddress(listing)}
                                                        </div>
                                                        <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                                                            <span>{formatPrice(listing.listPrice)}</span>
                                                            {listing.bedroomsTotal && (
                                                                <span>{listing.bedroomsTotal} 卧</span>
                                                            )}
                                                            {listing.bathroomsTotalInteger && (
                                                                <span>{listing.bathroomsTotalInteger} 浴</span>
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

                    {/* Selected listings */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center justify-between">
                                <span className="flex items-center gap-2">
                                    <MapPin className="h-4 w-4" />
                                    已选房源
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
                                    <p className="text-sm">搜索并添加房源到行程中</p>
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
                                                    {displayAddress(listing)}
                                                </div>
                                                <div className="text-xs text-muted-foreground flex items-center gap-2">
                                                    <span>{formatPrice(listing.listPrice)}</span>
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

                {/* Right: Agent Info + Generate */}
                <div className="space-y-4">
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base">行程信息</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div>
                                <label className="text-xs text-muted-foreground">
                                    经纪人姓名
                                </label>
                                <Input
                                    placeholder="您的姓名"
                                    value={agentName}
                                    onChange={(e) => setAgentName(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="text-xs text-muted-foreground">
                                    联系电话
                                </label>
                                <Input
                                    placeholder="917-xxx-xxxx"
                                    value={agentPhone}
                                    onChange={(e) => setAgentPhone(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="text-xs text-muted-foreground">
                                    客户姓名
                                </label>
                                <Input
                                    placeholder="客户姓名（可选）"
                                    value={clientName}
                                    onChange={(e) => setClientName(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="text-xs text-muted-foreground">
                                    看房日期
                                </label>
                                <Input
                                    type="date"
                                    value={tourDate}
                                    onChange={(e) => setTourDate(e.target.value)}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Generate button */}
                    <Button
                        className="w-full h-12 text-base font-semibold"
                        disabled={selectedListings.length < 2 || createTour.isPending}
                        onClick={handleGenerate}
                    >
                        {createTour.isPending ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                生成中...
                            </>
                        ) : (
                            <>
                                <Navigation className="h-4 w-4 mr-2" />
                                生成看房行程
                            </>
                        )}
                    </Button>

                    {selectedListings.length < 2 && selectedListings.length > 0 && (
                        <p className="text-xs text-muted-foreground text-center">
                            还需添加 {2 - selectedListings.length} 套房源
                        </p>
                    )}

                    {/* Generated result */}
                    {generatedUrl && (
                        <Card className="border-primary/30 bg-primary/5">
                            <CardContent className="pt-4 space-y-3">
                                <div className="flex items-center gap-2 text-primary font-semibold text-sm">
                                    <Share2 className="h-4 w-4" />
                                    行程链接已生成
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
                                        预览
                                    </Button>
                                    <Button
                                        variant="outline"
                                        className="flex-1 text-xs"
                                        onClick={copyLink}
                                    >
                                        <Copy className="h-3 w-3 mr-1" />
                                        复制链接
                                    </Button>
                                </div>

                                {createTour.data && (
                                    <div className="text-xs text-muted-foreground space-y-1 pt-1 border-t">
                                        <div className="flex items-center gap-1">
                                            <Car className="h-3 w-3" />
                                            总行程: {createTour.data.totalDistance ?? "N/A"}
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <Clock className="h-3 w-3" />
                                            驾驶时间: {createTour.data.totalDuration ?? "N/A"}
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <MapPin className="h-3 w-3" />
                                            {createTour.data.propertyCount} 个停靠点
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
