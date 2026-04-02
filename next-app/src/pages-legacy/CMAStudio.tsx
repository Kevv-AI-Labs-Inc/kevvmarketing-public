// CMA Studio — Next-Gen 5-Stage Pipeline UI
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
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { trpc } from "@/lib/trpc";
import {
  ArrowRight,
  BarChart3,
  Building2,
  Camera,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Globe,
  Loader2,
  MapPin,
  Search,
  Share2,
  Sparkles,
  TrendingUp,
  Upload,
  X,
  Zap,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
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
  const copy = getDashboardPageCopy(locale).cmaStudio;
  const router = useRouter();
  const prefill = useMemo(() => parseCmaPrefillFromUrl(), []);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Input state
  const [inputTab, setInputTab] = useState<InputTab>("mls");
  const [search, setSearch] = useState("");
  const [selectedSubjectKey, setSelectedSubjectKey] = useState<string>(
    prefill.subjectKey,
  );

  // Manual input state
  const [manualAddress, setManualAddress] = useState("");
  const [manualCity, setManualCity] = useState("");
  const [manualState, setManualState] = useState("");
  const [manualZip, setManualZip] = useState("");
  const [manualPrice, setManualPrice] = useState("");
  const [manualBeds, setManualBeds] = useState("");
  const [manualBaths, setManualBaths] = useState("");
  const [manualSqft, setManualSqft] = useState("");
  const [manualYearBuilt, setManualYearBuilt] = useState("");
  const [manualType, setManualType] = useState("Residential");

  // Photos
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Settings
  const [compLimit, setCompLimit] = useState(
    prefill.limit ? String(prefill.limit) : "8",
  );
  const [enableWebSearch, setEnableWebSearch] = useState(true);
  const [enablePhotoAnalysis, setEnablePhotoAnalysis] = useState(true);
  const [agentName, setAgentName] = useState("");
  const [agentEmail, setAgentEmail] = useState("");
  const [agentPhone, setAgentPhone] = useState("");

  // Pipeline state
  const [generating, setGenerating] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [result, setResult] = useState<any>(null);
  const [pipelineStages, setPipelineStages] = useState<PipelineStage[]>([]);

  // ─── Queries ──────────────────────────────────────────────

  const propertiesQuery = trpc.mls.getProperties.useQuery({
    search: search || undefined,
    limit: 20,
    offset: 0,
    status: "Active",
  });

  const historyQuery = trpc.cma.list.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  // ─── Photo Upload ─────────────────────────────────────────

  const uploadPhotoMutation = trpc.cma.uploadPhoto.useMutation();

  async function handlePhotoUpload(file: File) {
    if (photoUrls.length >= 6) {
      toast.error(locale === "zh" ? "最多上传 6 张照片" : "Maximum 6 photos");
      return;
    }
    setUploadingPhoto(true);
    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve) => {
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(",")[1]); // strip data:image/...;base64,
        };
        reader.readAsDataURL(file);
      });

      const res = await uploadPhotoMutation.mutateAsync({
        base64,
        filename: file.name,
        contentType: file.type || "image/jpeg",
      });
      setPhotoUrls((prev) => [...prev, res.url]);
      toast.success(
        locale === "zh" ? "照片已上传" : "Photo uploaded",
      );
    } catch {
      toast.error(
        locale === "zh" ? "照片上传失败" : "Photo upload failed",
      );
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
      toast.error(
        locale === "zh" ? "请输入地址" : "Please enter an address",
      );
      return;
    }

    setGenerating(true);
    setResult(null);

    // Set up pipeline stages for visual tracking
    const stages: PipelineStage[] = [
      {
        key: "resolve",
        label: locale === "zh" ? "房源解析" : "Subject Resolution",
        icon: <Building2 className="w-4 h-4" />,
        status: "running",
      },
      ...(photoUrls.length > 0 && enablePhotoAnalysis
        ? [
            {
              key: "photos",
              label: locale === "zh" ? "照片分析" : "Photo Analysis",
              icon: <Camera className="w-4 h-4" />,
              status: "idle" as const,
            },
          ]
        : []),
      {
        key: "comps",
        label: locale === "zh" ? "可比房源" : "Comp Matching",
        icon: <BarChart3 className="w-4 h-4" />,
        status: "idle",
      },
      ...(enableWebSearch
        ? [
            {
              key: "web",
              label: locale === "zh" ? "市场搜索" : "Market Search",
              icon: <Globe className="w-4 h-4" />,
              status: "idle" as const,
            },
          ]
        : []),
      {
        key: "synthesis",
        label: locale === "zh" ? "报告生成" : "Report Generation",
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
                price: manualPrice || undefined,
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
        locale === "zh" ? "CMA 报告已生成" : "CMA Report Generated",
        {
          description:
            locale === "zh"
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
        locale === "zh" ? "CMA 生成失败" : "CMA Generation Failed",
        { description: (err as Error).message },
      );
    } finally {
      clearInterval(stageInterval);
      setGenerating(false);
    }
  }

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
        color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
        label: locale === "zh" ? "高置信" : "High",
      },
      medium: {
        color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
        label: locale === "zh" ? "中置信" : "Medium",
      },
      low: {
        color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
        label: locale === "zh" ? "低置信" : "Low",
      },
    };
    const { color, label } = map[confidence] || map.medium;
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
        {label}
      </span>
    );
  };

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
          <p className="text-sm text-muted-foreground">{copy.heroDescription}</p>
        </div>
      </div>

      {/* Pipeline Progress Bar */}
      {pipelineStages.length > 0 && (
        <div className="flex items-center gap-2 p-4 rounded-xl bg-muted/50 border overflow-x-auto">
          {pipelineStages.map((stage, i) => (
            <div key={stage.key} className="flex items-center gap-2 shrink-0">
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
                  {locale === "zh" ? "MLS 搜索" : "MLS Search"}
                </button>
                <button
                  onClick={() => setInputTab("manual")}
                  className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    inputTab === "manual"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {locale === "zh" ? "手动输入" : "Manual Input"}
                </button>
              </div>
            </CardHeader>
            <CardContent>
              {inputTab === "mls" ? (
                <div className="flex flex-col gap-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder={copy.subjectCard.searchPlaceholder}
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <ScrollArea className="max-h-[260px]">
                    <div className="flex flex-col gap-1.5">
                      {propertiesQuery.isLoading && (
                        <p className="text-xs text-muted-foreground py-4 text-center">
                          <Loader2 className="w-4 h-4 animate-spin inline mr-1" />
                          {copy.subjectCard.loadingProperties}
                        </p>
                      )}
                      {propertiesQuery.data?.map(
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        (p: any) => (
                          <button
                            key={p.listingKey}
                            onClick={() => setSelectedSubjectKey(p.listingKey)}
                            className={`w-full text-left p-2.5 rounded-lg border text-sm transition-colors ${
                              selectedSubjectKey === p.listingKey
                                ? "border-violet-500 bg-violet-50 dark:bg-violet-950/20"
                                : "border-transparent hover:bg-muted"
                            }`}
                          >
                            <div className="font-medium truncate">
                              {p.unparsedAddress || p.listingKey}
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {p.city} · {formatPrice(p.listPrice)} ·{" "}
                              {p.bedroomsTotal ?? "?"}bd/{p.bathroomsTotalInteger ?? "?"}ba ·{" "}
                              {p.livingArea ?? "?"}sqft
                            </div>
                          </button>
                        ),
                      )}
                      {propertiesQuery.data?.length === 0 && (
                        <p className="text-xs text-muted-foreground py-4 text-center">
                          {copy.subjectCard.noProperties}
                        </p>
                      )}
                    </div>
                  </ScrollArea>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <div className="col-span-2">
                    <label className="text-xs text-muted-foreground mb-1 block">
                      {locale === "zh" ? "地址 *" : "Address *"}
                    </label>
                    <Input
                      value={manualAddress}
                      onChange={(e) => setManualAddress(e.target.value)}
                      placeholder="123 Main St"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">
                      {locale === "zh" ? "城市" : "City"}
                    </label>
                    <Input
                      value={manualCity}
                      onChange={(e) => setManualCity(e.target.value)}
                      placeholder="Irvine"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">
                      {locale === "zh" ? "州" : "State"}
                    </label>
                    <Input
                      value={manualState}
                      onChange={(e) => setManualState(e.target.value)}
                      placeholder="CA"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">
                      {locale === "zh" ? "邮编" : "ZIP"}
                    </label>
                    <Input
                      value={manualZip}
                      onChange={(e) => setManualZip(e.target.value)}
                      placeholder="92618"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">
                      {locale === "zh" ? "价格" : "Price"}
                    </label>
                    <Input
                      value={manualPrice}
                      onChange={(e) => setManualPrice(e.target.value)}
                      placeholder="$1,200,000"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">
                      {locale === "zh" ? "卧室" : "Beds"}
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
                      {locale === "zh" ? "卫浴" : "Baths"}
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
                      {locale === "zh" ? "面积(sqft)" : "Sqft"}
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
                      {locale === "zh" ? "建造年份" : "Year Built"}
                    </label>
                    <Input
                      type="number"
                      value={manualYearBuilt}
                      onChange={(e) => setManualYearBuilt(e.target.value)}
                      placeholder="2005"
                    />
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
                {locale === "zh" ? "内景照片" : "Interior Photos"}
              </CardTitle>
              <CardDescription>
                {locale === "zh"
                  ? "上传房源内景照片，AI 自动分析装修条件（最多 6 张）"
                  : "Upload interior photos for AI condition assessment (max 6)"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {photoUrls.map((url, i) => (
                  <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden border group">
                    <img
                      src={url}
                      alt={`Photo ${i + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <button
                      onClick={() =>
                        setPhotoUrls((prev) => prev.filter((_, idx) => idx !== i))
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
                          {locale === "zh" ? "上传" : "Upload"}
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
                {locale === "zh" ? "生成设置" : "Settings"}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <label className="text-sm">
                  <Globe className="w-3.5 h-3.5 inline mr-1.5" />
                  {locale === "zh" ? "网络市场搜索 (Tavily)" : "Web Market Search (Tavily)"}
                </label>
                <button
                  onClick={() => setEnableWebSearch(!enableWebSearch)}
                  className={`w-9 h-5 rounded-full transition-colors ${
                    enableWebSearch ? "bg-violet-500" : "bg-muted"
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${
                      enableWebSearch ? "translate-x-4.5" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>
              <div className="flex items-center justify-between">
                <label className="text-sm">
                  <Camera className="w-3.5 h-3.5 inline mr-1.5" />
                  {locale === "zh" ? "AI 照片分析" : "AI Photo Analysis"}
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
              <div>
                <label className="text-sm mb-1 block">
                  {locale === "zh" ? "可比房源数量" : "Comparable Count"} ({compLimit})
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
                  placeholder={locale === "zh" ? "经纪人姓名" : "Agent Name"}
                  value={agentName}
                  onChange={(e) => setAgentName(e.target.value)}
                />
                <Input
                  placeholder={locale === "zh" ? "邮箱" : "Email"}
                  value={agentEmail}
                  onChange={(e) => setAgentEmail(e.target.value)}
                />
                <Input
                  placeholder={locale === "zh" ? "电话" : "Phone"}
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
                    {locale === "zh" ? "生成中..." : "Generating..."}
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
                      {locale === "zh" ? "执行摘要" : "Executive Summary"}
                    </CardTitle>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock3 className="w-3 h-3" />
                      {(result.totalLatencyMs / 1000).toFixed(1)}s
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-relaxed">
                    {locale === "zh"
                      ? result.executiveSummary?.chinese
                      : result.executiveSummary?.english}
                  </p>
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {result.dataSources?.map((src: string) => (
                      <Badge key={src} variant="secondary" className="text-[10px]">
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
                    {locale === "zh" ? "价格建议" : "Price Recommendation"}
                    {result.priceRecommendation?.confidence &&
                      confidenceBadge(result.priceRecommendation.confidence)}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-xs text-muted-foreground">
                        {locale === "zh" ? "低价" : "Low"}
                      </p>
                      <p className="text-lg font-bold text-red-600 dark:text-red-400">
                        {result.priceRecommendation?.low}
                      </p>
                    </div>
                    <div className="border-x">
                      <p className="text-xs text-muted-foreground">
                        {locale === "zh" ? "建议价" : "Midpoint"}
                      </p>
                      <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                        {result.priceRecommendation?.midpoint}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">
                        {locale === "zh" ? "高价" : "High"}
                      </p>
                      <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                        {result.priceRecommendation?.high}
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">
                    {result.priceRecommendation?.methodology}
                  </p>
                </CardContent>
              </Card>

              {/* Comparables Table */}
              {result.comparables?.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">
                      {locale === "zh" ? "可比房源" : "Comparable Sales"} ({result.comparables.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b text-muted-foreground">
                            <th className="text-left py-2 pr-3">{locale === "zh" ? "地址" : "Address"}</th>
                            <th className="text-right py-2 px-2">{locale === "zh" ? "售价" : "Sold"}</th>
                            <th className="text-right py-2 px-2">{locale === "zh" ? "调整价" : "Adjusted"}</th>
                            <th className="text-right py-2 px-2">{locale === "zh" ? "相似度" : "Score"}</th>
                            <th className="text-right py-2 pl-2">{locale === "zh" ? "详情" : "Details"}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                          {result.comparables.map((comp: any, i: number) => (
                            <tr key={i} className="border-b last:border-0 hover:bg-muted/50">
                              <td className="py-2 pr-3">
                                <div className="font-medium">{comp.address}</div>
                                <div className="text-muted-foreground">{comp.city}</div>
                              </td>
                              <td className="text-right py-2 px-2 font-medium">{comp.soldPrice}</td>
                              <td className="text-right py-2 px-2 font-medium text-emerald-600 dark:text-emerald-400">
                                {comp.adjustedPrice}
                              </td>
                              <td className="text-right py-2 px-2">
                                {comp.similarityScore != null
                                  ? `${(comp.similarityScore * 100).toFixed(0)}%`
                                  : "—"}
                              </td>
                              <td className="text-right py-2 pl-2 text-muted-foreground">
                                {comp.beds ?? "?"}bd/{comp.baths ?? "?"}ba · {comp.sqft ?? "?"}sqft
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
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
                      {locale === "zh" ? "市场情报" : "Market Intelligence"}
                      <Badge variant="secondary" className="text-[10px]">
                        Tavily
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                      {result.marketIntelligence.medianPrice && (
                        <div className="p-2.5 rounded-lg bg-muted/50 text-center">
                          <p className="text-xs text-muted-foreground">
                            {locale === "zh" ? "中位价" : "Median Price"}
                          </p>
                          <p className="font-bold text-sm">
                            {result.marketIntelligence.medianPrice}
                          </p>
                        </div>
                      )}
                      {result.marketIntelligence.priceChangeYoY && (
                        <div className="p-2.5 rounded-lg bg-muted/50 text-center">
                          <p className="text-xs text-muted-foreground">
                            {locale === "zh" ? "年涨幅" : "YoY Change"}
                          </p>
                          <p className="font-bold text-sm">
                            {result.marketIntelligence.priceChangeYoY}
                          </p>
                        </div>
                      )}
                      {result.marketIntelligence.avgDaysOnMarket != null && (
                        <div className="p-2.5 rounded-lg bg-muted/50 text-center">
                          <p className="text-xs text-muted-foreground">
                            {locale === "zh" ? "平均 DOM" : "Avg DOM"}
                          </p>
                          <p className="font-bold text-sm">
                            {result.marketIntelligence.avgDaysOnMarket}{" "}
                            {locale === "zh" ? "天" : "days"}
                          </p>
                        </div>
                      )}
                      <div className="p-2.5 rounded-lg bg-muted/50 text-center">
                        <p className="text-xs text-muted-foreground">
                          {locale === "zh" ? "市场类型" : "Market Type"}
                        </p>
                        <p className="font-bold text-sm capitalize">
                          {result.marketIntelligence.marketType}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      {result.marketIntelligence.citations.map((c: any, i: number) => (
                        <a
                          key={i}
                          href={c.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-muted/50 text-[10px] text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        >
                          <ExternalLink className="w-2.5 h-2.5" />
                          {c.title?.slice(0, 40) || new URL(c.url).hostname}
                        </a>
                      ))}
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
                      {locale === "zh" ? "照片分析" : "Photo Analysis"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                      <div className="p-2.5 rounded-lg bg-muted/50 text-center">
                        <p className="text-xs text-muted-foreground">
                          {locale === "zh" ? "状况评分" : "Condition"}
                        </p>
                        <p className="font-bold text-lg">
                          {result.subject.photoAnalysis.conditionScore}/10
                        </p>
                      </div>
                      <div className="p-2.5 rounded-lg bg-muted/50 text-center">
                        <p className="text-xs text-muted-foreground">
                          {locale === "zh" ? "装修等级" : "Upgrade Level"}
                        </p>
                        <p className="font-bold text-sm capitalize">
                          {result.subject.photoAnalysis.upgradeLevel?.replace(/_/g, " ")}
                        </p>
                      </div>
                      <div className="p-2.5 rounded-lg bg-muted/50 text-center">
                        <p className="text-xs text-muted-foreground">
                          {locale === "zh" ? "价值影响" : "Value Impact"}
                        </p>
                        <p className="font-bold text-sm capitalize">
                          {result.subject.photoAnalysis.valueImpact?.replace(/_/g, " ")}
                        </p>
                      </div>
                      <div className="p-2.5 rounded-lg bg-muted/50">
                        <p className="text-xs text-muted-foreground mb-1">
                          {locale === "zh" ? "检测特征" : "Features"}
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {result.subject.photoAnalysis.detectedFeatures?.slice(0, 4).map(
                            (f: string) => (
                              <Badge key={f} variant="outline" className="text-[9px] px-1.5 py-0">
                                {f.replace(/_/g, " ")}
                              </Badge>
                            ),
                          )}
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {locale === "zh"
                        ? result.subject.photoAnalysis.narrative?.chinese
                        : result.subject.photoAnalysis.narrative?.english}
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
                  {locale === "zh"
                    ? "选择房源或手动输入，开始生成 CMA"
                    : "Select a listing or enter details to generate CMA"}
                </h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                  {locale === "zh"
                    ? "系统将整合向量匹配、Tavily 网络搜索、照片分析，生成专业的市场分析报告"
                    : "The system will combine vector matching, Tavily web search, and photo analysis to create a comprehensive market analysis"}
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
              <CardDescription>{copy.historyCard.description}</CardDescription>
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
                        {report.suggestedPriceLow && report.suggestedPriceHigh
                          ? `${report.suggestedPriceLow} – ${report.suggestedPriceHigh}`
                          : "—"}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {report.dataSources?.length > 0 && (
                        <Badge variant="secondary" className="text-[9px]">
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
