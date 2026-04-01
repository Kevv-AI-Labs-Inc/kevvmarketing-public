// legacy page — incrementally migrated
"use client";
/**
 * Flyer Studio — AI-Powered Real Estate Marketing Flyer Generator
 *
 * Phase 1: MLS auto-fill, Agent profile auto-fill, real AI copy, PNG export
 */

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { toPng } from "html-to-image";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useT } from "@/i18n";
import {
    FileText,
    Home,
    CheckCircle,
    DollarSign,
    Calendar,
    TrendingDown,
    Sparkles,
    Download,
    Palette,
    Type,
    Loader2,
    Eye,
    Languages,
    Search,
    Plus,
    BedDouble,
    Bath,
    Ruler,
    MapPin,
    ImageIcon,
    Save,
    Share2,
    Trash2,
} from "lucide-react";
import { toast } from "sonner";

// ─── Template Types ────────────────────────────────────────

type FlyerType =
    | "just_listed" | "under_contract" | "just_sold" | "open_house" | "price_reduced"
    | "coming_soon" | "new_construction"
    | "agent_intro" | "market_update"
    | "ig_story" | "wechat_moment"
    | "cny_greeting" | "thanksgiving";

type TemplateCategory = "transaction" | "event" | "brand" | "social" | "holiday";

interface FlyerTemplate {
    id: FlyerType;
    category: TemplateCategory;
    name: string;
    nameZh: string;
    icon: React.ElementType;
    color: string;
    gradientFrom: string;
    gradientTo: string;
    defaultHeadline: string;
    defaultHeadlineZh: string;
    defaultSubtext: string;
    defaultSubtextZh: string;
    defaultSize?: SizeKey;
    hidePropertyFields?: boolean;
}

// ─── Size System ───────────────────────────────────────────

type SizeKey = "letter" | "square" | "story" | "landscape" | "postcard";

interface FlyerSize {
    id: SizeKey;
    name: string;
    nameZh: string;
    aspect: string; // CSS aspect-ratio
    width: number;  // export px
    height: number;
    desc: string;
}

const SIZES: FlyerSize[] = [
    { id: "letter", name: "Letter", nameZh: "打印传单", aspect: "8.5/11", width: 1700, height: 2200, desc: "8.5×11 print" },
    { id: "square", name: "Square", nameZh: "方形", aspect: "1/1", width: 1080, height: 1080, desc: "Instagram / WeChat" },
    { id: "story", name: "Story", nameZh: "竖版", aspect: "9/16", width: 1080, height: 1920, desc: "IG Story / 小红书" },
    { id: "landscape", name: "Landscape", nameZh: "横版", aspect: "16/9", width: 1920, height: 1080, desc: "Facebook / 公众号" },
    { id: "postcard", name: "Postcard", nameZh: "明信片", aspect: "6/4", width: 1800, height: 1200, desc: "6×4 mail" },
];

// ─── Color Schemes ─────────────────────────────────────────

interface ColorScheme {
    id: string;
    name: string;
    accent: string;
    secondary: string;
    bgFrom: string;
    bgTo: string;
}

const COLOR_SCHEMES: ColorScheme[] = [
    { id: "royal", name: "Royal Blue", accent: "#2563eb", secondary: "#1e40af", bgFrom: "#1e3a8a", bgTo: "#3b82f6" },
    { id: "emerald", name: "Emerald", accent: "#059669", secondary: "#047857", bgFrom: "#064e3b", bgTo: "#34d399" },
    { id: "gold", name: "Gold Luxe", accent: "#b45309", secondary: "#92400e", bgFrom: "#78350f", bgTo: "#fbbf24" },
    { id: "noir", name: "Noir", accent: "#18181b", secondary: "#27272a", bgFrom: "#09090b", bgTo: "#3f3f46" },
    { id: "rose", name: "Rosé", accent: "#be185d", secondary: "#9d174d", bgFrom: "#831843", bgTo: "#f472b6" },
    { id: "violet", name: "Violet", accent: "#7c3aed", secondary: "#6d28d9", bgFrom: "#4c1d95", bgTo: "#a78bfa" },
    { id: "crimson", name: "Crimson", accent: "#dc2626", secondary: "#b91c1c", bgFrom: "#7f1d1d", bgTo: "#f87171" },
    { id: "slate", name: "Slate Pro", accent: "#475569", secondary: "#334155", bgFrom: "#1e293b", bgTo: "#94a3b8" },
];

// ─── Template Category Labels ──────────────────────────────

const CATEGORY_LABELS: Record<TemplateCategory, { en: string; zh: string }> = {
    transaction: { en: "Transaction", zh: "交易类" },
    event: { en: "Events", zh: "活动类" },
    brand: { en: "Branding", zh: "品牌类" },
    social: { en: "Social", zh: "社交媒体" },
    holiday: { en: "Holiday", zh: "节日类" },
};

// ─── Templates ─────────────────────────────────────────────

import {
    User,
    BarChart3,
    Instagram,
    MessageCircle,
    Gift,
    Heart,
    HardHat,
    Clock,
} from "lucide-react";

const TEMPLATES: FlyerTemplate[] = [
    // ── Transaction ──
    {
        id: "just_listed", category: "transaction",
        name: "Just Listed", nameZh: "全新上市", icon: Home,
        color: "#2563eb", gradientFrom: "#1e40af", gradientTo: "#3b82f6",
        defaultHeadline: "JUST LISTED", defaultHeadlineZh: "全新上市",
        defaultSubtext: "Your dream home awaits", defaultSubtextZh: "您的梦想之家在此等候",
    },
    {
        id: "under_contract", category: "transaction",
        name: "Under Contract", nameZh: "已签约", icon: CheckCircle,
        color: "#d97706", gradientFrom: "#b45309", gradientTo: "#f59e0b",
        defaultHeadline: "UNDER CONTRACT", defaultHeadlineZh: "已签约待过户",
        defaultSubtext: "Another successful match", defaultSubtextZh: "又一次成功配对",
    },
    {
        id: "just_sold", category: "transaction",
        name: "Just Sold", nameZh: "成功售出", icon: DollarSign,
        color: "#16a34a", gradientFrom: "#15803d", gradientTo: "#22c55e",
        defaultHeadline: "JUST SOLD", defaultHeadlineZh: "成功售出",
        defaultSubtext: "Sold above asking price", defaultSubtextZh: "高于要价成交",
    },
    {
        id: "price_reduced", category: "transaction",
        name: "Price Reduced", nameZh: "价格下调", icon: TrendingDown,
        color: "#dc2626", gradientFrom: "#b91c1c", gradientTo: "#ef4444",
        defaultHeadline: "PRICE REDUCED", defaultHeadlineZh: "价格下调",
        defaultSubtext: "New price — exceptional value", defaultSubtextZh: "全新价格 — 超值之选",
    },
    {
        id: "coming_soon", category: "transaction",
        name: "Coming Soon", nameZh: "即将上市", icon: Clock,
        color: "#0891b2", gradientFrom: "#155e75", gradientTo: "#22d3ee",
        defaultHeadline: "COMING SOON", defaultHeadlineZh: "即将上市",
        defaultSubtext: "Be the first to know", defaultSubtextZh: "抢先了解",
    },
    // ── Events ──
    {
        id: "open_house", category: "event",
        name: "Open House", nameZh: "房屋开放日", icon: Calendar,
        color: "#7c3aed", gradientFrom: "#6d28d9", gradientTo: "#a78bfa",
        defaultHeadline: "OPEN HOUSE", defaultHeadlineZh: "房屋开放日",
        defaultSubtext: "You're invited to tour this stunning home", defaultSubtextZh: "诚邀您参观这套精美住宅",
    },
    {
        id: "new_construction", category: "event",
        name: "New Construction", nameZh: "新建楼盘", icon: HardHat,
        color: "#ea580c", gradientFrom: "#c2410c", gradientTo: "#fb923c",
        defaultHeadline: "NEW CONSTRUCTION", defaultHeadlineZh: "全新楼盘",
        defaultSubtext: "Modern living starts here", defaultSubtextZh: "现代生活从这里开始",
    },
    // ── Branding ──
    {
        id: "agent_intro", category: "brand",
        name: "Agent Introduction", nameZh: "个人介绍", icon: User,
        color: "#1e293b", gradientFrom: "#0f172a", gradientTo: "#475569",
        defaultHeadline: "YOUR TRUSTED AGENT", defaultHeadlineZh: "您信赖的经纪人",
        defaultSubtext: "Local expert, global reach", defaultSubtextZh: "立足本地 · 放眼全球",
        hidePropertyFields: true,
    },
    {
        id: "market_update", category: "brand",
        name: "Market Update", nameZh: "市场快报", icon: BarChart3,
        color: "#0d9488", gradientFrom: "#115e59", gradientTo: "#2dd4bf",
        defaultHeadline: "MARKET UPDATE", defaultHeadlineZh: "市场快报",
        defaultSubtext: "Monthly insights for informed decisions", defaultSubtextZh: "每月洞察 · 明智决策",
        hidePropertyFields: true,
    },
    // ── Social Media ──
    {
        id: "ig_story", category: "social",
        name: "Instagram Story", nameZh: "IG 快拍", icon: Instagram,
        color: "#e11d48", gradientFrom: "#9f1239", gradientTo: "#fb7185",
        defaultHeadline: "JUST LISTED ✨", defaultHeadlineZh: "✨ 新上市",
        defaultSubtext: "Swipe up for details", defaultSubtextZh: "上滑了解详情",
        defaultSize: "story",
    },
    {
        id: "wechat_moment", category: "social",
        name: "WeChat Moment", nameZh: "朋友圈图", icon: MessageCircle,
        color: "#16a34a", gradientFrom: "#166534", gradientTo: "#4ade80",
        defaultHeadline: "优质好房推荐", defaultHeadlineZh: "优质好房推荐",
        defaultSubtext: "Contact me for private viewing", defaultSubtextZh: "联系我安排私人看房",
        defaultSize: "square",
    },
    // ── Holiday ──
    {
        id: "cny_greeting", category: "holiday",
        name: "Chinese New Year", nameZh: "春节贺卡", icon: Gift,
        color: "#dc2626", gradientFrom: "#991b1b", gradientTo: "#fca5a5",
        defaultHeadline: "HAPPY NEW YEAR", defaultHeadlineZh: "新春快乐",
        defaultSubtext: "Wishing you prosperity and happiness", defaultSubtextZh: "恭祝您新年大吉 · 阖家幸福",
        hidePropertyFields: true,
    },
    {
        id: "thanksgiving", category: "holiday",
        name: "Thanksgiving", nameZh: "感恩节贺卡", icon: Heart,
        color: "#b45309", gradientFrom: "#78350f", gradientTo: "#fbbf24",
        defaultHeadline: "HAPPY THANKSGIVING", defaultHeadlineZh: "感恩节快乐",
        defaultSubtext: "Grateful for your trust and support", defaultSubtextZh: "感谢您的信任与支持",
        hidePropertyFields: true,
    },
];

// ─── Flyer Data ────────────────────────────────────────────

interface FlyerData {
    templateId: FlyerType;
    sizeKey: SizeKey;
    colorSchemeId: string;
    address: string;
    city: string;
    state: string;
    price: string;
    beds: string;
    baths: string;
    sqft: string;
    propertyType: string;
    headline: string;
    headlineZh: string;
    subtext: string;
    subtextZh: string;
    bodyText: string;
    bodyTextZh: string;
    agentName: string;
    agentTitle: string;
    agentPhone: string;
    agentEmail: string;
    brokerageName: string;
    openHouseDate: string;
    openHouseTime: string;
    accentColor: string;
    imageUrl: string;
    language: "en" | "zh" | "both";
}

const defaultFlyer: FlyerData = {
    templateId: "just_listed",
    sizeKey: "letter",
    colorSchemeId: "royal",
    address: "",
    city: "",
    state: "",
    price: "",
    beds: "",
    baths: "",
    sqft: "",
    propertyType: "Single Family",
    headline: "JUST LISTED",
    headlineZh: "全新上市",
    subtext: "Your dream home awaits",
    subtextZh: "您的梦想之家在此等候",
    bodyText: "",
    bodyTextZh: "",
    agentName: "",
    agentTitle: "REALTOR®",
    agentPhone: "",
    agentEmail: "",
    brokerageName: "",
    openHouseDate: "",
    openHouseTime: "",
    accentColor: "#2563eb",
    imageUrl: "",
    language: "both",
};


type MlsListing = {
    listingKey: string;
    unparsedAddress: string | null;
    city: string | null;
    stateOrProvince: string | null;
    listPrice: string | null;
    bedroomsTotal: number | null;
    bathroomsTotalInteger: number | null;
    livingArea: string | null;
    propertyType: string | null;
    publicRemarks: string | null;
    thumbnailUrl?: string | null;
    postalCode?: string | null;
    listingId?: string | null;
};

function formatPriceDisplay(price: string | null | undefined) {
    if (!price) return "";
    const num = Number(price);
    if (!Number.isFinite(num)) return price;
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
    }).format(num);
}

function formatPriceShort(price: string | null | undefined) {
    if (!price) return "";
    const num = Number(price);
    if (!Number.isFinite(num)) return price;
    if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(2)}M`;
    if (num >= 1_000) return `$${(num / 1_000).toFixed(0)}K`;
    return `$${num.toLocaleString()}`;
}

// ─── Component ─────────────────────────────────────────────

export default function FlyerStudio() {
    const { t } = useT();
    const { user } = useAuth();
    const [flyer, setFlyer] = useState<FlyerData>(defaultFlyer);
    const [generating, setGenerating] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [activeTab, setActiveTab] = useState("template");
    const [mlsSearch, setMlsSearch] = useState("");
    const flyerRef = useRef<HTMLDivElement>(null);

    const selectedTemplate = TEMPLATES.find((tmpl) => tmpl.id === flyer.templateId) ?? TEMPLATES[0];

    const updateFlyer = useCallback((updates: Partial<FlyerData>) => {
        setFlyer((prev) => ({ ...prev, ...updates }));
    }, []);

    // ── Agent Profile auto-fill ──
    const profileQuery = trpc.profile.getMine.useQuery(undefined, {
        refetchOnWindowFocus: false,
        retry: 1,
    });

    useEffect(() => {
        const p = profileQuery.data?.profile;
        if (!p) return;
        setFlyer((prev) => ({
            ...prev,
            agentName: prev.agentName || p.name || "",
            agentTitle: prev.agentTitle || p.title || "REALTOR®",
            agentPhone: prev.agentPhone || p.phone || "",
            agentEmail: prev.agentEmail || p.email || user?.email || "",
            brokerageName: prev.brokerageName || p.brokerage || "",
        }));
    }, [profileQuery.data, user]);

    // ── MLS search ──
    const mlsQuery = trpc.mls.getProperties.useQuery(
        { search: mlsSearch || undefined, limit: 12, offset: 0, status: "Active" },
        { enabled: mlsSearch.length > 1 }
    );
    const mlsResults = (mlsQuery.data ?? []) as MlsListing[];

    const selectListing = useCallback((listing: MlsListing) => {
        updateFlyer({
            address: listing.unparsedAddress || "",
            city: listing.city || "",
            state: listing.stateOrProvince || "",
            price: formatPriceDisplay(listing.listPrice),
            beds: listing.bedroomsTotal?.toString() || "",
            baths: listing.bathroomsTotalInteger?.toString() || "",
            sqft: listing.livingArea || "",
            propertyType: listing.propertyType || "Single Family",
            imageUrl: listing.thumbnailUrl || "",
        });
        setMlsSearch("");
        setActiveTab("copy");
        toast.success(t("flyerStudio.listingSelected"));
    }, [updateFlyer, t]);

    const selectTemplate = useCallback((template: FlyerTemplate) => {
        updateFlyer({
            templateId: template.id,
            headline: template.defaultHeadline,
            headlineZh: template.defaultHeadlineZh,
            subtext: template.defaultSubtext,
            subtextZh: template.defaultSubtextZh,
            accentColor: template.color,
            sizeKey: template.defaultSize || flyer.sizeKey,
        });
        setActiveTab(template.hidePropertyFields ? "copy" : "property");
    }, [updateFlyer, flyer.sizeKey]);

    const selectedSize = SIZES.find((s) => s.id === flyer.sizeKey) ?? SIZES[0];
    const selectedScheme = COLOR_SCHEMES.find((s) => s.id === flyer.colorSchemeId) ?? COLOR_SCHEMES[0];

    // ── AI Copy generation (real) ──
    const aiCopyMutation = trpc.smartMatch.analyzeForShare.useMutation({
        onSuccess: (data: Record<string, unknown>) => {
            const desc = typeof data.headerDescription === "string" ? data.headerDescription : "";
            const points = Array.isArray(data.strategyPoints) ? (data.strategyPoints as string[]) : [];
            const bodyEn = [desc, ...points].filter(Boolean).join("\n\n");

            // We'll set EN copy; ZH will be generated from the bilingual LLM response
            // Since analyzeForShare already outputs in the user's language, we split accordingly
            updateFlyer({
                bodyText: bodyEn,
                bodyTextZh: bodyEn, // The LLM outputs in the detected language
            });
            toast.success(t("flyerStudio.aiCopyGenerated"));
        },
        onError: (err) => {
            toast.error(t("flyerStudio.generateFailed"), { description: err.message });
        },
    });

    const generateAICopy = useCallback(async () => {
        if (!flyer.address) {
            toast.error(t("flyerStudio.enterAddress"));
            return;
        }
        setGenerating(true);
        try {
            await aiCopyMutation.mutateAsync({
                listings: [{
                    address: flyer.address,
                    price: flyer.price?.replace(/[^0-9.]/g, "") || undefined,
                    beds: flyer.beds || undefined,
                    baths: flyer.baths || undefined,
                    sqft: flyer.sqft || undefined,
                    propertyType: flyer.propertyType || undefined,
                    city: flyer.city || undefined,
                }],
                clientNeeds: `Generate marketing flyer copy for a "${selectedTemplate.name}" flyer. Type: ${flyer.propertyType}. Make it compelling and concise for a single-property marketing flyer. Include both English and Chinese versions separated by "---".`,
            });
        } finally {
            setGenerating(false);
        }
    }, [flyer, aiCopyMutation, selectedTemplate, t]);


    // ── Derived state ──
    const isReady = useMemo(() => {
        const hasAgent = flyer.agentName.trim().length > 0;
        if (selectedTemplate.hidePropertyFields) return hasAgent;
        return flyer.address.trim().length > 0 && hasAgent;
    }, [flyer.address, flyer.agentName, selectedTemplate]);

    const templatesByCategory = useMemo(() => {
        const groups: Record<string, FlyerTemplate[]> = {};
        for (const tmpl of TEMPLATES) {
            (groups[tmpl.category] ??= []).push(tmpl);
        }
        return groups;
    }, []);

    // ── Phase 3: Persistence ──
    const [flyerId, setFlyerId] = useState<number | null>(null);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [sharing, setSharing] = useState(false);

    const savedFlyersQuery = trpc.flyer.list.useQuery({ limit: 20, offset: 0 }, {
        refetchOnWindowFocus: false,
        retry: 1,
    });
    const savedFlyers = savedFlyersQuery.data ?? [];

    const saveMutation = trpc.flyer.save.useMutation({
        onSuccess: (data) => {
            setFlyerId(data.id);
            toast.success(t("flyerStudio.saved"));
            savedFlyersQuery.refetch();
        },
        onError: (err) => toast.error(t("flyerStudio.saveFailed"), { description: err.message }),
    });

    const uploadMutation = trpc.flyer.uploadExport.useMutation({
        onSuccess: (data) => {
            toast.success(t("flyerStudio.uploadSuccess"));
            savedFlyersQuery.refetch();
            return data;
        },
        onError: (err) => toast.error(t("flyerStudio.uploadFailed"), { description: err.message }),
    });

    const shareMutation = trpc.flyer.share.useMutation({
        onSuccess: (data) => {
            toast.success(t("flyerStudio.shareCreated"), { description: data.shareUrl });
            savedFlyersQuery.refetch();
        },
        onError: (err) => toast.error(t("flyerStudio.shareFailed"), { description: err.message }),
    });

    const deleteMutation = trpc.flyer.delete.useMutation({
        onSuccess: () => {
            toast.success(t("flyerStudio.deleted"));
            savedFlyersQuery.refetch();
            if (flyerId) {
                setFlyerId(null);
                setFlyer(defaultFlyer);
            }
        },
    });

    const handleSave = useCallback(async () => {
        setSaving(true);
        try {
            const title = flyer.headline || flyer.address || selectedTemplate.name;
            await saveMutation.mutateAsync({
                id: flyerId ?? undefined,
                title,
                templateId: flyer.templateId,
                sizeKey: flyer.sizeKey,
                flyerData: flyer as unknown as Record<string, unknown>,
            });
        } finally {
            setSaving(false);
        }
    }, [flyer, flyerId, selectedTemplate, saveMutation]);

    const handleExportAndUpload = useCallback(async () => {
        if (!flyerRef.current) return;
        setExporting(true);
        setUploading(true);
        try {
            const el = flyerRef.current;
            const w = el.offsetWidth;
            const ratio = selectedSize.width / w;
            const dataUrl = await toPng(el, {
                pixelRatio: ratio,
                cacheBust: true,
                backgroundColor: "#ffffff",
            });

            // 1. Download locally
            const link = document.createElement("a");
            const fileName = `${selectedTemplate.name.replace(/\s+/g, "_")}_${selectedSize.id}_${flyer.address?.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 30) || "flyer"}.png`;
            link.download = fileName;
            link.href = dataUrl;
            link.click();

            // 2. Save draft first if not saved
            let currentFlyerId = flyerId;
            if (!currentFlyerId) {
                const title = flyer.headline || flyer.address || selectedTemplate.name;
                const saved = await saveMutation.mutateAsync({
                    title,
                    templateId: flyer.templateId,
                    sizeKey: flyer.sizeKey,
                    flyerData: flyer as unknown as Record<string, unknown>,
                });
                currentFlyerId = saved.id;
                setFlyerId(saved.id);
            }

            // 3. Upload to R2
            const base64Data = dataUrl.split(",")[1];
            if (base64Data && currentFlyerId) {
                await uploadMutation.mutateAsync({
                    flyerId: currentFlyerId,
                    base64Data,
                    mimeType: "image/png",
                });
            }

            toast.success(t("flyerStudio.exportSuccess"));
        } catch (err) {
            console.error("Export failed:", err);
            toast.error(t("flyerStudio.exportFailed"));
        } finally {
            setExporting(false);
            setUploading(false);
        }
    }, [flyer, flyerId, selectedTemplate, selectedSize, saveMutation, uploadMutation, t]);

    const handleShare = useCallback(async () => {
        if (!flyerId) {
            toast.error(t("flyerStudio.saveFirst"));
            return;
        }
        setSharing(true);
        try {
            await shareMutation.mutateAsync({ flyerId });
        } finally {
            setSharing(false);
        }
    }, [flyerId, shareMutation, t]);

    // When flyerId changes and we need to load
    const getFlyerDirect = trpc.flyer.get.useQuery(
        { id: flyerId! },
        { enabled: !!flyerId && !flyer.address && flyerId !== (saveMutation.data as { id?: number } | undefined)?.id }
    );

    useEffect(() => {
        if (getFlyerDirect.data && flyerId) {
            const fd = getFlyerDirect.data.flyerData as FlyerData;
            if (fd && fd.templateId) {
                setFlyer(fd);
            }
        }
    }, [getFlyerDirect.data, flyerId]);

    return (
        <div className="space-y-6 pb-8">
            {/* Hero Header */}
            <div className="rounded-3xl border border-primary/10 bg-gradient-to-br from-primary/5 via-primary/2 to-transparent p-6 text-foreground shadow-sm md:p-8">
                <div className="flex items-center gap-2 text-sm text-primary">
                    <FileText className="h-4 w-4" />
                    {t("flyerStudio.heroBadge")}
                </div>
                <h1 className="mt-2 text-3xl font-serif tracking-tight md:text-4xl">{t("flyerStudio.title")}</h1>
                <p className="mt-3 max-w-3xl text-sm text-muted-foreground md:text-base">
                    {t("flyerStudio.subtitle")}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                        size="sm"
                        variant="outline"
                        disabled={saving}
                        onClick={handleSave}
                    >
                        {saving ? (
                            <><Loader2 className="mr-1 h-4 w-4 animate-spin" /> {t("flyerStudio.saving")}</>
                        ) : (
                            <><Save className="mr-1 h-4 w-4" /> {t("flyerStudio.save")}</>
                        )}
                    </Button>
                    <Button
                        size="sm"
                        disabled={!isReady || exporting || uploading}
                        onClick={handleExportAndUpload}
                        style={{ backgroundColor: selectedTemplate.color }}
                    >
                        {exporting ? (
                            <><Loader2 className="mr-1 h-4 w-4 animate-spin" /> {uploading ? t("flyerStudio.uploading") : t("flyerStudio.exporting")}</>
                        ) : (
                            <><Download className="mr-1 h-4 w-4" /> {t("flyerStudio.exportAndUpload")}</>
                        )}
                    </Button>
                    <Button
                        size="sm"
                        variant="secondary"
                        disabled={!flyerId || sharing}
                        onClick={handleShare}
                    >
                        {sharing ? (
                            <><Loader2 className="mr-1 h-4 w-4 animate-spin" /> {t("flyerStudio.sharing")}</>
                        ) : (
                            <><Share2 className="mr-1 h-4 w-4" /> {t("flyerStudio.shareToHub")}</>
                        )}
                    </Button>
                </div>
            </div>

            {/* Saved Drafts Strip */}
            {savedFlyers.length > 0 && (
                <div className="rounded-xl border bg-card p-3">
                    <div className="mb-2 flex items-center justify-between">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            {t("flyerStudio.savedDrafts")} ({savedFlyers.length})
                        </p>
                        <Button variant="ghost" size="sm" className="text-xs" onClick={() => { setFlyerId(null); setFlyer(defaultFlyer); }}>
                            <Plus className="mr-1 h-3 w-3" /> {t("flyerStudio.newFlyer")}
                        </Button>
                    </div>
                    <ScrollArea className="max-h-[120px]">
                        <div className="flex gap-2 overflow-x-auto pb-1">
                            {savedFlyers.map((sf) => {
                                const isActive = flyerId === sf.id;
                                return (
                                    <button
                                        key={sf.id}
                                        className={`group flex min-w-[140px] shrink-0 items-center gap-2 rounded-lg border p-2 text-left text-xs transition hover:bg-muted/50 ${
                                            isActive ? "border-primary bg-primary/5" : "border-transparent"
                                        }`}
                                        onClick={() => {
                                            setFlyerId(sf.id);
                                            // Will trigger getFlyerDirect
                                        }}
                                    >
                                        {sf.thumbnailUrl ? (
                                            <img src={sf.thumbnailUrl} alt="" className="h-10 w-8 rounded border object-cover" />
                                        ) : (
                                            <div className="flex h-10 w-8 items-center justify-center rounded border bg-muted">
                                                <FileText className="h-3 w-3 text-muted-foreground" />
                                            </div>
                                        )}
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate font-medium">{sf.title}</p>
                                            <div className="flex items-center gap-1">
                                                <Badge variant={sf.status === "shared" ? "default" : sf.status === "exported" ? "secondary" : "outline"} className="text-[9px] px-1 py-0">
                                                    {sf.status}
                                                </Badge>
                                            </div>
                                        </div>
                                        <button
                                            className="opacity-0 group-hover:opacity-100 transition text-muted-foreground hover:text-destructive"
                                            onClick={(e) => { e.stopPropagation(); deleteMutation.mutate({ id: sf.id }); }}
                                        >
                                            <Trash2 className="h-3 w-3" />
                                        </button>
                                    </button>
                                );
                            })}
                        </div>
                    </ScrollArea>
                </div>
            )}

            {/* Main Layout: Editor + Preview */}
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                {/* Left: Editor Panel */}
                <div className="space-y-4">
                    <Tabs value={activeTab} onValueChange={setActiveTab}>
                        <TabsList className="grid w-full grid-cols-5">
                            <TabsTrigger value="template">
                                <Palette className="mr-1 h-4 w-4" /> {t("flyerStudio.templateTab")}
                            </TabsTrigger>
                            <TabsTrigger value="design">
                                <Sparkles className="mr-1 h-4 w-4" /> {t("flyerStudio.designTab")}
                            </TabsTrigger>
                            <TabsTrigger value="property">
                                <Home className="mr-1 h-4 w-4" /> {t("flyerStudio.propertyTab")}
                            </TabsTrigger>
                            <TabsTrigger value="copy">
                                <Type className="mr-1 h-4 w-4" /> {t("flyerStudio.copyTab")}
                            </TabsTrigger>
                            <TabsTrigger value="agent">
                                <FileText className="mr-1 h-4 w-4" /> {t("flyerStudio.agentTab")}
                            </TabsTrigger>
                        </TabsList>

                        {/* Template Selection — grouped by category */}
                        <TabsContent value="template" className="space-y-4">
                            {(Object.keys(CATEGORY_LABELS) as TemplateCategory[]).map((cat) => {
                                const templates = templatesByCategory[cat];
                                if (!templates?.length) return null;
                                const label = CATEGORY_LABELS[cat];
                                return (
                                    <div key={cat}>
                                        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                            {label.en} · {label.zh}
                                        </p>
                                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                            {templates.map((template) => {
                                                const Icon = template.icon;
                                                const isSelected = flyer.templateId === template.id;
                                                return (
                                                    <Card
                                                        key={template.id}
                                                        className={`cursor-pointer transition-all hover:shadow-md ${isSelected ? "ring-2 ring-offset-2" : ""}`}
                                                        style={isSelected ? { borderColor: template.color, ["--tw-ring-color" as string]: template.color } : {}}
                                                        onClick={() => selectTemplate(template)}
                                                    >
                                                        <CardContent className="flex items-center gap-3 p-3">
                                                            <div
                                                                className="flex h-9 w-9 items-center justify-center rounded-lg text-white"
                                                                style={{ background: `linear-gradient(135deg, ${template.gradientFrom}, ${template.gradientTo})` }}
                                                            >
                                                                <Icon className="h-4 w-4" />
                                                            </div>
                                                            <div className="min-w-0 flex-1">
                                                                <p className="truncate text-sm font-medium">{template.name}</p>
                                                                <p className="truncate text-xs text-muted-foreground">{template.nameZh}</p>
                                                            </div>
                                                            {isSelected && (
                                                                <Badge variant="secondary" className="shrink-0 text-xs">
                                                                    {t("flyerStudio.active")}
                                                                </Badge>
                                                            )}
                                                        </CardContent>
                                                    </Card>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </TabsContent>

                        {/* Design Tab — Size + Color Scheme */}
                        <TabsContent value="design" className="space-y-4">
                            {/* Size Selector */}
                            <div>
                                <Label className="mb-2 block text-sm font-semibold">{t("flyerStudio.sizeLabel")}</Label>
                                <div className="grid grid-cols-5 gap-2">
                                    {SIZES.map((size) => {
                                        const isActive = flyer.sizeKey === size.id;
                                        return (
                                            <button
                                                key={size.id}
                                                className={`flex flex-col items-center gap-1 rounded-lg border-2 p-2.5 text-center transition-all hover:border-primary/50 ${
                                                    isActive ? "border-primary bg-primary/5 shadow-sm" : "border-transparent bg-muted/30"
                                                }`}
                                                onClick={() => updateFlyer({ sizeKey: size.id })}
                                            >
                                                <div
                                                    className={`rounded border bg-muted/50 ${
                                                        size.id === "letter" ? "h-8 w-6" :
                                                        size.id === "square" ? "h-7 w-7" :
                                                        size.id === "story" ? "h-9 w-5" :
                                                        size.id === "landscape" ? "h-5 w-9" :
                                                        "h-5 w-7"
                                                    }`}
                                                    style={isActive ? { borderColor: flyer.accentColor, backgroundColor: flyer.accentColor + "15" } : {}}
                                                />
                                                <span className="text-xs font-medium">{size.name}</span>
                                                <span className="text-[10px] text-muted-foreground">{size.nameZh}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                                <p className="mt-1 text-xs text-muted-foreground">
                                    {selectedSize.desc} · {selectedSize.width}×{selectedSize.height}px
                                </p>
                            </div>

                            {/* Color Scheme */}
                            <div>
                                <Label className="mb-2 block text-sm font-semibold">{t("flyerStudio.colorSchemeLabel")}</Label>
                                <div className="grid grid-cols-4 gap-2">
                                    {COLOR_SCHEMES.map((scheme) => {
                                        const isActive = flyer.colorSchemeId === scheme.id;
                                        return (
                                            <button
                                                key={scheme.id}
                                                className={`flex flex-col items-center gap-1 rounded-lg border-2 p-2 transition-all hover:shadow-sm ${
                                                    isActive ? "border-primary shadow-sm" : "border-transparent"
                                                }`}
                                                onClick={() => updateFlyer({
                                                    colorSchemeId: scheme.id,
                                                    accentColor: scheme.accent,
                                                })}
                                            >
                                                <div className="flex gap-0.5">
                                                    <div className="h-5 w-5 rounded-full" style={{ backgroundColor: scheme.accent }} />
                                                    <div className="h-5 w-5 rounded-full" style={{ backgroundColor: scheme.secondary }} />
                                                    <div className="h-5 w-5 rounded-full" style={{ background: `linear-gradient(135deg, ${scheme.bgFrom}, ${scheme.bgTo})` }} />
                                                </div>
                                                <span className="text-xs">{scheme.name}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Custom Accent Override */}
                            <div>
                                <Label className="mb-1 text-sm">{t("flyerStudio.accentLabel")}</Label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="color"
                                        value={flyer.accentColor}
                                        onChange={(e) => updateFlyer({ accentColor: e.target.value })}
                                        className="h-9 w-9 cursor-pointer rounded border"
                                    />
                                    <Input value={flyer.accentColor} onChange={(e) => updateFlyer({ accentColor: e.target.value })} className="w-28 font-mono text-sm" />
                                </div>
                            </div>
                        </TabsContent>

                        {/* Property Details — with MLS search */}
                        <TabsContent value="property" className="space-y-4">
                            {/* MLS Search */}
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="flex items-center gap-2 text-sm">
                                        <Search className="h-4 w-4" />
                                        {t("flyerStudio.mlsSearch")}
                                    </CardTitle>
                                    <CardDescription className="text-xs">{t("flyerStudio.mlsSearchHint")}</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                        <Input
                                            className="pl-10"
                                            value={mlsSearch}
                                            onChange={(e) => setMlsSearch(e.target.value)}
                                            placeholder={t("flyerStudio.mlsSearchPlaceholder")}
                                        />
                                    </div>
                                    {mlsSearch.length > 1 && (
                                        <ScrollArea className="max-h-[280px]">
                                            <div className="space-y-2">
                                                {mlsQuery.isLoading ? (
                                                    <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                        {t("flyerStudio.searching")}
                                                    </div>
                                                ) : mlsResults.length === 0 ? (
                                                    <p className="py-4 text-sm text-muted-foreground">{t("flyerStudio.noResults")}</p>
                                                ) : (
                                                    mlsResults.map((listing) => (
                                                        <div
                                                            key={listing.listingKey}
                                                            className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition hover:bg-muted/50"
                                                            onClick={() => selectListing(listing)}
                                                        >
                                                            {listing.thumbnailUrl ? (
                                                                <img
                                                                    src={listing.thumbnailUrl}
                                                                    alt=""
                                                                    className="h-16 w-20 rounded-md border object-cover"
                                                                />
                                                            ) : (
                                                                <div className="flex h-16 w-20 items-center justify-center rounded-md border bg-muted/30">
                                                                    <ImageIcon className="h-5 w-5 text-muted-foreground/40" />
                                                                </div>
                                                            )}
                                                            <div className="min-w-0 flex-1">
                                                                <p className="truncate text-sm font-medium">
                                                                    {listing.unparsedAddress || listing.listingId || listing.listingKey}
                                                                </p>
                                                                <p className="text-xs text-muted-foreground">
                                                                    {formatPriceShort(listing.listPrice)} · {listing.city}
                                                                </p>
                                                                <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                                                                    {listing.bedroomsTotal != null && (
                                                                        <span className="inline-flex items-center gap-0.5"><BedDouble className="h-3 w-3" />{listing.bedroomsTotal}</span>
                                                                    )}
                                                                    {listing.bathroomsTotalInteger != null && (
                                                                        <span className="inline-flex items-center gap-0.5"><Bath className="h-3 w-3" />{listing.bathroomsTotalInteger}</span>
                                                                    )}
                                                                    {listing.livingArea && (
                                                                        <span className="inline-flex items-center gap-0.5"><Ruler className="h-3 w-3" />{Number(listing.livingArea).toLocaleString()} sqft</span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <Button size="sm" variant="outline" className="shrink-0">
                                                                <Plus className="mr-1 h-3 w-3" /> {t("flyerStudio.use")}
                                                            </Button>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        </ScrollArea>
                                    )}
                                </CardContent>
                            </Card>

                            {/* Manual fields */}
                            <div className="space-y-3">
                                <div>
                                    <Label>{t("flyerStudio.addressLabel")}</Label>
                                    <Input value={flyer.address} onChange={(e) => updateFlyer({ address: e.target.value })} placeholder="123 Main Street" />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <Label>{t("flyerStudio.cityLabel")}</Label>
                                        <Input value={flyer.city} onChange={(e) => updateFlyer({ city: e.target.value })} placeholder="San Francisco" />
                                    </div>
                                    <div>
                                        <Label>{t("flyerStudio.stateLabel")}</Label>
                                        <Input value={flyer.state} onChange={(e) => updateFlyer({ state: e.target.value })} placeholder="CA" />
                                    </div>
                                </div>
                                <div>
                                    <Label>{t("flyerStudio.priceLabel")}</Label>
                                    <Input value={flyer.price} onChange={(e) => updateFlyer({ price: e.target.value })} placeholder="$1,250,000" />
                                </div>
                                <div className="grid grid-cols-3 gap-3">
                                    <div>
                                        <Label>{t("flyerStudio.bedsLabel")}</Label>
                                        <Input value={flyer.beds} onChange={(e) => updateFlyer({ beds: e.target.value })} placeholder="4" />
                                    </div>
                                    <div>
                                        <Label>{t("flyerStudio.bathsLabel")}</Label>
                                        <Input value={flyer.baths} onChange={(e) => updateFlyer({ baths: e.target.value })} placeholder="3" />
                                    </div>
                                    <div>
                                        <Label>{t("flyerStudio.sqftLabel")}</Label>
                                        <Input value={flyer.sqft} onChange={(e) => updateFlyer({ sqft: e.target.value })} placeholder="2,400" />
                                    </div>
                                </div>
                                <div>
                                    <Label>{t("flyerStudio.typeLabel")}</Label>
                                    <Select value={flyer.propertyType} onValueChange={(v) => updateFlyer({ propertyType: v })}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Single Family">{t("flyerStudio.singleFamily")}</SelectItem>
                                            <SelectItem value="Condo">{t("flyerStudio.condo")}</SelectItem>
                                            <SelectItem value="Townhouse">{t("flyerStudio.townhouse")}</SelectItem>
                                            <SelectItem value="Multi-Family">{t("flyerStudio.multiFamily")}</SelectItem>
                                            <SelectItem value="Land">{t("flyerStudio.land")}</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                {flyer.templateId === "open_house" && (
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <Label>{t("flyerStudio.dateLabel")}</Label>
                                            <Input type="date" value={flyer.openHouseDate} onChange={(e) => updateFlyer({ openHouseDate: e.target.value })} />
                                        </div>
                                        <div>
                                            <Label>{t("flyerStudio.timeLabel")}</Label>
                                            <Input value={flyer.openHouseTime} onChange={(e) => updateFlyer({ openHouseTime: e.target.value })} placeholder="1:00 PM - 4:00 PM" />
                                        </div>
                                    </div>
                                )}
                                <div>
                                    <Label>{t("flyerStudio.photoLabel")}</Label>
                                    <Input value={flyer.imageUrl} onChange={(e) => updateFlyer({ imageUrl: e.target.value })} placeholder="https://..." />
                                </div>
                            </div>
                        </TabsContent>

                        {/* Copy / Text */}
                        <TabsContent value="copy" className="space-y-3">
                            <div className="flex items-center justify-between">
                                <Label className="flex items-center gap-1">
                                    <Languages className="h-4 w-4" /> {t("flyerStudio.languageLabel")}
                                </Label>
                                <Select value={flyer.language} onValueChange={(v) => updateFlyer({ language: v as "en" | "zh" | "both" })}>
                                    <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="both">{t("flyerStudio.bothLang")}</SelectItem>
                                        <SelectItem value="en">English</SelectItem>
                                        <SelectItem value="zh">中文</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <Label>{t("flyerStudio.headlineLabel")}</Label>
                                <Input value={flyer.headline} onChange={(e) => updateFlyer({ headline: e.target.value })} />
                                {(flyer.language === "zh" || flyer.language === "both") && (
                                    <Input className="mt-1" value={flyer.headlineZh} onChange={(e) => updateFlyer({ headlineZh: e.target.value })} placeholder={t("flyerStudio.headlineZhPlaceholder")} />
                                )}
                            </div>
                            <div>
                                <Label>{t("flyerStudio.subtextLabel")}</Label>
                                <Input value={flyer.subtext} onChange={(e) => updateFlyer({ subtext: e.target.value })} />
                                {(flyer.language === "zh" || flyer.language === "both") && (
                                    <Input className="mt-1" value={flyer.subtextZh} onChange={(e) => updateFlyer({ subtextZh: e.target.value })} placeholder={t("flyerStudio.subtextZhPlaceholder")} />
                                )}
                            </div>
                            <div>
                                <div className="mb-1 flex items-center justify-between">
                                    <Label>{t("flyerStudio.bodyLabel")}</Label>
                                    <Button variant="outline" size="sm" onClick={generateAICopy} disabled={generating}>
                                        {generating ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1 h-4 w-4" />}
                                        {t("flyerStudio.aiGenerate")}
                                    </Button>
                                </div>
                                <Textarea rows={3} value={flyer.bodyText} onChange={(e) => updateFlyer({ bodyText: e.target.value })} placeholder={t("flyerStudio.bodyPlaceholder")} />
                                {(flyer.language === "zh" || flyer.language === "both") && (
                                    <Textarea className="mt-1" rows={3} value={flyer.bodyTextZh} onChange={(e) => updateFlyer({ bodyTextZh: e.target.value })} placeholder={t("flyerStudio.bodyZhPlaceholder")} />
                                )}
                            </div>
                        </TabsContent>

                        {/* Agent Info */}
                        <TabsContent value="agent" className="space-y-3">
                            {profileQuery.isLoading && (
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    {t("flyerStudio.loadingProfile")}
                                </div>
                            )}
                            <div>
                                <Label>{t("flyerStudio.agentNameLabel")}</Label>
                                <Input value={flyer.agentName} onChange={(e) => updateFlyer({ agentName: e.target.value })} placeholder="Jane Smith" />
                            </div>
                            <div>
                                <Label>{t("flyerStudio.titleLabel")}</Label>
                                <Input value={flyer.agentTitle} onChange={(e) => updateFlyer({ agentTitle: e.target.value })} placeholder="REALTOR®" />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <Label>{t("flyerStudio.phoneLabel")}</Label>
                                    <Input value={flyer.agentPhone} onChange={(e) => updateFlyer({ agentPhone: e.target.value })} placeholder="(415) 555-0123" />
                                </div>
                                <div>
                                    <Label>{t("flyerStudio.emailLabel")}</Label>
                                    <Input value={flyer.agentEmail} onChange={(e) => updateFlyer({ agentEmail: e.target.value })} placeholder="jane@realty.com" />
                                </div>
                            </div>
                            <div>
                                <Label>{t("flyerStudio.brokerageLabel")}</Label>
                                <Input value={flyer.brokerageName} onChange={(e) => updateFlyer({ brokerageName: e.target.value })} placeholder="Open Realty Group" />
                            </div>
                        </TabsContent>
                    </Tabs>
                </div>

                {/* Right: Live Preview */}
                <div className="xl:sticky xl:top-4">
                    <Card className="overflow-hidden">
                        <CardHeader className="flex-row items-center justify-between border-b p-3">
                            <div className="flex items-center gap-2">
                                <CardTitle className="flex items-center gap-1 text-sm">
                                    <Eye className="h-4 w-4" /> {t("flyerStudio.livePreview")}
                                </CardTitle>
                                <Badge variant="outline" className="text-[10px]">{selectedSize.name} {selectedSize.desc}</Badge>
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={!isReady || exporting}
                                onClick={handleExportAndUpload}
                            >
                                {exporting ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Download className="mr-1 h-3.5 w-3.5" />}
                                PNG
                            </Button>
                        </CardHeader>
                        <CardContent className="p-0">
                            <FlyerPreview ref={flyerRef} flyer={flyer} template={selectedTemplate} size={selectedSize} />
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}

// ─── Flyer Preview Component ───────────────────────────────

import { forwardRef } from "react";

const FlyerPreview = forwardRef<HTMLDivElement, { flyer: FlyerData; template: FlyerTemplate; size: FlyerSize }>(
    function FlyerPreview({ flyer, template, size }, ref) {
        const showZh = flyer.language === "zh" || flyer.language === "both";
        const showEn = flyer.language === "en" || flyer.language === "both";
        const isCompact = size.id === "story" || size.id === "square";

        return (
            <div
                ref={ref}
                className="relative w-full overflow-hidden"
                style={{
                    aspectRatio: size.aspect,
                    fontFamily: "var(--font-sans, 'Geist Sans'), ui-sans-serif, system-ui, sans-serif",
                }}
            >
                {/* Background Image / Gradient */}
                <div className="absolute inset-0">
                    {flyer.imageUrl ? (
                        <img src={flyer.imageUrl} alt="Property" className="h-full w-full object-cover" crossOrigin="anonymous" />
                    ) : (
                        <div
                            className="h-full w-full"
                            style={{
                                background: `linear-gradient(135deg, ${template.gradientFrom}22, ${template.gradientTo}44)`,
                            }}
                        />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/70" />
                </div>

                {/* Content */}
                <div className="relative z-10 flex h-full flex-col justify-between p-6">
                    <div>
                        <div
                            className="inline-block rounded-md px-4 py-2 text-lg font-black tracking-wider text-white"
                            style={{ backgroundColor: flyer.accentColor, fontFamily: "var(--font-serif, 'DM Serif Display'), serif" }}
                        >
                            {showEn && flyer.headline}
                            {showEn && showZh && " · "}
                            {showZh && flyer.headlineZh}
                        </div>
                        {(flyer.subtext || flyer.subtextZh) && (
                            <p className="mt-2 text-sm font-medium text-white/90 drop-shadow">
                                {showEn && flyer.subtext}
                                {showEn && showZh && <br />}
                                {showZh && flyer.subtextZh}
                            </p>
                        )}
                    </div>

                    {flyer.templateId === "open_house" && (flyer.openHouseDate || flyer.openHouseTime) && (
                        <div className="rounded-lg bg-white/95 p-4 text-center shadow-lg backdrop-blur">
                            {flyer.openHouseDate && (
                                <p className="text-lg font-bold" style={{ color: flyer.accentColor }}>
                                    {new Date(flyer.openHouseDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                                </p>
                            )}
                            {flyer.openHouseTime && <p className="text-sm text-gray-600">{flyer.openHouseTime}</p>}
                        </div>
                    )}

                    <div className="space-y-3">
                        <div className="rounded-lg bg-white/95 p-4 shadow-lg backdrop-blur">
                            {flyer.address && <p className="text-sm font-bold text-gray-900">{flyer.address}</p>}
                            {(flyer.city || flyer.state) && (
                                <p className="text-xs text-gray-500">{[flyer.city, flyer.state].filter(Boolean).join(", ")}</p>
                            )}
                            {flyer.price && (
                                <p className="mt-1 text-xl font-black" style={{ color: flyer.accentColor }}>{flyer.price}</p>
                            )}
                            <div className="mt-2 flex gap-4 text-xs text-gray-600">
                                {flyer.beds && <span><strong>{flyer.beds}</strong> {showZh ? "卧" : "Beds"}</span>}
                                {flyer.baths && <span><strong>{flyer.baths}</strong> {showZh ? "浴" : "Baths"}</span>}
                                {flyer.sqft && <span><strong>{flyer.sqft}</strong> {showZh ? "平方英尺" : "Sq Ft"}</span>}
                                {flyer.propertyType && <span>{flyer.propertyType}</span>}
                            </div>
                            {(flyer.bodyText || flyer.bodyTextZh) && (
                                <div className="mt-2 line-clamp-3 text-xs leading-relaxed text-gray-600">
                                    {showEn && flyer.bodyText}
                                    {showEn && showZh && <br />}
                                    {showZh && <span className="text-gray-500">{flyer.bodyTextZh}</span>}
                                </div>
                            )}
                        </div>

                        {flyer.agentName && (
                            <div
                                className="flex items-center gap-3 rounded-lg p-3 text-white"
                                style={{ backgroundColor: flyer.accentColor }}
                            >
                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-lg font-bold">
                                    {flyer.agentName.charAt(0)}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-bold">{flyer.agentName}</p>
                                    <p className="truncate text-xs opacity-80">{flyer.agentTitle}</p>
                                    <div className="mt-0.5 flex gap-3 text-xs opacity-80">
                                        {flyer.agentPhone && <span>{flyer.agentPhone}</span>}
                                        {flyer.agentEmail && <span>{flyer.agentEmail}</span>}
                                    </div>
                                </div>
                                {flyer.brokerageName && (
                                    <p className="text-right text-xs opacity-70">{flyer.brokerageName}</p>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }
);
