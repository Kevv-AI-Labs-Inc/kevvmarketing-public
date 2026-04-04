// CMA Studio — Next-Gen 5-Stage Pipeline UI
// Unified search (MLS + address), auto-fill, editable adjustments, comp categories
import { useT } from "@/i18n";
import { localeTag } from "@/i18n/copy";
import { getDashboardPageCopy } from "@/i18n/dashboard-pages";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AddressAutocomplete } from "@/components/ui/address-autocomplete";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { trpc } from "@/lib/trpc";
import {
  ArrowRight,
  BarChart3,
  Building2,
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  Edit3,
  ExternalLink,
  Globe,
  Loader2,
  MapPin,
  Search,
  Sparkles,
  TrendingUp,
  Trash2,
  Upload,
  X,
  Zap,
} from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────

type InputTab = "mls" | "manual";

type PipelineStage = {
  key: string;
  label: string;
  icon: React.ReactNode;
  status: "idle" | "running" | "done" | "error";
};

function parseCmaPrefillFromUrl() {
  if (typeof window === "undefined") {
    return { subjectKey: "", limit: null as number | null };
  }
  const params = new URLSearchParams(window.location.search);
  const subjectKey =
    params.get("subjectKey")?.trim() ||
    params.get("listingKey")?.trim() ||
    params
      .get("listingKeys")
      ?.split(",")
      .map((item) => item.trim())
      .find((item) => item.length > 0) ||
    "";
  const rawLimit = Number(params.get("limit"));
  const limit = Number.isFinite(rawLimit)
    ? Math.min(Math.max(Math.round(rawLimit), 1), 20)
    : null;
  return { subjectKey, limit };
}

// ─── Component ────────────────────────────────────────────

export default function CMAStudio() {
  const { locale } = useT();
  const isChinese = locale.startsWith("zh");
  const copy = getDashboardPageCopy(locale).cmaStudio;
  const prefill = useMemo(() => parseCmaPrefillFromUrl(), []);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Input state — unified search replaces MLS/manual tabs
  const [inputTab, setInputTab] = useState<InputTab>("mls");
  const [search, setSearch] = useState("");
  const [selectedSubjectKey, setSelectedSubjectKey] = useState<string>(
    prefill.subjectKey,
  );
  const trimmedSearch = search.trim();
  const shouldSearchProperties =
    inputTab === "mls" && trimmedSearch.length >= 2;

  // Manual input state — simplified (no price field)
  const [manualAddress, setManualAddress] = useState("");
  const [manualCity, setManualCity] = useState("");
  const [manualState, setManualState] = useState("");
  const [manualZip, setManualZip] = useState("");
  const [manualBeds, setManualBeds] = useState("");
  const [manualBaths, setManualBaths] = useState("");
  const [manualSqft, setManualSqft] = useState("");
  const [manualYearBuilt, setManualYearBuilt] = useState("");
  const [manualType, setManualType] = useState("Residential");
  const [autoFilling, setAutoFilling] = useState(false);
  const [autoFilled, setAutoFilled] = useState(false);

  // Photos
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Settings
  const [compLimit, setCompLimit] = useState(
    prefill.limit ? String(prefill.limit) : "8",
  );
  const [enableWebSearch, setEnableWebSearch] = useState(true);
  const [enablePhotoAnalysis, setEnablePhotoAnalysis] = useState(true);
  const [enableRentCast, setEnableRentCast] = useState(true);
  const [agentName, setAgentName] = useState("");
  const [agentEmail, setAgentEmail] = useState("");
  const [agentPhone, setAgentPhone] = useState("");

  // Pipeline state
  const [generating, setGenerating] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [result, setResult] = useState<any>(null);
  const [pipelineStages, setPipelineStages] = useState<PipelineStage[]>([]);

  // Editable adjustments state
  const [editingCompIdx, setEditingCompIdx] = useState<number | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [editedComps, setEditedComps] = useState<Map<number, any>>(new Map());
  const [removedCompIndices, setRemovedCompIndices] = useState<Set<number>>(
    new Set(),
  );
  const [expandedCompIdx, setExpandedCompIdx] = useState<number | null>(null);

  // ─── Queries ──────────────────────────────────────────────

  const propertiesQuery = trpc.mls.getProperties.useQuery(
    {
      search: trimmedSearch || undefined,
      limit: 20,
      offset: 0,
    },
    {
      enabled: shouldSearchProperties,
    },
  );

  const historyQuery = trpc.cma.list.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  // ─── RentCast Auto-Fill ───────────────────────────────────

  const lookupQuery = trpc.cma.lookupProperty.useQuery(
    {
      address: manualAddress,
      city: manualCity || undefined,
      state: manualState || undefined,
      zipCode: manualZip || undefined,
    },
    {
      enabled: false, // manually triggered
    },
  );

  const handleAutoFill = useCallback(async () => {
    if (!manualAddress.trim()) {
      toast.error(isChinese ? "请先输入地址" : "Enter an address first");
      return;
    }
    setAutoFilling(true);
    try {
      const data = await lookupQuery.refetch();
      const prop = data.data;
      if (prop) {
        if (prop.beds != null && !manualBeds) setManualBeds(String(prop.beds));
        if (prop.baths != null && !manualBaths) setManualBaths(String(prop.baths));
        if (prop.sqft != null && !manualSqft) setManualSqft(String(prop.sqft));
        if (prop.yearBuilt != null && !manualYearBuilt)
          setManualYearBuilt(String(prop.yearBuilt));
        if (prop.propertyType) setManualType(prop.propertyType);
        setAutoFilled(true);
        toast.success(
          isChinese ? "房产信息已自动填充" : "Property details auto-filled",
        );
      } else {
        toast.info(
          isChinese
            ? "未找到该地址的房产信息，请手动填写"
            : "No property data found. Please fill in manually.",
        );
      }
    } catch {
      toast.error(
        isChinese ? "自动填充失败" : "Auto-fill failed",
      );
    } finally {
      setAutoFilling(false);
    }
  }, [manualAddress, manualCity, manualState, manualZip, manualBeds, manualBaths, manualSqft, manualYearBuilt, isChinese, lookupQuery]);

  // ─── Photo Upload ─────────────────────────────────────────

  const uploadPhotoMutation = trpc.cma.uploadPhoto.useMutation();

  async function handlePhotoUpload(file: File) {
    if (photoUrls.length >= 6) {
      toast.error(isChinese ? "最多上传 6 张照片" : "Maximum 6 photos");
      return;
    }
    setUploadingPhoto(true);
    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve) => {
        reader.onload = () => {
          const r = reader.result as string;
          resolve(r.split(",")[1]); // strip data:image/...;base64,
        };
        reader.readAsDataURL(file);
      });

      const res = await uploadPhotoMutation.mutateAsync({
        base64,
        filename: file.name,
        contentType: file.type || "image/jpeg",
      });
      setPhotoUrls((prev) => [...prev, res.url]);
      toast.success(isChinese ? "照片已上传" : "Photo uploaded");
    } catch {
      toast.error(isChinese ? "照片上传失败" : "Photo upload failed");
    } finally {
      setUploadingPhoto(false);
    }
  }

  // ─── Generate CMA ─────────────────────────────────────────

  const generateMutation = trpc.cma.generate.useMutation();

  async function handleGenerate() {
    // Validate
    if (inputTab === "mls" && !selectedSubjectKey) {
      toast.error(copy.toasts.selectSubject);
      return;
    }
    if (inputTab === "manual" && !manualAddress.trim()) {
      toast.error(isChinese ? "请输入地址" : "Please enter an address");
      return;
    }

    setGenerating(true);
    setResult(null);
    setEditedComps(new Map());
    setRemovedCompIndices(new Set());
    setEditingCompIdx(null);
    setExpandedCompIdx(null);

    // Set up pipeline stages for visual tracking
    const stages: PipelineStage[] = [
      {
        key: "resolve",
        label: isChinese ? "房源解析" : "Subject Resolution",
        icon: <Building2 className="w-4 h-4" />,
        status: "running",
      },
      ...(photoUrls.length > 0 && enablePhotoAnalysis
        ? [
            {
              key: "photos",
              label: isChinese ? "照片分析" : "Photo Analysis",
              icon: <Camera className="w-4 h-4" />,
              status: "idle" as const,
            },
          ]
        : []),
      {
        key: "comps",
        label: isChinese ? "可比房源" : "Comp Matching",
        icon: <BarChart3 className="w-4 h-4" />,
        status: "idle",
      },
      ...(enableRentCast
        ? [
            {
              key: "rentcast",
              label: isChinese ? "RentCast 估价" : "RentCast AVM",
              icon: <TrendingUp className="w-4 h-4" />,
              status: "idle" as const,
            },
          ]
        : []),
      ...(enableWebSearch
        ? [
            {
              key: "web",
              label: isChinese ? "市场搜索" : "Market Search",
              icon: <Globe className="w-4 h-4" />,
              status: "idle" as const,
            },
          ]
        : []),
      {
        key: "synthesis",
        label: isChinese ? "报告生成" : "Report Generation",
        icon: <Sparkles className="w-4 h-4" />,
        status: "idle",
      },
    ];
    setPipelineStages(stages);

    // Simulate stage progression (since the backend runs as one call)
    const stageInterval = setInterval(() => {
      setPipelineStages((prev) => {
        const running = prev.findIndex((s) => s.status === "running");
        if (running < 0) return prev;
        const next = [...prev];
        next[running] = { ...next[running], status: "done" };
        if (running + 1 < next.length) {
          next[running + 1] = { ...next[running + 1], status: "running" };
        }
        return next;
      });
    }, 1500);

    try {
      const limit = Math.min(
        Math.max(parseInt(compLimit, 10) || 8, 3),
        15,
      );

      const payload = {
        ...(inputTab === "mls"
          ? { listingKey: selectedSubjectKey }
          : {
              manualInput: {
                address: manualAddress,
                city: manualCity,
                state: manualState,
                zipCode: manualZip,
                beds: manualBeds ? parseInt(manualBeds, 10) : undefined,
                baths: manualBaths ? parseInt(manualBaths, 10) : undefined,
                sqft: manualSqft ? parseInt(manualSqft, 10) : undefined,
                yearBuilt: manualYearBuilt
                  ? parseInt(manualYearBuilt, 10)
                  : undefined,
                propertyType: manualType || undefined,
              },
            }),
        photoUrls: photoUrls.length > 0 ? photoUrls : undefined,
        compLimit: limit,
        enableWebSearch,
        enablePhotoAnalysis,
        enableRentCast,
        locale: locale as "en" | "zh",
        branding: {
          name: agentName || "Agent",
          email: agentEmail || "agent@example.com",
          phone: agentPhone || "",
        },
      };

      const data = await generateMutation.mutateAsync(payload);
      setResult(data.result);
      await historyQuery.refetch();

      // Mark all stages done
      setPipelineStages((prev) =>
        prev.map((s) => ({ ...s, status: "done" as const })),
      );

      toast.success(
        isChinese ? "CMA 报告已生成" : "CMA Report Generated",
        {
          description:
            isChinese
              ? `找到 ${data.result?.comparables?.length ?? 0} 套可比房源`
              : `Found ${data.result?.comparables?.length ?? 0} comparable sales`,
        },
      );
    } catch (err) {
      setPipelineStages((prev) =>
        prev.map((s) =>
          s.status === "running" ? { ...s, status: "error" as const } : s,
        ),
      );
      toast.error(
        isChinese ? "CMA 生成失败" : "CMA Generation Failed",
        { description: (err as Error).message },
      );
    } finally {
      clearInterval(stageInterval);
      setGenerating(false);
    }
  }

  // ─── Comp Editing Helpers ─────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getDisplayComps = useCallback((): any[] => {
    if (!result?.comparables) return [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return result.comparables.filter((_: any, i: number) => !removedCompIndices.has(i)).map((comp: any, i: number) => {
      const edited = editedComps.get(i);
      return edited ? { ...comp, ...edited } : comp;
    });
  }, [result, editedComps, removedCompIndices]);

  const handleRemoveComp = useCallback(
    (idx: number) => {
      setRemovedCompIndices((prev) => new Set([...prev, idx]));
      toast.info(
        isChinese ? "已移除该可比房源" : "Comparable removed",
      );
    },
    [isChinese],
  );

  const handleEditAdjustment = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (idx: number, field: string, value: any) => {
      setEditedComps((prev) => {
        const next = new Map(prev);
        const existing = next.get(idx) || {};
        const existingBreakdown =
          existing.adjustmentBreakdown ||
          result?.comparables?.[idx]?.adjustmentBreakdown ||
          {};

        const newBreakdown = { ...existingBreakdown, [field]: value };
        newBreakdown.total =
          (newBreakdown.bedroomAdj ?? 0) +
          (newBreakdown.sqftAdj ?? 0) +
          (newBreakdown.ageAdj ?? 0) +
          (newBreakdown.conditionAdj ?? 0);

        // Recalculate adjusted price
        const origPrice = parseInt(
          (result?.comparables?.[idx]?.soldPrice ?? "$0").replace(/[$,]/g, ""),
          10,
        ) || 0;
        const adjustedPrice = Math.max(0, origPrice + newBreakdown.total);

        next.set(idx, {
          ...existing,
          adjustmentBreakdown: newBreakdown,
          adjustedPrice: `$${adjustedPrice.toLocaleString()}`,
        });
        return next;
      });
    },
    [result],
  );

  // ─── Helpers ──────────────────────────────────────────────

  const formatPrice = (price: string | null | undefined) => {
    if (!price) return copy.fallbackPrice;
    const num = Number(String(price).replace(/[$,]/g, ""));
    if (!Number.isFinite(num)) return price;
    return `$${num.toLocaleString()}`;
  };

  const formatDateTime = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString(localeTag(locale));
  };

  const confidenceBadge = (
    confidence: "high" | "medium" | "low",
  ) => {
    const map = {
      high: {
        color:
          "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
        label: isChinese ? "高置信" : "High",
      },
      medium: {
        color:
          "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
        label: isChinese ? "中置信" : "Medium",
      },
      low: {
        color:
          "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
        label: isChinese ? "低置信" : "Low",
      },
    };
    const { color, label } = map[confidence] || map.medium;
    return (
      <span
        className={`px-2 py-0.5 rounded-full text-xs font-medium ${color}`}
      >
        {label}
      </span>
    );
  };

  const sourceBadge = (source: string | undefined) => {
    if (!source) return null;
    const colors: Record<string, string> = {
      bbo_vector:
        "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
      bbo_search:
        "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
      rentcast:
        "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
    };
    const labels: Record<string, string> = {
      bbo_vector: "BBO",
      bbo_search: "Search",
      rentcast: "RentCast",
    };
    return (
      <span
        className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${colors[source] ?? "bg-muted text-muted-foreground"}`}
      >
        {labels[source] ?? source}
      </span>
    );
  };

  const displayComps = getDisplayComps();

  // ─── Render ───────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6 w-full max-w-7xl mx-auto">
      {/* Hero */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-lg">
          <BarChart3 className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {copy.heroTitle}
          </h1>
          <p className="text-sm text-muted-foreground">
            {copy.heroDescription}
          </p>
        </div>
      </div>

      {/* Pipeline Progress Bar */}
      {pipelineStages.length > 0 && (
        <div className="flex items-center gap-2 p-4 rounded-xl bg-muted/50 border overflow-x-auto">
          {pipelineStages.map((stage, i) => (
            <div
              key={stage.key}
              className="flex items-center gap-2 shrink-0"
            >
              <div
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  stage.status === "done"
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                    : stage.status === "running"
                      ? "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400 animate-pulse"
                      : stage.status === "error"
                        ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                        : "bg-muted text-muted-foreground"
                }`}
              >
                {stage.status === "done" ? (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                ) : stage.status === "running" ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  stage.icon
                )}
                {stage.label}
              </div>
              {i < pipelineStages.length - 1 && (
                <ArrowRight className="w-3 h-3 text-muted-foreground" />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left Column — Input (2 cols) */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          {/* Input Tabs */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base">
                  {copy.subjectCard.title}
                </CardTitle>
              </div>
              <div className="flex gap-1 p-1 bg-muted rounded-lg">
                <button
                  onClick={() => setInputTab("mls")}
                  className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    inputTab === "mls"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {isChinese ? "MLS / 地址搜索" : "MLS / Address Search"}
                </button>
                <button
                  onClick={() => setInputTab("manual")}
                  className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    inputTab === "manual"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {isChinese ? "手动输入" : "Manual Input"}
                </button>
              </div>
            </CardHeader>
            <CardContent>
              {inputTab === "mls" ? (
                <div className="flex flex-col gap-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder={
                        isChinese
                          ? "输入地址或 MLS 编号搜索..."
                          : "Search by address or MLS number..."
                      }
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <ScrollArea className="h-[260px]">
                    <div className="flex flex-col gap-1.5">
                      {!shouldSearchProperties ? (
                        <p className="text-xs text-muted-foreground py-4 text-center">
                          {copy.subjectCard.startSearch}
                        </p>
                      ) : propertiesQuery.isLoading ? (
                        <p className="text-xs text-muted-foreground py-4 text-center">
                          <Loader2 className="w-4 h-4 animate-spin inline mr-1" />
                          {copy.subjectCard.loadingProperties}
                        </p>
                      ) : null}
                      {shouldSearchProperties &&
                        propertiesQuery.data?.map(
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          (p: any) => (
                            <button
                              key={p.listingKey}
                              onClick={() =>
                                setSelectedSubjectKey(p.listingKey)
                              }
                              className={`w-full text-left p-2.5 rounded-lg border text-sm transition-colors ${
                                selectedSubjectKey === p.listingKey
                                  ? "border-violet-500 bg-violet-50 dark:bg-violet-950/20"
                                  : "border-transparent hover:bg-muted"
                              }`}
                            >
                              <div className="font-medium truncate">
                                {p.unparsedAddress || p.listingKey}
                              </div>
                              <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
                                <span>{p.city}</span>
                                <span>·</span>
                                <span>{formatPrice(p.listPrice)}</span>
                                <span>·</span>
                                <span>
                                  {p.bedroomsTotal ?? "?"}bd/
                                  {p.bathroomsTotalInteger ?? "?"}ba
                                </span>
                                <span>·</span>
                                <span>{p.livingArea ?? "?"}sqft</span>
                                {p.standardStatus && (
                                  <Badge
                                    variant="outline"
                                    className="text-[9px] px-1 py-0 ml-1"
                                  >
                                    {p.standardStatus}
                                  </Badge>
                                )}
                              </div>
                            </button>
                          ),
                        )}
                      {shouldSearchProperties &&
                        propertiesQuery.data?.length === 0 && (
                          <p className="text-xs text-muted-foreground py-4 text-center">
                            {copy.subjectCard.noProperties}
                          </p>
                        )}
                    </div>
                  </ScrollArea>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {/* Address with auto-fill button */}
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">
                      {isChinese ? "地址 *" : "Address *"}
                    </label>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <AddressAutocomplete
                          value={manualAddress}
                          onChange={(v) => {
                            setManualAddress(v);
                            setAutoFilled(false);
                          }}
                          onSelect={(formatted) => {
                            const parts = formatted
                              .split(",")
                              .map((s) => s.trim());
                            if (parts.length >= 3) {
                              setManualAddress(parts[0] ?? formatted);
                              if (parts.length >= 4)
                                setManualCity(parts[1] ?? "");
                              const stateZip = parts[parts.length - 2] ?? "";
                              const m = stateZip.match(
                                /^([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/,
                              );
                              if (m) {
                                setManualState(m[1] ?? "");
                                setManualZip(m[2] ?? "");
                              }
                            } else {
                              setManualAddress(formatted);
                            }
                            setAutoFilled(false);
                          }}
                          placeholder="123 Main St"
                        />
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleAutoFill}
                        disabled={autoFilling || !manualAddress.trim()}
                        className="shrink-0 h-10 px-3"
                        title={
                          isChinese
                            ? "从 RentCast 自动填充房产信息"
                            : "Auto-fill from RentCast"
                        }
                      >
                        {autoFilling ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <Zap className="w-3.5 h-3.5 mr-1" />
                            {isChinese ? "自动填充" : "Auto-fill"}
                          </>
                        )}
                      </Button>
                    </div>
                    {autoFilled && (
                      <p className="text-[10px] text-emerald-600 mt-1">
                        {isChinese
                          ? "✓ 已从 RentCast 自动填充"
                          : "✓ Auto-filled from RentCast"}
                      </p>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">
                        {isChinese ? "城市" : "City"}
                      </label>
                      <Input
                        value={manualCity}
                        onChange={(e) => setManualCity(e.target.value)}
                        placeholder="Irvine"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">
                        {isChinese ? "州" : "State"}
                      </label>
                      <Input
                        value={manualState}
                        onChange={(e) => setManualState(e.target.value)}
                        placeholder="CA"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">
                        {isChinese ? "邮编" : "ZIP"}
                      </label>
                      <Input
                        value={manualZip}
                        onChange={(e) => setManualZip(e.target.value)}
                        placeholder="92618"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">
                        {isChinese ? "卧室" : "Beds"}
                      </label>
                      <Input
                        type="number"
                        value={manualBeds}
                        onChange={(e) => setManualBeds(e.target.value)}
                        placeholder="4"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">
                        {isChinese ? "卫浴" : "Baths"}
                      </label>
                      <Input
                        type="number"
                        value={manualBaths}
                        onChange={(e) => setManualBaths(e.target.value)}
                        placeholder="3"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">
                        {isChinese ? "面积(sqft)" : "Sqft"}
                      </label>
                      <Input
                        type="number"
                        value={manualSqft}
                        onChange={(e) => setManualSqft(e.target.value)}
                        placeholder="2400"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">
                        {isChinese ? "建造年份" : "Year Built"}
                      </label>
                      <Input
                        type="number"
                        value={manualYearBuilt}
                        onChange={(e) => setManualYearBuilt(e.target.value)}
                        placeholder="2005"
                      />
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Photo Upload */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Camera className="w-4 h-4" />
                {isChinese ? "内景照片" : "Interior Photos"}
              </CardTitle>
              <CardDescription>
                {isChinese
                  ? "上传房源内景照片，AI 自动分析装修条件（最多 6 张）"
                  : "Upload interior photos for AI condition assessment (max 6)"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {photoUrls.map((url, i) => (
                  <div
                    key={i}
                    className="relative w-20 h-20 rounded-lg overflow-hidden border group"
                  >
                    <img
                      src={url}
                      alt={`Photo ${i + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <button
                      onClick={() =>
                        setPhotoUrls((prev) =>
                          prev.filter((_, idx) => idx !== i),
                        )
                      }
                      className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                {photoUrls.length < 6 && (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingPhoto}
                    className="w-20 h-20 rounded-lg border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center text-muted-foreground hover:border-violet-400 hover:text-violet-500 transition-colors"
                  >
                    {uploadingPhoto ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <Upload className="w-5 h-5" />
                        <span className="text-[10px] mt-0.5">
                          {isChinese ? "上传" : "Upload"}
                        </span>
                      </>
                    )}
                  </button>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handlePhotoUpload(file);
                  e.target.value = "";
                }}
              />
            </CardContent>
          </Card>

          {/* Settings */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                {isChinese ? "生成设置" : "Settings"}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <label className="text-sm">
                  <Globe className="w-3.5 h-3.5 inline mr-1.5" />
                  {isChinese
                    ? "网络市场搜索 (Tavily)"
                    : "Web Market Search (Tavily)"}
                </label>
                <button
                  onClick={() => setEnableWebSearch(!enableWebSearch)}
                  className={`w-9 h-5 rounded-full transition-colors ${
                    enableWebSearch ? "bg-violet-500" : "bg-muted"
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${
                      enableWebSearch
                        ? "translate-x-4.5"
                        : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>
              <div className="flex items-center justify-between">
                <label className="text-sm">
                  <Camera className="w-3.5 h-3.5 inline mr-1.5" />
                  {isChinese ? "AI 照片分析" : "AI Photo Analysis"}
                </label>
                <button
                  onClick={() =>
                    setEnablePhotoAnalysis(!enablePhotoAnalysis)
                  }
                  className={`w-9 h-5 rounded-full transition-colors ${
                    enablePhotoAnalysis ? "bg-violet-500" : "bg-muted"
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${
                      enablePhotoAnalysis
                        ? "translate-x-4.5"
                        : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>
              <div className="flex items-center justify-between">
                <label className="text-sm">
                  <TrendingUp className="w-3.5 h-3.5 inline mr-1.5" />
                  {isChinese
                    ? "RentCast 估价 + 可比房源"
                    : "RentCast AVM + Comps"}
                </label>
                <button
                  onClick={() => setEnableRentCast(!enableRentCast)}
                  className={`w-9 h-5 rounded-full transition-colors ${
                    enableRentCast ? "bg-violet-500" : "bg-muted"
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${
                      enableRentCast
                        ? "translate-x-4.5"
                        : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>
              <div>
                <label className="text-sm mb-1 block">
                  {isChinese ? "可比房源数量" : "Comparable Count"} (
                  {compLimit})
                </label>
                <input
                  type="range"
                  min="3"
                  max="15"
                  value={compLimit}
                  onChange={(e) => setCompLimit(e.target.value)}
                  className="w-full accent-violet-500"
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Input
                  placeholder={isChinese ? "经纪人姓名" : "Agent Name"}
                  value={agentName}
                  onChange={(e) => setAgentName(e.target.value)}
                />
                <Input
                  placeholder={isChinese ? "邮箱" : "Email"}
                  value={agentEmail}
                  onChange={(e) => setAgentEmail(e.target.value)}
                />
                <Input
                  placeholder={isChinese ? "电话" : "Phone"}
                  value={agentPhone}
                  onChange={(e) => setAgentPhone(e.target.value)}
                />
              </div>

              {/* Generate Button */}
              <Button
                onClick={handleGenerate}
                disabled={generating}
                className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white shadow-lg"
                size="lg"
              >
                {generating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {isChinese ? "生成中..." : "Generating..."}
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 mr-2" />
                    {copy.subjectCard.generate}
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Right Column — Output (3 cols) */}
        <div className="lg:col-span-3 flex flex-col gap-4">
          {result ? (
            <>
              {/* Executive Summary */}
              <Card className="border-violet-200 dark:border-violet-900/30">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-violet-500" />
                      {isChinese ? "执行摘要" : "Executive Summary"}
                    </CardTitle>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock3 className="w-3 h-3" />
                      {(result.totalLatencyMs / 1000).toFixed(1)}s
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-relaxed">
                    {isChinese
                      ? result.executiveSummary?.chinese
                      : result.executiveSummary?.english}
                  </p>
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {result.dataSources?.map((src: string) => (
                      <Badge
                        key={src}
                        variant="secondary"
                        className="text-[10px]"
                      >
                        {src}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Price Recommendation */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-500" />
                    {isChinese ? "价格建议" : "Price Recommendation"}
                    {result.priceRecommendation?.confidence &&
                      confidenceBadge(
                        result.priceRecommendation.confidence,
                      )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-xs text-muted-foreground">
                        {isChinese ? "低价" : "Low"}
                      </p>
                      <p className="text-lg font-bold text-red-600 dark:text-red-400">
                        {result.priceRecommendation?.low}
                      </p>
                    </div>
                    <div className="border-x">
                      <p className="text-xs text-muted-foreground">
                        {isChinese ? "建议价" : "Midpoint"}
                      </p>
                      <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                        {result.priceRecommendation?.midpoint}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">
                        {isChinese ? "高价" : "High"}
                      </p>
                      <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                        {result.priceRecommendation?.high}
                      </p>
                    </div>
                  </div>
                  {/* RentCast AVM comparison */}
                  {result.rentCastValuation?.estimatedPrice && (
                    <div className="mt-3 p-2.5 rounded-lg bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900/30">
                      <p className="text-xs font-medium text-orange-700 dark:text-orange-400 mb-1">
                        {isChinese
                          ? "RentCast 独立估价参考"
                          : "RentCast Independent AVM"}
                      </p>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="font-bold text-orange-600 dark:text-orange-400">
                          $
                          {result.rentCastValuation.estimatedPrice.toLocaleString()}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          ($
                          {result.rentCastValuation.priceLow?.toLocaleString() ??
                            "?"}{" "}
                          - $
                          {result.rentCastValuation.priceHigh?.toLocaleString() ??
                            "?"}
                          )
                        </span>
                        {result.rentCastValuation.pricePerSqft && (
                          <span className="text-xs text-muted-foreground">
                            $
                            {result.rentCastValuation.pricePerSqft.toLocaleString()}
                            /sqft
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground mt-3">
                    {result.priceRecommendation?.methodology}
                  </p>
                </CardContent>
              </Card>

              {/* Comparables Table — with editable adjustments */}
              {displayComps.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">
                        {isChinese ? "可比房源" : "Comparable Sales"} (
                        {displayComps.length})
                      </CardTitle>
                      <p className="text-[10px] text-muted-foreground">
                        {isChinese
                          ? "点击展开查看/编辑调整项"
                          : "Click to expand & edit adjustments"}
                      </p>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-col gap-2">
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      {displayComps.map((comp: any, i: number) => {
                        const isExpanded = expandedCompIdx === i;
                        const isEditing = editingCompIdx === i;
                        const breakdown = comp.adjustmentBreakdown ?? {};

                        return (
                          <div
                            key={i}
                            className="rounded-lg border hover:border-violet-300 dark:hover:border-violet-800 transition-colors"
                          >
                            {/* Comp Summary Row */}
                            <button
                              onClick={() =>
                                setExpandedCompIdx(
                                  isExpanded ? null : i,
                                )
                              }
                              className="w-full text-left p-3 flex items-center gap-3"
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium truncate">
                                    {comp.address}
                                  </span>
                                  {sourceBadge(comp.source)}
                                  {comp.status &&
                                    comp.status !== "Closed" && (
                                      <Badge
                                        variant="outline"
                                        className="text-[9px] px-1 py-0"
                                      >
                                        {comp.status}
                                      </Badge>
                                    )}
                                </div>
                                <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                                  <span>
                                    {comp.beds ?? "?"}bd/
                                    {comp.baths ?? "?"}ba
                                  </span>
                                  <span>·</span>
                                  <span>{comp.sqft ?? "?"}sqft</span>
                                  {comp.yearBuilt && (
                                    <>
                                      <span>·</span>
                                      <span>
                                        {isChinese ? "建于" : "Built"}{" "}
                                        {comp.yearBuilt}
                                      </span>
                                    </>
                                  )}
                                  {comp.soldDate && (
                                    <>
                                      <span>·</span>
                                      <span>
                                        {isChinese ? "售于" : "Sold"}{" "}
                                        {comp.soldDate.slice(0, 10)}
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <p className="text-sm font-medium">
                                  {comp.soldPrice}
                                </p>
                                <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                                  → {comp.adjustedPrice}
                                </p>
                              </div>
                              {isExpanded ? (
                                <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
                              ) : (
                                <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                              )}
                            </button>

                            {/* Expanded Adjustment Details */}
                            {isExpanded && (
                              <div className="px-3 pb-3 border-t">
                                <div className="grid grid-cols-4 gap-2 mt-3">
                                  {[
                                    {
                                      key: "bedroomAdj",
                                      label: isChinese
                                        ? "卧室调整"
                                        : "Bedroom",
                                    },
                                    {
                                      key: "sqftAdj",
                                      label: isChinese
                                        ? "面积调整"
                                        : "Sqft",
                                    },
                                    {
                                      key: "ageAdj",
                                      label: isChinese
                                        ? "房龄调整"
                                        : "Age",
                                    },
                                    {
                                      key: "conditionAdj",
                                      label: isChinese
                                        ? "状况调整"
                                        : "Condition",
                                    },
                                  ].map(({ key, label }) => (
                                    <div key={key}>
                                      <label className="text-[10px] text-muted-foreground block mb-0.5">
                                        {label}
                                      </label>
                                      {isEditing ? (
                                        <Input
                                          type="number"
                                          className="h-7 text-xs"
                                          value={breakdown[key] ?? 0}
                                          onChange={(e) =>
                                            handleEditAdjustment(
                                              i,
                                              key,
                                              parseInt(
                                                e.target.value,
                                                10,
                                              ) || 0,
                                            )
                                          }
                                        />
                                      ) : (
                                        <p
                                          className={`text-xs font-medium ${
                                            (breakdown[key] ?? 0) > 0
                                              ? "text-emerald-600"
                                              : (breakdown[key] ?? 0) <
                                                  0
                                                ? "text-red-600"
                                                : "text-muted-foreground"
                                          }`}
                                        >
                                          {(breakdown[key] ?? 0) >= 0
                                            ? "+"
                                            : ""}
                                          $
                                          {Math.abs(
                                            breakdown[key] ?? 0,
                                          ).toLocaleString()}
                                        </p>
                                      )}
                                    </div>
                                  ))}
                                </div>
                                <div className="flex items-center justify-between mt-3 pt-2 border-t">
                                  <div className="text-xs">
                                    <span className="text-muted-foreground">
                                      {isChinese
                                        ? "总调整："
                                        : "Total adj: "}
                                    </span>
                                    <span
                                      className={`font-bold ${
                                        (breakdown.total ?? 0) >= 0
                                          ? "text-emerald-600"
                                          : "text-red-600"
                                      }`}
                                    >
                                      {(breakdown.total ?? 0) >= 0
                                        ? "+"
                                        : ""}
                                      $
                                      {Math.abs(
                                        breakdown.total ?? 0,
                                      ).toLocaleString()}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 px-2 text-xs"
                                      onClick={() =>
                                        setEditingCompIdx(
                                          isEditing ? null : i,
                                        )
                                      }
                                    >
                                      <Edit3 className="w-3 h-3 mr-1" />
                                      {isEditing
                                        ? isChinese
                                          ? "完成"
                                          : "Done"
                                        : isChinese
                                          ? "编辑"
                                          : "Edit"}
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 px-2 text-xs text-red-500 hover:text-red-700"
                                      onClick={() => handleRemoveComp(i)}
                                    >
                                      <Trash2 className="w-3 h-3 mr-1" />
                                      {isChinese ? "移除" : "Remove"}
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Market Intelligence */}
              {result.marketIntelligence?.citations?.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Globe className="w-4 h-4 text-blue-500" />
                      {isChinese ? "市场情报" : "Market Intelligence"}
                      <Badge
                        variant="secondary"
                        className="text-[10px]"
                      >
                        Tavily
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                      {result.marketIntelligence.medianPrice && (
                        <div className="p-2.5 rounded-lg bg-muted/50 text-center">
                          <p className="text-xs text-muted-foreground">
                            {isChinese ? "中位价" : "Median Price"}
                          </p>
                          <p className="font-bold text-sm">
                            {result.marketIntelligence.medianPrice}
                          </p>
                        </div>
                      )}
                      {result.marketIntelligence.priceChangeYoY && (
                        <div className="p-2.5 rounded-lg bg-muted/50 text-center">
                          <p className="text-xs text-muted-foreground">
                            {isChinese ? "年涨幅" : "YoY Change"}
                          </p>
                          <p className="font-bold text-sm">
                            {result.marketIntelligence.priceChangeYoY}
                          </p>
                        </div>
                      )}
                      {result.marketIntelligence.avgDaysOnMarket !=
                        null && (
                        <div className="p-2.5 rounded-lg bg-muted/50 text-center">
                          <p className="text-xs text-muted-foreground">
                            {isChinese ? "平均 DOM" : "Avg DOM"}
                          </p>
                          <p className="font-bold text-sm">
                            {result.marketIntelligence.avgDaysOnMarket}{" "}
                            {isChinese ? "天" : "days"}
                          </p>
                        </div>
                      )}
                      <div className="p-2.5 rounded-lg bg-muted/50 text-center">
                        <p className="text-xs text-muted-foreground">
                          {isChinese ? "市场类型" : "Market Type"}
                        </p>
                        <p className="font-bold text-sm capitalize">
                          {result.marketIntelligence.marketType}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      {result.marketIntelligence.citations.map(
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        (c: any, i: number) => (
                          <a
                            key={i}
                            href={c.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-muted/50 text-[10px] text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                          >
                            <ExternalLink className="w-2.5 h-2.5" />
                            {c.title?.slice(0, 40) ||
                              new URL(c.url).hostname}
                          </a>
                        ),
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Photo Analysis */}
              {result.subject?.photoAnalysis && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Camera className="w-4 h-4 text-amber-500" />
                      {isChinese ? "照片分析" : "Photo Analysis"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                      <div className="p-2.5 rounded-lg bg-muted/50 text-center">
                        <p className="text-xs text-muted-foreground">
                          {isChinese ? "状况评分" : "Condition"}
                        </p>
                        <p className="font-bold text-lg">
                          {
                            result.subject.photoAnalysis
                              .conditionScore
                          }
                          /10
                        </p>
                      </div>
                      <div className="p-2.5 rounded-lg bg-muted/50 text-center">
                        <p className="text-xs text-muted-foreground">
                          {isChinese ? "装修等级" : "Upgrade Level"}
                        </p>
                        <p className="font-bold text-sm capitalize">
                          {result.subject.photoAnalysis.upgradeLevel?.replace(
                            /_/g,
                            " ",
                          )}
                        </p>
                      </div>
                      <div className="p-2.5 rounded-lg bg-muted/50 text-center">
                        <p className="text-xs text-muted-foreground">
                          {isChinese ? "价值影响" : "Value Impact"}
                        </p>
                        <p className="font-bold text-sm capitalize">
                          {result.subject.photoAnalysis.valueImpact?.replace(
                            /_/g,
                            " ",
                          )}
                        </p>
                      </div>
                      <div className="p-2.5 rounded-lg bg-muted/50">
                        <p className="text-xs text-muted-foreground mb-1">
                          {isChinese ? "检测特征" : "Features"}
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {result.subject.photoAnalysis.detectedFeatures
                            ?.slice(0, 4)
                            .map((f: string) => (
                              <Badge
                                key={f}
                                variant="outline"
                                className="text-[9px] px-1.5 py-0"
                              >
                                {f.replace(/_/g, " ")}
                              </Badge>
                            ))}
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {isChinese
                        ? result.subject.photoAnalysis.narrative
                            ?.chinese
                        : result.subject.photoAnalysis.narrative
                            ?.english}
                    </p>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            /* Empty State */
            <Card className="flex-1">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-100 to-indigo-100 dark:from-violet-950/30 dark:to-indigo-950/30 flex items-center justify-center mb-4">
                  <BarChart3 className="w-8 h-8 text-violet-500" />
                </div>
                <h3 className="font-semibold mb-1">
                  {isChinese
                    ? "搜索房源或手动输入地址，开始生成 CMA"
                    : "Search a listing or enter an address to generate CMA"}
                </h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                  {isChinese
                    ? "系统将整合 BBO 向量匹配、RentCast 估价、Tavily 网络搜索、照片分析，生成专业的市场分析报告"
                    : "Combines BBO vector matching, RentCast AVM, Tavily web search, and photo analysis for comprehensive market analysis"}
                </p>
              </CardContent>
            </Card>
          )}

          {/* History */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                {copy.historyCard.title}
              </CardTitle>
              <CardDescription>
                {copy.historyCard.description}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {historyQuery.isLoading && (
                <p className="text-xs text-muted-foreground py-4 text-center">
                  <Loader2 className="w-4 h-4 animate-spin inline mr-1" />
                  {copy.historyCard.loading}
                </p>
              )}
              {historyQuery.data?.data?.length === 0 && (
                <p className="text-xs text-muted-foreground py-4 text-center">
                  {copy.historyCard.empty}
                </p>
              )}
              <div className="flex flex-col gap-2">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {historyQuery.data?.data?.map((report: any) => (
                  <div
                    key={report.id}
                    className="flex items-center justify-between p-2.5 rounded-lg border hover:bg-muted/50 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        <MapPin className="w-3 h-3 inline mr-1" />
                        {report.address || report.listingKey || "—"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(report.createdAt)} ·{" "}
                        {report.suggestedPriceLow &&
                        report.suggestedPriceHigh
                          ? `${report.suggestedPriceLow} – ${report.suggestedPriceHigh}`
                          : "—"}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {report.dataSources?.length > 0 && (
                        <Badge
                          variant="secondary"
                          className="text-[9px]"
                        >
                          {report.dataSources.length} sources
                        </Badge>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2"
                        onClick={() => {
                          if (report.reportResult) {
                            setResult(report.reportResult);
                            setEditedComps(new Map());
                            setRemovedCompIndices(new Set());
                            setEditingCompIdx(null);
                            setExpandedCompIdx(null);
                          }
                        }}
                      >
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
