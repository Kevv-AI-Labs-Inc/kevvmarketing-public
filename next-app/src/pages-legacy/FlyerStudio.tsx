// legacy page — incrementally migrated
"use client";
/**
 * Flyer Studio — AI-Powered Real Estate Marketing Flyer Generator
 *
 * Core feature for real estate agents to create professional flyers for:
 * - Just Listed → new property on market
 * - Under Contract → pending sale
 * - Just Sold → celebrate closings
 * - Open House → invite buyers
 * - Price Reduced → attract attention
 *
 * Uses AI for bilingual copy (EN/ZH) and image enhancement.
 */

import { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
    Share2,
    Palette,
    Type,
    ImagePlus,
    Loader2,
    Eye,
    Copy,
    Languages,
} from "lucide-react";
import { toast } from "sonner";

// ─── Template Types ────────────────────────────────────────

type FlyerType = "just_listed" | "under_contract" | "just_sold" | "open_house" | "price_reduced";

interface FlyerTemplate {
    id: FlyerType;
    name: string;
    nameZhKey: string;
    icon: React.ElementType;
    color: string;
    gradientFrom: string;
    gradientTo: string;
    defaultHeadline: string;
    defaultHeadlineZh: string;
    defaultSubtext: string;
    defaultSubtextZh: string;
}

const TEMPLATES: FlyerTemplate[] = [
    {
        id: "just_listed",
        name: "Just Listed",
        nameZhKey: "flyerStudio.justListedZh",
        icon: Home,
        color: "#2563eb",
        gradientFrom: "#1e40af",
        gradientTo: "#3b82f6",
        defaultHeadline: "JUST LISTED",
        defaultHeadlineZh: "全新上市",
        defaultSubtext: "Your dream home awaits",
        defaultSubtextZh: "您的梦想之家在此等候",
    },
    {
        id: "under_contract",
        name: "Under Contract",
        nameZhKey: "flyerStudio.underContractZh",
        icon: CheckCircle,
        color: "#d97706",
        gradientFrom: "#b45309",
        gradientTo: "#f59e0b",
        defaultHeadline: "UNDER CONTRACT",
        defaultHeadlineZh: "已签约待过户",
        defaultSubtext: "Another successful match",
        defaultSubtextZh: "又一次成功配对",
    },
    {
        id: "just_sold",
        name: "Just Sold",
        nameZhKey: "flyerStudio.justSoldZh",
        icon: DollarSign,
        color: "#16a34a",
        gradientFrom: "#15803d",
        gradientTo: "#22c55e",
        defaultHeadline: "JUST SOLD",
        defaultHeadlineZh: "成功售出",
        defaultSubtext: "Sold above asking price",
        defaultSubtextZh: "高于要价成交",
    },
    {
        id: "open_house",
        name: "Open House",
        nameZhKey: "flyerStudio.openHouseZh",
        icon: Calendar,
        color: "#7c3aed",
        gradientFrom: "#6d28d9",
        gradientTo: "#a78bfa",
        defaultHeadline: "OPEN HOUSE",
        defaultHeadlineZh: "房屋开放日",
        defaultSubtext: "You're invited to tour this stunning home",
        defaultSubtextZh: "诚邀您参观这套精美住宅",
    },
    {
        id: "price_reduced",
        name: "Price Reduced",
        nameZhKey: "flyerStudio.priceReducedZh",
        icon: TrendingDown,
        color: "#dc2626",
        gradientFrom: "#b91c1c",
        gradientTo: "#ef4444",
        defaultHeadline: "PRICE REDUCED",
        defaultHeadlineZh: "价格下调",
        defaultSubtext: "New price — exceptional value",
        defaultSubtextZh: "全新价格 — 超值之选",
    },
];

// ─── Flyer Data ────────────────────────────────────────────

interface FlyerData {
    templateId: FlyerType;
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

// ─── Component ─────────────────────────────────────────────

export default function FlyerStudio() {
    const { t } = useT();
    const [flyer, setFlyer] = useState<FlyerData>(defaultFlyer);
    const [generating, setGenerating] = useState(false);
    const [activeTab, setActiveTab] = useState("template");

    const selectedTemplate = TEMPLATES.find((tmpl) => tmpl.id === flyer.templateId) ?? TEMPLATES[0];

    const updateFlyer = useCallback((updates: Partial<FlyerData>) => {
        setFlyer((prev) => ({ ...prev, ...updates }));
    }, []);

    const selectTemplate = useCallback((template: FlyerTemplate) => {
        updateFlyer({
            templateId: template.id,
            headline: template.defaultHeadline,
            headlineZh: template.defaultHeadlineZh,
            subtext: template.defaultSubtext,
            subtextZh: template.defaultSubtextZh,
            accentColor: template.color,
        });
        setActiveTab("property");
    }, [updateFlyer]);

    const generateAICopy = useCallback(async () => {
        if (!flyer.address) {
            toast.error(t("flyerStudio.enterAddress"));
            return;
        }
        setGenerating(true);
        try {
            await new Promise((r) => setTimeout(r, 1500));
            const mockEn = `Welcome to ${flyer.address}${flyer.city ? `, ${flyer.city}` : ""}! This exceptional ${flyer.propertyType.toLowerCase()} features ${flyer.beds || "—"} bedrooms and ${flyer.baths || "—"} bathrooms across ${flyer.sqft || "—"} sq ft of thoughtfully designed living space.`;
            const mockZh = `欢迎来到 ${flyer.address}${flyer.city ? `，${flyer.city}` : ""}！这套精美${flyer.propertyType === "Single Family" ? "独栋" : ""}住宅拥有 ${flyer.beds || "—"} 间卧室和 ${flyer.baths || "—"} 间浴室，${flyer.sqft || "—"} 平方英尺精心设计的居住空间。`;
            updateFlyer({ bodyText: mockEn, bodyTextZh: mockZh });
            toast.success(t("flyerStudio.aiCopyGenerated"));
        } catch {
            toast.error(t("flyerStudio.generateFailed"));
        } finally {
            setGenerating(false);
        }
    }, [flyer, updateFlyer, t]);

    return (
        <div className="space-y-6 p-1">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <FileText className="h-6 w-6" />
                        {t("flyerStudio.title")}
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        {t("flyerStudio.subtitle")}
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm">
                        <Copy className="h-4 w-4 mr-1" /> {t("flyerStudio.saveDraft")}
                    </Button>
                    <Button size="sm" style={{ backgroundColor: selectedTemplate.color }}>
                        <Download className="h-4 w-4 mr-1" /> {t("flyerStudio.exportPng")}
                    </Button>
                </div>
            </div>

            {/* Main Layout: Editor + Preview */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left: Editor Panel */}
                <div className="space-y-4">
                    <Tabs value={activeTab} onValueChange={setActiveTab}>
                        <TabsList className="grid grid-cols-4 w-full">
                            <TabsTrigger value="template">
                                <Palette className="h-4 w-4 mr-1" /> {t("flyerStudio.templateTab")}
                            </TabsTrigger>
                            <TabsTrigger value="property">
                                <Home className="h-4 w-4 mr-1" /> {t("flyerStudio.propertyTab")}
                            </TabsTrigger>
                            <TabsTrigger value="copy">
                                <Type className="h-4 w-4 mr-1" /> {t("flyerStudio.copyTab")}
                            </TabsTrigger>
                            <TabsTrigger value="agent">
                                <FileText className="h-4 w-4 mr-1" /> {t("flyerStudio.agentTab")}
                            </TabsTrigger>
                        </TabsList>

                        {/* Template Selection */}
                        <TabsContent value="template" className="space-y-3">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {TEMPLATES.map((template) => {
                                    const Icon = template.icon;
                                    const isSelected = flyer.templateId === template.id;
                                    return (
                                        <Card
                                            key={template.id}
                                            className={`cursor-pointer transition-all hover:shadow-md ${isSelected ? "ring-2 ring-offset-2" : ""
                                                }`}
                                            style={isSelected ? { borderColor: template.color, ["--tw-ring-color" as string]: template.color } : {}}
                                            onClick={() => selectTemplate(template)}
                                        >
                                            <CardContent className="flex items-center gap-3 p-4">
                                                <div
                                                    className="w-10 h-10 rounded-lg flex items-center justify-center text-white"
                                                    style={{ background: `linear-gradient(135deg, ${template.gradientFrom}, ${template.gradientTo})` }}
                                                >
                                                    <Icon className="h-5 w-5" />
                                                </div>
                                                <div>
                                                    <p className="font-semibold text-sm">{template.name}</p>
                                                    <p className="text-xs text-muted-foreground">{t(template.nameZhKey as any)}</p>
                                                </div>
                                                {isSelected && (
                                                    <Badge variant="secondary" className="ml-auto text-xs">
                                                        {t("flyerStudio.active")}
                                                    </Badge>
                                                )}
                                            </CardContent>
                                        </Card>
                                    );
                                })}
                            </div>
                        </TabsContent>

                        {/* Property Details */}
                        <TabsContent value="property" className="space-y-3">
                            <div className="space-y-3">
                                <div>
                                    <Label>{t("flyerStudio.addressLabel")}</Label>
                                    <Input
                                        value={flyer.address}
                                        onChange={(e) => updateFlyer({ address: e.target.value })}
                                        placeholder="123 Main Street"
                                    />
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
                                    <div className="flex gap-2">
                                        <Input value={flyer.imageUrl} onChange={(e) => updateFlyer({ imageUrl: e.target.value })} placeholder="https://..." className="flex-1" />
                                        <Button variant="outline" size="sm">
                                            <ImagePlus className="h-4 w-4" />
                                        </Button>
                                    </div>
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
                                <div className="flex items-center justify-between mb-1">
                                    <Label>{t("flyerStudio.bodyLabel")}</Label>
                                    <Button variant="outline" size="sm" onClick={generateAICopy} disabled={generating}>
                                        {generating ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
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
                            <div>
                                <Label>{t("flyerStudio.accentLabel")}</Label>
                                <div className="flex gap-2 items-center">
                                    <input
                                        type="color"
                                        value={flyer.accentColor}
                                        onChange={(e) => updateFlyer({ accentColor: e.target.value })}
                                        className="w-10 h-10 rounded cursor-pointer border"
                                    />
                                    <Input value={flyer.accentColor} onChange={(e) => updateFlyer({ accentColor: e.target.value })} className="w-28 font-mono text-sm" />
                                    <div className="flex gap-1">
                                        {TEMPLATES.map((tmpl) => (
                                            <button
                                                key={tmpl.id}
                                                className="w-6 h-6 rounded-full border-2 border-transparent hover:border-gray-400 transition"
                                                style={{ backgroundColor: tmpl.color }}
                                                onClick={() => updateFlyer({ accentColor: tmpl.color })}
                                            />
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </TabsContent>
                    </Tabs>
                </div>

                {/* Right: Live Preview */}
                <div className="sticky top-4">
                    <Card className="overflow-hidden">
                        <CardHeader className="p-3 border-b flex-row items-center justify-between">
                            <CardTitle className="text-sm flex items-center gap-1">
                                <Eye className="h-4 w-4" /> {t("flyerStudio.livePreview")}
                            </CardTitle>
                            <div className="flex gap-1">
                                <Button variant="ghost" size="sm"><Share2 className="h-4 w-4" /></Button>
                                <Button variant="ghost" size="sm"><Download className="h-4 w-4" /></Button>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <FlyerPreview flyer={flyer} template={selectedTemplate} />
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}

// ─── Flyer Preview Component ───────────────────────────────

function FlyerPreview({ flyer, template }: { flyer: FlyerData; template: FlyerTemplate }) {
    const showZh = flyer.language === "zh" || flyer.language === "both";
    const showEn = flyer.language === "en" || flyer.language === "both";

    return (
        <div
            className="relative w-full overflow-hidden"
            style={{ aspectRatio: "8.5/11", fontFamily: "var(--font-sans, 'Geist Sans'), ui-sans-serif, system-ui, sans-serif" }}
        >
            {/* Background Image / Gradient */}
            <div className="absolute inset-0">
                {flyer.imageUrl ? (
                    <img
                        src={flyer.imageUrl}
                        alt="Property"
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <div
                        className="w-full h-full"
                        style={{
                            background: `linear-gradient(135deg, ${template.gradientFrom}22, ${template.gradientTo}44)`,
                        }}
                    />
                )}
                <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/70" />
            </div>

            {/* Content */}
            <div className="relative z-10 h-full flex flex-col justify-between p-6">
                <div>
                    <div
                        className="inline-block px-4 py-2 rounded-md text-white font-black text-lg tracking-wider"
                        style={{ backgroundColor: flyer.accentColor, fontFamily: "var(--font-serif, 'DM Serif Display'), serif" }}
                    >
                        {showEn && flyer.headline}
                        {showEn && showZh && " · "}
                        {showZh && flyer.headlineZh}
                    </div>
                    {(flyer.subtext || flyer.subtextZh) && (
                        <p className="mt-2 text-white/90 text-sm font-medium drop-shadow">
                            {showEn && flyer.subtext}
                            {showEn && showZh && <br />}
                            {showZh && flyer.subtextZh}
                        </p>
                    )}
                </div>

                {flyer.templateId === "open_house" && (flyer.openHouseDate || flyer.openHouseTime) && (
                    <div className="bg-white/95 backdrop-blur rounded-lg p-4 text-center shadow-lg">
                        {flyer.openHouseDate && (
                            <p className="text-lg font-bold" style={{ color: flyer.accentColor }}>
                                {new Date(flyer.openHouseDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                            </p>
                        )}
                        {flyer.openHouseTime && <p className="text-sm text-gray-600">{flyer.openHouseTime}</p>}
                    </div>
                )}

                <div className="space-y-3">
                    <div className="bg-white/95 backdrop-blur rounded-lg p-4 shadow-lg">
                        {flyer.address && (
                            <p className="font-bold text-gray-900 text-sm">{flyer.address}</p>
                        )}
                        {(flyer.city || flyer.state) && (
                            <p className="text-xs text-gray-500">
                                {[flyer.city, flyer.state].filter(Boolean).join(", ")}
                            </p>
                        )}
                        {flyer.price && (
                            <p className="text-xl font-black mt-1" style={{ color: flyer.accentColor }}>
                                {flyer.price}
                            </p>
                        )}
                        <div className="flex gap-4 mt-2 text-xs text-gray-600">
                            {flyer.beds && <span><strong>{flyer.beds}</strong> {showZh ? "卧" : "Beds"}</span>}
                            {flyer.baths && <span><strong>{flyer.baths}</strong> {showZh ? "浴" : "Baths"}</span>}
                            {flyer.sqft && <span><strong>{flyer.sqft}</strong> {showZh ? "平方英尺" : "Sq Ft"}</span>}
                            {flyer.propertyType && <span>{flyer.propertyType}</span>}
                        </div>
                        {(flyer.bodyText || flyer.bodyTextZh) && (
                            <div className="mt-2 text-xs text-gray-600 leading-relaxed line-clamp-3">
                                {showEn && flyer.bodyText}
                                {showEn && showZh && <br />}
                                {showZh && <span className="text-gray-500">{flyer.bodyTextZh}</span>}
                            </div>
                        )}
                    </div>

                    {flyer.agentName && (
                        <div
                            className="rounded-lg p-3 text-white flex items-center gap-3"
                            style={{ backgroundColor: flyer.accentColor }}
                        >
                            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-lg font-bold">
                                {flyer.agentName.charAt(0)}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-bold text-sm truncate">{flyer.agentName}</p>
                                <p className="text-xs opacity-80 truncate">{flyer.agentTitle}</p>
                                <div className="flex gap-3 text-xs opacity-80 mt-0.5">
                                    {flyer.agentPhone && <span>{flyer.agentPhone}</span>}
                                    {flyer.agentEmail && <span>{flyer.agentEmail}</span>}
                                </div>
                            </div>
                            {flyer.brokerageName && (
                                <p className="text-xs opacity-70 text-right">{flyer.brokerageName}</p>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
