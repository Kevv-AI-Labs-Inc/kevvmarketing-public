// legacy page — incrementally migrated
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  BarChart3,
  Copy,
  ExternalLink,
  Layers3,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Share2,
  Sparkles,
  Trash2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { useT } from "@/i18n";
import { pickText } from "@/i18n/copy";
import { trpc } from "@/lib/trpc";

type ScopeType = "zip" | "neighborhood" | "building";
type MagnetType = "spring_market" | "school_move_up" | "off_market_brief" | "renovation_roi";
type Audience = "seller" | "buyer" | "investor" | "move_up";
type Tone = "advisory" | "urgent" | "luxury";

type LocalizedText = { zh: string; en: string };

const scopeOptions: Array<{ value: ScopeType; label: LocalizedText; placeholder: LocalizedText }> = [
  {
    value: "zip",
    label: { zh: "邮编", en: "ZIP code" },
    placeholder: { zh: "例如 92618", en: "Example: 92618" },
  },
  {
    value: "neighborhood",
    label: { zh: "社区 / 小区", en: "Neighborhood" },
    placeholder: { zh: "例如 Tinton Falls", en: "Example: Tinton Falls" },
  },
  {
    value: "building",
    label: { zh: "公寓大楼", en: "Building" },
    placeholder: { zh: "例如 The Plaza", en: "Example: The Plaza" },
  },
];

const magnetOptions: Array<{
  value: MagnetType;
  label: LocalizedText;
  description: LocalizedText;
}> = [
  {
    value: "spring_market",
    label: { zh: "春季市场分析", en: "Spring market report" },
    description: {
      zh: "把库存、价格和节奏整理成一份可以直接转发的市场判断。",
      en: "Turn inventory, pricing, and tempo into a shareable market readout.",
    },
  },
  {
    value: "school_move_up",
    label: { zh: "学区置换指南", en: "School move-up guide" },
    description: {
      zh: "更适合触达置换家庭，强调供需与换房窗口。",
      en: "Built for move-up families, emphasizing supply, timing, and upgrade windows.",
    },
  },
  {
    value: "off_market_brief",
    label: { zh: "非公开成交简报", en: "Off-market brief" },
    description: {
      zh: "更偏向卖家话题，突出区域真实议价和供需压力。",
      en: "Seller-leaning brief focused on pricing power and local demand pressure.",
    },
  },
  {
    value: "renovation_roi",
    label: { zh: "翻新回报预测", en: "Renovation ROI" },
    description: {
      zh: "适合投资人和准备整装上市的卖家。",
      en: "Useful for investors or sellers planning a refresh before listing.",
    },
  },
];

const audienceOptions: Array<{ value: Audience; label: LocalizedText }> = [
  { value: "seller", label: { zh: "潜在卖家", en: "Potential sellers" } },
  { value: "buyer", label: { zh: "潜在买家", en: "Potential buyers" } },
  { value: "investor", label: { zh: "投资人", en: "Investors" } },
  { value: "move_up", label: { zh: "置换家庭", en: "Move-up families" } },
];

const toneOptions: Array<{ value: Tone; label: LocalizedText }> = [
  { value: "advisory", label: { zh: "顾问式", en: "Advisory" } },
  { value: "urgent", label: { zh: "强调窗口期", en: "Urgent" } },
  { value: "luxury", label: { zh: "高端精炼", en: "Luxury" } },
];

const staticCopy = {
  heroBadge: { zh: "内容化获客", en: "Content-driven acquisition" },
  heroTitle: { zh: "Area Magnet", en: "Area Magnet" },
  heroDescription: {
    zh: "Area Magnet 和 Magic Share 平行存在，但底层共用同一套 share session、公共链接、互动追踪和撤销机制。这里不是再做一篇文章，而是直接生成一个可留资、可分享、可跟进的区域诱饵。",
    en: "Area Magnet lives next to Magic Share, but both sit on the same share-session backbone, public links, engagement tracking, and revoke flow. This is not just another AI article. It is a lead-ready, shareable market asset.",
  },
  bridgeLabel: { zh: "并行入口", en: "Parallel entry" },
  bridgeAction: { zh: "打开 Magic Share", en: "Open Magic Share" },
  formTitle: { zh: "生成区域诱饵", en: "Generate area magnet" },
  formDescription: {
    zh: "只保留对经纪人有价值的结构化输入，不暴露空白 Prompt。系统会自动聚合 MLS 数据、生成叙事和分享页面。",
    en: "Keep the input structured and low-friction. The system will assemble listing data, write the narrative, and produce the share page automatically.",
  },
  advancedToggle: { zh: "经纪人信息与高级设置", en: "Agent profile and advanced settings" },
  create: { zh: "生成 Area Magnet", en: "Generate Area Magnet" },
  creating: { zh: "正在生成区域报告...", en: "Generating area report..." },
  openShare: { zh: "打开分享页", en: "Open share page" },
  copyLink: { zh: "复制链接", en: "Copy link" },
  copySuccess: { zh: "分享链接已复制", en: "Share link copied" },
  copyFailure: { zh: "复制失败，请检查浏览器权限", en: "Copy failed. Check browser permissions." },
  sectionResult: { zh: "这次生成了什么", en: "What this run produced" },
  resultEmpty: {
    zh: "生成完成后，这里会显示报告摘要、建议要点和分享链接。",
    en: "After generation, this panel will show the report summary, key talking points, and share link.",
  },
  tabsPreview: { zh: "公开页标签页", en: "Public share tabs" },
  tabs: [
    { zh: "Overview", en: "Overview" },
    { zh: "Report", en: "Report" },
    { zh: "Share Kit", en: "Share Kit" },
  ],
  libraryTitle: { zh: "My Area Magnets", en: "My Area Magnets" },
  libraryDescription: {
    zh: "查看最近生成的区域诱饵、浏览热度、留资数量和撤销状态。",
    en: "Review recent magnets, view activity, captured leads, and revoke status.",
  },
  emptyLibrary: {
    zh: "还没有区域诱饵。先生成第一条，再回来观察浏览和留资。",
    en: "No area magnets yet. Create the first one, then come back to watch visits and lead capture.",
  },
  generatedToast: { zh: "Area Magnet 已生成", en: "Area Magnet generated" },
  generateFailed: { zh: "生成失败", en: "Generation failed" },
  revoked: { zh: "分享链接已撤销", en: "Share link revoked" },
  revokeFailed: { zh: "撤销失败", en: "Failed to revoke share" },
  refresh: { zh: "刷新", en: "Refresh" },
  refreshing: { zh: "刷新中", en: "Refreshing" },
  loadingLibrary: { zh: "正在读取历史区域诱饵...", en: "Loading area magnet history..." },
  scopeLabel: { zh: "目标区域", en: "Target area" },
  captureLabel: { zh: "留资字段", en: "Capture fields" },
  phoneField: { zh: "手机号", en: "Phone" },
  emailField: { zh: "邮箱", en: "Email" },
  audienceLabel: { zh: "目标人群", en: "Target audience" },
  toneLabel: { zh: "叙事风格", en: "Narrative tone" },
  outputLabel: { zh: "系统输出", en: "System outputs" },
  outputItems: [
    { zh: "市场洞察报告", en: "Market insight report" },
    { zh: "可分享落地页", en: "Shareable landing page" },
    { zh: "社媒文案包", en: "Social copy kit" },
    { zh: "留资与跟进信号", en: "Lead capture and follow-up signals" },
  ],
  statsViews: { zh: "浏览", en: "Views" },
  statsLeads: { zh: "留资", en: "Leads" },
  statsListings: { zh: "示例房源", en: "Featured homes" },
  lastActivity: { zh: "最近活动", en: "Last activity" },
  createdAt: { zh: "创建于", en: "Created" },
  statusActive: { zh: "可访问", en: "Active" },
  statusRevoked: { zh: "已撤销", en: "Revoked" },
  statusExpired: { zh: "已过期", en: "Expired" },
  followHot: { zh: "高意向", en: "Hot" },
  followWarm: { zh: "值得跟进", en: "Warm" },
  followNew: { zh: "刚创建", en: "New" },
  followQuiet: { zh: "待唤醒", en: "Quiet" },
  revoke: { zh: "撤销", en: "Revoke" },
  generatedBy: { zh: "生成模型", en: "Generation model" },
  fallbackUsed: { zh: "已启用兜底叙事", en: "Fallback narrative used" },
};

function formatActivityTime(locale: "zh" | "en", value: string | null) {
  if (!value) return pickText(locale, staticCopy.createdAt);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed);
}

function describeSessionStatus(locale: "zh" | "en", status: string) {
  switch (status) {
    case "active":
      return pickText(locale, staticCopy.statusActive);
    case "revoked":
      return pickText(locale, staticCopy.statusRevoked);
    case "expired":
      return pickText(locale, staticCopy.statusExpired);
    default:
      return status;
  }
}

function describeFollowUpSignal(locale: "zh" | "en", signal: string) {
  switch (signal) {
    case "hot":
      return pickText(locale, staticCopy.followHot);
    case "warm":
      return pickText(locale, staticCopy.followWarm);
    case "new":
      return pickText(locale, staticCopy.followNew);
    default:
      return pickText(locale, staticCopy.followQuiet);
  }
}

function followUpTone(signal: string) {
  switch (signal) {
    case "hot":
      return "border-red-200 bg-red-50 text-red-700";
    case "warm":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "new":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    default:
      return "border-stone-200 bg-stone-50 text-stone-600";
  }
}

export default function AreaMagnetStudio() {
  const { user } = useAuth();
  const { locale } = useT();
  const utils = trpc.useUtils();
  const [scopeType, setScopeType] = useState<ScopeType>("zip");
  const [query, setQuery] = useState("");
  const [magnetType, setMagnetType] = useState<MagnetType>("spring_market");
  const [audience, setAudience] = useState<Audience>("seller");
  const [tone, setTone] = useState<Tone>("advisory");
  const [captureEmail, setCaptureEmail] = useState(true);
  const [capturePhone, setCapturePhone] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [generatedShareUrl, setGeneratedShareUrl] = useState("");
  const [generatedPreview, setGeneratedPreview] = useState<{
    title: string;
    scopeLabel: string;
    summary: string;
    strategyPoints: string[];
    metrics: Array<{ label?: string; value?: string; detail?: string }>;
    generatedBy: { model: string; usedFallback: boolean } | null;
  } | null>(null);

  const PROFILE_KEY = "bbo_agent_profile";

  const loadSavedProfile = useCallback(() => {
    try {
      const saved = localStorage.getItem(PROFILE_KEY);
      if (saved) return JSON.parse(saved) as Record<string, string>;
    } catch {
      // ignore
    }
    return null;
  }, []);

  const [agentTitle, setAgentTitle] = useState("");
  const [agentPhone, setAgentPhone] = useState("");
  const [agentEmail, setAgentEmail] = useState("");
  const [agentWechatId, setAgentWechatId] = useState("");
  const [agentAvatarUrl, setAgentAvatarUrl] = useState("");
  const [agentCompany, setAgentCompany] = useState("");

  useEffect(() => {
    const saved = loadSavedProfile();
    if (saved) {
      if (saved.agentTitle) setAgentTitle(saved.agentTitle);
      if (saved.agentPhone) setAgentPhone(saved.agentPhone);
      if (saved.agentWechatId) setAgentWechatId(saved.agentWechatId);
      if (saved.agentCompany) setAgentCompany(saved.agentCompany);
    }
  }, [loadSavedProfile]);

  useEffect(() => {
    const profile = { agentTitle, agentPhone, agentWechatId, agentCompany };
    const hasValue = Object.values(profile).some((value) => value.trim().length > 0);
    if (hasValue) {
      try {
        localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
      } catch {
        // ignore
      }
    }
  }, [agentTitle, agentPhone, agentWechatId, agentCompany]);

  useEffect(() => {
    if (user?.email && !agentEmail) setAgentEmail(user.email);
    if ((user as { picture?: string | null } | null)?.picture && !agentAvatarUrl) {
      setAgentAvatarUrl((user as { picture?: string }).picture || "");
    }
  }, [agentAvatarUrl, agentEmail, user]);

  const captureFields = useMemo<Array<"email" | "phone">>(() => {
    const values: Array<"email" | "phone"> = [];
    if (captureEmail) values.push("email");
    if (capturePhone) values.push("phone");
    return values.length > 0 ? values : (["email"] as Array<"email" | "phone">);
  }, [captureEmail, capturePhone]);

  const createAreaMagnetMutation = trpc.share.createAreaMagnet.useMutation({
    onSuccess: async (data) => {
      const shareUrl = data.shareUrl ?? `${window.location.origin}${data.sharePath}`;
      setGeneratedShareUrl(shareUrl);
      setGeneratedPreview({
        title: data.title,
        scopeLabel: data.scopeLabel,
        summary: data.preview.summary,
        strategyPoints: data.preview.strategyPoints,
        metrics: (data.preview.metrics as Array<{ label?: string; value?: string; detail?: string }>) ?? [],
        generatedBy: data.generatedBy,
      });
      try {
        await navigator.clipboard.writeText(shareUrl);
      } catch {
        // clipboard is best effort only
      }
      await utils.share.listMine.invalidate({ sessionType: "area_magnet" });
      toast.success(pickText(locale, staticCopy.generatedToast), { description: shareUrl });
    },
    onError: (error) => {
      toast.error(pickText(locale, staticCopy.generateFailed), { description: error.message });
    },
  });

  const mySharesQuery = trpc.share.listMine.useQuery(
    { sessionType: "area_magnet" },
    { refetchOnWindowFocus: false }
  );

  const revokeShareMutation = trpc.share.revokeSession.useMutation({
    onSuccess: async () => {
      await utils.share.listMine.invalidate({ sessionType: "area_magnet" });
      toast.success(pickText(locale, staticCopy.revoked));
    },
    onError: (error) => {
      toast.error(pickText(locale, staticCopy.revokeFailed), { description: error.message });
    },
  });

  const handleCreate = () => {
    if (!query.trim()) {
      toast.error(pickText(locale, staticCopy.scopeLabel));
      return;
    }

    const agentBranding =
      agentTitle || agentPhone || agentEmail || agentWechatId || agentAvatarUrl || agentCompany
        ? {
            agentTitle: agentTitle.trim() || undefined,
            phone: agentPhone.trim() || undefined,
            email: agentEmail.trim() || undefined,
            wechatId: agentWechatId.trim() || undefined,
            avatarUrl: agentAvatarUrl.trim() || undefined,
            brokerageName: agentCompany.trim() || undefined,
          }
        : {};

    createAreaMagnetMutation.mutate({
      scopeType,
      query: query.trim(),
      magnetType,
      audience,
      captureFields,
      tone,
      agentBranding,
    });
  };

  const handleCopyShareLink = async (sharePath: string) => {
    const shareUrl = `${window.location.origin}${sharePath}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success(pickText(locale, staticCopy.copySuccess), { description: shareUrl });
    } catch {
      toast.error(pickText(locale, staticCopy.copyFailure));
    }
  };

  const selectedScope = scopeOptions.find((option) => option.value === scopeType) ?? scopeOptions[0];

  return (
    <div className="space-y-6 pb-8">
      <div className="rounded-3xl border border-primary/10 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.16),_transparent_34%),linear-gradient(135deg,_rgba(255,255,255,0.98),_rgba(247,250,247,0.96))] p-6 text-foreground shadow-sm md:p-8">
        <div className="flex flex-wrap items-center gap-2 text-sm text-primary">
          <Badge variant="outline" className="rounded-full border-primary/20 bg-white/70 px-3 py-1 text-[11px] uppercase tracking-[0.24em]">
            {pickText(locale, staticCopy.heroBadge)}
          </Badge>
          <Badge variant="outline" className="rounded-full border-primary/20 bg-white/50 px-3 py-1 text-[11px] uppercase tracking-[0.24em]">
            {pickText(locale, staticCopy.bridgeLabel)}
          </Badge>
        </div>
        <div className="mt-4 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl space-y-3">
            <h1 className="text-3xl font-serif tracking-tight md:text-4xl">{pickText(locale, staticCopy.heroTitle)}</h1>
            <p className="text-sm leading-7 text-muted-foreground md:text-base">
              {pickText(locale, staticCopy.heroDescription)}
            </p>
          </div>
          <Button asChild variant="outline" className="rounded-full border-primary/25 bg-white/80">
            <Link href="/magic-share">
              {pickText(locale, staticCopy.bridgeAction)}
              <Share2 className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardHeader>
            <CardTitle>{pickText(locale, staticCopy.formTitle)}</CardTitle>
            <CardDescription>{pickText(locale, staticCopy.formDescription)}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 md:grid-cols-[180px_minmax(0,1fr)]">
              <div className="space-y-2">
                <Label>{pickText(locale, staticCopy.scopeLabel)}</Label>
                <Select value={scopeType} onValueChange={(value: ScopeType) => setScopeType(value)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {scopeOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {pickText(locale, option.label)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{pickText(locale, selectedScope.label)}</Label>
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={pickText(locale, selectedScope.placeholder)}
                />
              </div>
            </div>

            <div className="space-y-3">
              <Label>{pickText(locale, staticCopy.formTitle)}</Label>
              <div className="grid gap-3 md:grid-cols-2">
                {magnetOptions.map((option) => {
                  const active = option.value === magnetType;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      className={`rounded-2xl border p-4 text-left transition ${active ? "border-primary bg-primary/5 shadow-sm" : "border-border bg-background hover:border-primary/30"}`}
                      onClick={() => setMagnetType(option.value)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-foreground">{pickText(locale, option.label)}</p>
                          <p className="mt-2 text-sm leading-6 text-muted-foreground">
                            {pickText(locale, option.description)}
                          </p>
                        </div>
                        {active ? <Sparkles className="h-4 w-4 text-primary" /> : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>{pickText(locale, staticCopy.audienceLabel)}</Label>
                <Select value={audience} onValueChange={(value: Audience) => setAudience(value)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {audienceOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {pickText(locale, option.label)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{pickText(locale, staticCopy.toneLabel)}</Label>
                <Select value={tone} onValueChange={(value: Tone) => setTone(value)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {toneOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {pickText(locale, option.label)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{pickText(locale, staticCopy.captureLabel)}</Label>
                <div className="flex min-h-9 items-center gap-4 rounded-xl border bg-background px-3">
                  <Label className="gap-2 text-sm font-normal">
                    <Checkbox checked={captureEmail} onCheckedChange={(value) => setCaptureEmail(Boolean(value))} />
                    {pickText(locale, staticCopy.emailField)}
                  </Label>
                  <Label className="gap-2 text-sm font-normal">
                    <Checkbox checked={capturePhone} onCheckedChange={(value) => setCapturePhone(Boolean(value))} />
                    {pickText(locale, staticCopy.phoneField)}
                  </Label>
                </div>
              </div>
            </div>

            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-lg border border-dashed p-3 text-sm text-muted-foreground transition-colors hover:border-primary/30 hover:text-primary"
              onClick={() => setShowAdvanced((value) => !value)}
            >
              <Layers3 className="h-4 w-4" />
              {pickText(locale, staticCopy.advancedToggle)}
            </button>

            {showAdvanced ? (
              <div className="grid grid-cols-1 gap-3 rounded-2xl border bg-muted/10 p-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>{locale === "zh" ? "经纪人头衔" : "Agent title"}</Label>
                  <Input value={agentTitle} onChange={(event) => setAgentTitle(event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>{locale === "zh" ? "联系电话" : "Phone"}</Label>
                  <Input value={agentPhone} onChange={(event) => setAgentPhone(event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>{locale === "zh" ? "联系邮箱" : "Email"}</Label>
                  <Input value={agentEmail} onChange={(event) => setAgentEmail(event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>{locale === "zh" ? "微信号" : "WeChat ID"}</Label>
                  <Input value={agentWechatId} onChange={(event) => setAgentWechatId(event.target.value)} />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>{locale === "zh" ? "头像 URL" : "Avatar URL"}</Label>
                  <Input value={agentAvatarUrl} onChange={(event) => setAgentAvatarUrl(event.target.value)} />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>{locale === "zh" ? "公司 / 团队" : "Brokerage / team"}</Label>
                  <Input value={agentCompany} onChange={(event) => setAgentCompany(event.target.value)} />
                </div>
              </div>
            ) : null}

            <Button className="w-full gap-2" size="lg" disabled={createAreaMagnetMutation.isPending} onClick={handleCreate}>
              {createAreaMagnetMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {pickText(locale, staticCopy.creating)}
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  {pickText(locale, staticCopy.create)}
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{pickText(locale, staticCopy.sectionResult)}</CardTitle>
            <CardDescription>{pickText(locale, staticCopy.outputLabel)}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              {staticCopy.outputItems.map((item) => (
                <div key={item.en} className="rounded-2xl border bg-muted/10 p-4 text-sm text-muted-foreground">
                  {pickText(locale, item)}
                </div>
              ))}
            </div>

            <div className="rounded-2xl border bg-muted/10 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                {pickText(locale, staticCopy.tabsPreview)}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {staticCopy.tabs.map((item) => (
                  <Badge key={item.en} variant="secondary" className="rounded-full px-3 py-1">
                    {pickText(locale, item)}
                  </Badge>
                ))}
              </div>
            </div>

            {generatedPreview ? (
              <div className="space-y-4 rounded-2xl border bg-white p-4 shadow-sm">
                <div className="space-y-2">
                  <Badge variant="outline" className="rounded-full">
                    {generatedPreview.scopeLabel}
                  </Badge>
                  <h3 className="text-xl font-serif text-foreground">{generatedPreview.title}</h3>
                  <p className="text-sm leading-7 text-muted-foreground">{generatedPreview.summary}</p>
                </div>

                {generatedPreview.generatedBy ? (
                  <div className="rounded-2xl border bg-muted/10 p-3 text-sm text-muted-foreground">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-foreground">{pickText(locale, staticCopy.generatedBy)}:</span>
                      <Badge variant="secondary">{generatedPreview.generatedBy.model}</Badge>
                      {generatedPreview.generatedBy.usedFallback ? (
                        <Badge variant="outline">{pickText(locale, staticCopy.fallbackUsed)}</Badge>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                <div className="space-y-2">
                  {generatedPreview.strategyPoints.map((point) => (
                    <div key={point} className="rounded-xl border bg-muted/10 p-3 text-sm text-foreground">
                      {point}
                    </div>
                  ))}
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  {generatedPreview.metrics.slice(0, 4).map((metric, index) => (
                    <div key={`${metric.label}-${index}`} className="rounded-2xl border bg-muted/10 p-4">
                      <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">{metric.label || "Metric"}</p>
                      <p className="mt-2 text-xl font-semibold text-foreground">{metric.value || "—"}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{metric.detail || ""}</p>
                    </div>
                  ))}
                </div>

                {generatedShareUrl ? (
                  <div className="rounded-2xl border bg-muted/10 p-4">
                    <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Share URL</p>
                    <p className="mt-2 break-all text-sm font-medium text-foreground">{generatedShareUrl}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleCopyShareLink(generatedShareUrl.replace(window.location.origin, ""))}>
                        <Copy className="mr-2 h-4 w-4" />
                        {pickText(locale, staticCopy.copyLink)}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => window.open(generatedShareUrl, "_blank", "noopener,noreferrer")}>
                        <ExternalLink className="mr-2 h-4 w-4" />
                        {pickText(locale, staticCopy.openShare)}
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed bg-muted/10 p-5 text-sm text-muted-foreground">
                {pickText(locale, staticCopy.resultEmpty)}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>{pickText(locale, staticCopy.libraryTitle)}</CardTitle>
            <CardDescription>{pickText(locale, staticCopy.libraryDescription)}</CardDescription>
          </div>
          <Button variant="outline" size="sm" disabled={mySharesQuery.isFetching} onClick={() => mySharesQuery.refetch()}>
            {mySharesQuery.isFetching ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {pickText(locale, staticCopy.refreshing)}
              </>
            ) : (
              pickText(locale, staticCopy.refresh)
            )}
          </Button>
        </CardHeader>
        <CardContent>
          {mySharesQuery.isLoading ? (
            <div className="flex items-center py-8 text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {pickText(locale, staticCopy.loadingLibrary)}
            </div>
          ) : (mySharesQuery.data?.length ?? 0) === 0 ? (
            <div className="rounded-2xl border border-dashed bg-muted/10 p-6 text-sm text-muted-foreground">
              {pickText(locale, staticCopy.emptyLibrary)}
            </div>
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              {mySharesQuery.data?.map((share) => (
                <div key={share.token} className="rounded-2xl border bg-muted/10 p-4 shadow-sm">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{share.title || share.scopeLabel || "Area Magnet"}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{share.scopeLabel || share.sharePath}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant={share.status === "active" ? "default" : "secondary"}>
                        {describeSessionStatus(locale, share.status)}
                      </Badge>
                      <Badge variant="outline" className={followUpTone(share.followUpSignal)}>
                        {describeFollowUpSignal(locale, share.followUpSignal)}
                      </Badge>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-3">
                    <div className="rounded-xl border bg-background/70 p-3">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{pickText(locale, staticCopy.statsViews)}</p>
                      <div className="mt-2 flex items-center gap-2 text-lg font-semibold">
                        <BarChart3 className="h-4 w-4 text-muted-foreground" />
                        {share.viewCount}
                      </div>
                    </div>
                    <div className="rounded-xl border bg-background/70 p-3">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{pickText(locale, staticCopy.statsLeads)}</p>
                      <div className="mt-2 flex items-center gap-2 text-lg font-semibold">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        {share.leadCount}
                      </div>
                    </div>
                    <div className="rounded-xl border bg-background/70 p-3">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{pickText(locale, staticCopy.statsListings)}</p>
                      <div className="mt-2 flex items-center gap-2 text-lg font-semibold">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        {share.listingCount}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                    <Phone className="h-3.5 w-3.5" />
                    {share.lastActivityAt
                      ? `${pickText(locale, staticCopy.lastActivity)} ${formatActivityTime(locale, share.lastActivityAt)}`
                      : `${pickText(locale, staticCopy.createdAt)} ${formatActivityTime(locale, share.createdAt)}`}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleCopyShareLink(share.sharePath)}>
                      <Copy className="mr-2 h-4 w-4" />
                      {pickText(locale, staticCopy.copyLink)}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => window.open(`${window.location.origin}${share.sharePath}`, "_blank", "noopener,noreferrer")}>
                      <ExternalLink className="mr-2 h-4 w-4" />
                      {pickText(locale, staticCopy.openShare)}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      disabled={share.status !== "active" || revokeShareMutation.isPending}
                      onClick={() => revokeShareMutation.mutate({ token: share.token })}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      {pickText(locale, staticCopy.revoke)}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
