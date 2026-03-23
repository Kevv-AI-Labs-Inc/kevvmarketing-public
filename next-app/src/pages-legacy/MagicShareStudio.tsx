// legacy page — incrementally migrated
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import {
  Bath,
  BedDouble,
  ChevronDown,
  ChevronUp,
  Clock3,
  Copy,
  ExternalLink,
  Eye,
  Loader2,
  MapPin,
  Plus,
  Ruler,
  Search,
  Settings,
  Share2,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
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
  publicRemarks: string | null;
  latitude?: string | null;
  longitude?: string | null;
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
  listingId?: string | null;
  city?: string | null;
  stateOrProvince?: string | null;
  postalCode?: string | null;
}) {
  const full = item.unparsedAddress?.trim();
  if (full) return full;
  const fallback = [item.listingId, item.city, item.stateOrProvince, item.postalCode]
    .filter(Boolean)
    .join(" · ");
  return fallback || "地址未知";
}

function parsePrefillFromUrl() {
  if (typeof window === "undefined") {
    return { listingKeys: [] as string[], title: "", clientName: "" };
  }

  const params = new URLSearchParams(window.location.search);
  const listingKeys = Array.from(
    new Set(
      (params.get("listingKeys") || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    )
  ).slice(0, 15);

  return {
    listingKeys,
    title: params.get("title")?.trim() || "",
    clientName: params.get("clientName")?.trim() || "",
  };
}

function formatActivityTime(value: string | null) {
  if (!value) return "暂无活动";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed);
}

function describeFollowUpSignal(signal: string) {
  switch (signal) {
    case "hot":
      return "高意向";
    case "warm":
      return "值得跟进";
    case "new":
      return "刚创建";
    default:
      return "待唤醒";
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

function describeSessionStatus(status: string) {
  switch (status) {
    case "active":
      return "可访问";
    case "revoked":
      return "已撤销";
    case "expired":
      return "已过期";
    default:
      return status;
  }
}

export default function MagicShareStudio() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const prefill = useMemo(() => parsePrefillFromUrl(), []);

  const [search, setSearch] = useState("");
  const [selectedKeys, setSelectedKeys] = useState<string[]>(prefill.listingKeys);

  const [clientName, setClientName] = useState(prefill.clientName);
  const [clientNeeds, setClientNeeds] = useState("");
  const [headerTitle, setHeaderTitle] = useState(
    prefill.title || (prefill.clientName ? `${prefill.clientName} 的精选房源` : "精选房源推荐")
  );
  const [headerDescription, setHeaderDescription] = useState("");
  const [strategyPointsText, setStrategyPointsText] = useState("");

  const PROFILE_KEY = "bbo_agent_profile";

  // Load saved agent profile from localStorage
  const loadSavedProfile = useCallback(() => {
    try {
      const saved = localStorage.getItem(PROFILE_KEY);
      if (saved) return JSON.parse(saved) as Record<string, string>;
    } catch { /* ignore */ }
    return null;
  }, []);

  const [agentTitle, setAgentTitle] = useState("");
  const [agentPhone, setAgentPhone] = useState("");
  const [agentEmail, setAgentEmail] = useState("");
  const [agentWechatId, setAgentWechatId] = useState("");
  const [agentAvatarUrl, setAgentAvatarUrl] = useState("");
  const [agentCompany, setAgentCompany] = useState("");

  // Auto-load profile on mount
  useEffect(() => {
    const saved = loadSavedProfile();
    if (saved) {
      if (saved.agentTitle) setAgentTitle(saved.agentTitle);
      if (saved.agentPhone) setAgentPhone(saved.agentPhone);
      if (saved.agentWechatId) setAgentWechatId(saved.agentWechatId);
      if (saved.agentCompany) setAgentCompany(saved.agentCompany);
    }
  }, [loadSavedProfile]);

  // Auto-save profile whenever fields change
  useEffect(() => {
    const profile = { agentTitle, agentPhone, agentWechatId, agentCompany };
    const hasValue = Object.values(profile).some((v) => v.trim().length > 0);
    if (hasValue) {
      try { localStorage.setItem(PROFILE_KEY, JSON.stringify(profile)); } catch { /* ignore */ }
    }
  }, [agentTitle, agentPhone, agentWechatId, agentCompany]);

  useEffect(() => {
    if (user?.email && !agentEmail) {
      setAgentEmail(user.email);
    }
    if ((user as any)?.picture && !agentAvatarUrl) {
      setAgentAvatarUrl((user as any).picture);
    }
  }, [user, agentEmail, agentAvatarUrl]);

  const searchQuery = trpc.mls.getProperties.useQuery({
    search: search || undefined,
    limit: 20,
    offset: 0,
    status: "Active",
  });

  const selectedQuery = trpc.mls.getPropertiesByKeys.useQuery(
    { listingKeys: selectedKeys },
    { enabled: selectedKeys.length > 0, refetchOnWindowFocus: false }
  );

  const analyzeForShareMutation = trpc.smartMatch.analyzeForShare.useMutation({
    onSuccess: (data: any) => {
      if (data.headerDescription) setHeaderDescription(data.headerDescription);
      if (data.strategyPoints?.length > 0) setStrategyPointsText(data.strategyPoints.join("\n"));
      if (data.headerTitle) setHeaderTitle(data.headerTitle);
      toast.success("AI 分析完成", { description: "已自动填充标题、分享说明和策略要点" });
    },
    onError: (error) => {
      toast.error("AI 分析失败", { description: error.message });
    },
  });

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [generatedShareUrl, setGeneratedShareUrl] = useState("");

  const handleAiAutoFill = () => {
    if (selectedListings.length === 0) {
      toast.error("请先选择至少 1 套房源");
      return;
    }
    analyzeForShareMutation.mutate({
      listings: selectedListings.map((item) => ({
        address: displayAddress(item),
        price: item.listPrice ?? undefined,
        beds: item.bedroomsTotal != null ? String(item.bedroomsTotal) : undefined,
        baths: item.bathroomsTotalInteger != null ? String(item.bathroomsTotalInteger) : undefined,
        sqft: item.livingArea ?? undefined,
        propertyType: item.propertyType ?? undefined,
        city: item.city ?? undefined,
        publicRemarks: item.publicRemarks?.slice(0, 200) ?? undefined,
      })),
      clientNeeds: clientNeeds.trim() || undefined,
    });
  };

  const createShareMutation = trpc.share.createSession.useMutation({
    onSuccess: async (data) => {
      const shareUrl = data.shareUrl ?? window.location.origin + data.sharePath;
      setGeneratedShareUrl(shareUrl);
      try {
        await navigator.clipboard.writeText(shareUrl);
      } catch {
        // Ignore clipboard permission errors.
      }
      await utils.share.listMine.invalidate();
      toast.success("分享链接已生成", { description: shareUrl });
    },
    onError: (error) => {
      toast.error("生成分享失败", { description: error.message });
    },
  });

  const mySharesQuery = trpc.share.listMine.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  const revokeShareMutation = trpc.share.revokeSession.useMutation({
    onSuccess: async () => {
      await utils.share.listMine.invalidate();
      toast.success("分享链接已撤销");
    },
    onError: (error) => {
      toast.error("撤销失败", { description: error.message });
    },
  });

  const selectedListings = ((selectedQuery.data ?? []) as MlsListing[]).filter(Boolean);
  const selectedKeySet = useMemo(() => new Set(selectedKeys), [selectedKeys]);
  const searchResults = (searchQuery.data ?? []) as MlsListing[];

  const addListing = (listingKey: string) => {
    setSelectedKeys((prev) => {
      if (prev.includes(listingKey)) return prev;
      if (prev.length >= 15) {
        toast.error("最多选择 15 套房源");
        return prev;
      }
      return [...prev, listingKey];
    });
  };

  const removeListing = (listingKey: string) => {
    setSelectedKeys((prev) => prev.filter((item) => item !== listingKey));
  };

  const moveListing = (index: number, direction: -1 | 1) => {
    setSelectedKeys((prev) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= prev.length) return prev;
      const next = [...prev];
      const current = next[index];
      next[index] = next[nextIndex];
      next[nextIndex] = current;
      return next;
    });
  };

  const handleCreateShare = () => {
    if (selectedListings.length === 0) {
      toast.error("请先选择至少 1 套房源");
      return;
    }
    if (!headerTitle.trim()) {
      toast.error("请填写分享标题");
      return;
    }

    const strategyPoints = strategyPointsText
      .split("\n")
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
      .slice(0, 10);

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

    createShareMutation.mutate({
      title: headerTitle.trim(),
      introMessage: headerDescription.trim() || undefined,
      clientName: clientName.trim() || undefined,
      shareConfig: {
        strategyPoints: strategyPoints.length > 0 ? strategyPoints : undefined,
      },
      listingKeys: selectedKeys,
      agentBranding,
      externalListings: [],
    });
  };

  const handleCopyShareLink = async (sharePath: string) => {
    const shareUrl = window.location.origin + sharePath;
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("分享链接已复制", { description: shareUrl });
    } catch {
      toast.error("复制失败，请检查浏览器权限");
    }
  };

  const handleOpenShare = (sharePath: string) => {
    window.open(window.location.origin + sharePath, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="space-y-6 pb-8">
      <div className="rounded-3xl border border-primary/10 bg-gradient-to-br from-primary/5 via-primary/2 to-transparent p-6 text-foreground shadow-sm md:p-8">
        <div className="flex items-center gap-2 text-sm text-primary">
          <Share2 className="h-4 w-4" />
          分享工作流
        </div>
        <h1 className="mt-2 text-3xl font-serif tracking-tight md:text-4xl">Magic Share</h1>
        <p className="mt-3 max-w-3xl text-sm text-muted-foreground md:text-base">
          专注房源分享服务：统一创建 share session，生成可追踪、可撤销、可复用的客户分享链接。
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>房源选择</CardTitle>
            <CardDescription>仅支持 MLS 房源，不再支持粘贴外部链接抓取。</CardDescription>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-10"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜索地址或 Listing ID"
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl border bg-muted/20 p-3">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-medium">已选房源</p>
                <Badge variant="secondary">{selectedKeys.length} / 15</Badge>
              </div>
              {selectedQuery.isLoading ? (
                <div className="flex items-center text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  正在加载已选房源...
                </div>
              ) : selectedListings.length === 0 ? (
                <p className="text-sm text-muted-foreground">还没有选中房源</p>
              ) : (
                <div className="space-y-2">
                  {selectedListings.map((item, index) => (
                    <div key={item.listingKey} className="rounded-lg border bg-background p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{displayAddress(item)}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatPrice(item.listPrice)} · {item.listingId || item.listingKey}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            disabled={index === 0}
                            onClick={() => moveListing(index, -1)}
                          >
                            <ChevronUp className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            disabled={index === selectedListings.length - 1}
                            onClick={() => moveListing(index, 1)}
                          >
                            <ChevronDown className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive"
                            onClick={() => removeListing(item.listingKey)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <p className="mb-2 text-sm font-medium">搜索结果</p>
              <ScrollArea className="h-[420px] pr-3">
                <div className="space-y-2">
                  {searchQuery.isLoading ? (
                    <div className="flex items-center py-8 text-sm text-muted-foreground">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      正在读取房源...
                    </div>
                  ) : searchResults.length === 0 ? (
                    <p className="text-sm text-muted-foreground">暂无结果</p>
                  ) : (
                    searchResults.map((item) => {
                      const isSelected = selectedKeySet.has(item.listingKey);
                      return (
                        <div key={item.listingKey} className="rounded-xl border p-3">
                          <div className="flex items-start gap-3">
                            {item.thumbnailUrl ? (
                              <img
                                src={item.thumbnailUrl}
                                alt={displayAddress(item)}
                                className="h-20 w-28 rounded-md border object-cover"
                              />
                            ) : (
                              <div className="h-20 w-28 rounded-md border bg-muted/40" />
                            )}

                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold">{displayAddress(item)}</p>
                              <p className="mt-0.5 text-xs text-muted-foreground">{formatPrice(item.listPrice)}</p>
                              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                {item.bedroomsTotal != null ? (
                                  <span className="inline-flex items-center gap-1">
                                    <BedDouble className="h-3.5 w-3.5" />
                                    {item.bedroomsTotal}
                                  </span>
                                ) : null}
                                {item.bathroomsTotalInteger != null ? (
                                  <span className="inline-flex items-center gap-1">
                                    <Bath className="h-3.5 w-3.5" />
                                    {item.bathroomsTotalInteger}
                                  </span>
                                ) : null}
                                {item.livingArea ? (
                                  <span className="inline-flex items-center gap-1">
                                    <Ruler className="h-3.5 w-3.5" />
                                    {Number(item.livingArea).toLocaleString()} sqft
                                  </span>
                                ) : null}
                              </div>
                              <div className="mt-2 flex items-center justify-between">
                                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                                  <MapPin className="h-3.5 w-3.5" />
                                  {item.city || item.stateOrProvince || "位置未知"}
                                </span>
                                <Button
                                  size="sm"
                                  variant={isSelected ? "secondary" : "outline"}
                                  disabled={isSelected}
                                  onClick={() => addListing(item.listingKey)}
                                >
                                  {isSelected ? "已加入" : (
                                    <>
                                      <Plus className="mr-1 h-3.5 w-3.5" />
                                      加入
                                    </>
                                  )}
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </ScrollArea>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>分享配置</CardTitle>
            <CardDescription>填写必要信息，AI 帮你自动生成文案，然后一键分享。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Essential fields only */}
            <div className="space-y-2">
              <p className="text-sm font-medium">客户名称</p>
              <Input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="客户姓名" />
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">客户需求描述</p>
              <Textarea
                rows={3}
                value={clientNeeds}
                onChange={(e) => setClientNeeds(e.target.value)}
                placeholder="例如：预算区间、户型偏好、通勤需求、学区要求..."
              />
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">分享标题 *</p>
              <Input value={headerTitle} onChange={(e) => setHeaderTitle(e.target.value)} />
            </div>

            {/* AI Auto-fill */}
            <Button
              variant="outline"
              className="w-full gap-2 border-primary/30 text-primary hover:bg-primary/5"
              disabled={analyzeForShareMutation.isPending || selectedListings.length === 0}
              onClick={handleAiAutoFill}
            >
              {analyzeForShareMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  AI 正在分析房源...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  ✨ AI 一键填充文案
                </>
              )}
            </Button>

            <div className="space-y-2">
              <p className="text-sm font-medium">分享说明</p>
              <Textarea
                rows={3}
                value={headerDescription}
                onChange={(e) => setHeaderDescription(e.target.value)}
                placeholder="点击上方 AI 按钮自动生成，或手动编辑..."
              />
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">策略要点（每行一条）</p>
              <Textarea
                rows={3}
                value={strategyPointsText}
                onChange={(e) => setStrategyPointsText(e.target.value)}
                placeholder="点击上方 AI 按钮自动生成，或手动编辑..."
              />
            </div>

            {/* Collapsible advanced settings */}
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-lg border border-dashed p-3 text-sm text-muted-foreground hover:border-primary/30 hover:text-primary transition-colors"
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              <Settings className="h-4 w-4" />
              经纪人信息 & 高级设置
              <ChevronDown className={`ml-auto h-4 w-4 transition-transform ${showAdvanced ? "rotate-180" : ""}`} />
            </button>

            {showAdvanced && (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 rounded-lg border p-3 bg-muted/10">
                <div className="space-y-2">
                  <p className="text-sm font-medium">经纪人头衔</p>
                  <Input value={agentTitle} onChange={(e) => setAgentTitle(e.target.value)} placeholder="Your Local Listing Strategist" />
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">联系电话</p>
                  <Input value={agentPhone} onChange={(e) => setAgentPhone(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">联系邮箱</p>
                  <Input value={agentEmail} onChange={(e) => setAgentEmail(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">微信号</p>
                  <Input value={agentWechatId} onChange={(e) => setAgentWechatId(e.target.value)} />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <p className="text-sm font-medium">头像 URL</p>
                  <Input value={agentAvatarUrl} onChange={(e) => setAgentAvatarUrl(e.target.value)} />
                </div>
              </div>
            )}

            <Button
              className="w-full gap-2"
              size="lg"
              disabled={createShareMutation.isPending}
              onClick={handleCreateShare}
            >
              {createShareMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  正在生成分享链接...
                </>
              ) : (
                <>
                  <Share2 className="h-4 w-4" />
                  生成 Magic Share
                </>
              )}
            </Button>

            {generatedShareUrl ? (
              <div className="rounded-xl border bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">分享链接</p>
                <p className="break-all text-sm font-medium">{generatedShareUrl}</p>
                <div className="mt-3 flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigator.clipboard.writeText(generatedShareUrl)}
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    复制
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(generatedShareUrl, "_blank", "noopener,noreferrer")}
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    打开
                  </Button>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>My Shares</CardTitle>
            <CardDescription>查看最近生成的分享链接、互动热度和撤销状态，优先跟进高意向客户。</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{mySharesQuery.data?.length ?? 0} 条</Badge>
            <Button
              variant="outline"
              size="sm"
              disabled={mySharesQuery.isFetching}
              onClick={() => mySharesQuery.refetch()}
            >
              {mySharesQuery.isFetching ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  刷新中
                </>
              ) : "刷新"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {mySharesQuery.isLoading ? (
            <div className="flex items-center py-8 text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              正在读取历史分享...
            </div>
          ) : (mySharesQuery.data?.length ?? 0) === 0 ? (
            <div className="rounded-2xl border border-dashed bg-muted/10 p-6 text-sm text-muted-foreground">
              还没有历史分享。先生成第一条 Magic Share，再回来查看互动表现。
            </div>
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              {mySharesQuery.data?.map((share) => {
                const engagementCount =
                  share.eventCounts.contactClick +
                  share.eventCounts.tourInterest +
                  share.eventCounts.routeRequest +
                  share.eventCounts.wechatCopy;

                return (
                  <div key={share.token} className="rounded-2xl border bg-muted/10 p-4 shadow-sm">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{share.title || "未命名分享"}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {(share.clientName || "未指定客户") + " · " + share.sharePath}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant={share.status === "active" ? "default" : "secondary"}>
                          {describeSessionStatus(share.status)}
                        </Badge>
                        <Badge variant="outline" className={followUpTone(share.followUpSignal)}>
                          {describeFollowUpSignal(share.followUpSignal)}
                        </Badge>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                      <div className="rounded-xl border bg-background/70 p-3">
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">浏览</p>
                        <div className="mt-2 flex items-center gap-2 text-lg font-semibold">
                          <Eye className="h-4 w-4 text-muted-foreground" />
                          {share.viewCount}
                        </div>
                      </div>
                      <div className="rounded-xl border bg-background/70 p-3">
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">房源</p>
                        <p className="mt-2 text-lg font-semibold">{share.listingCount}</p>
                      </div>
                      <div className="rounded-xl border bg-background/70 p-3">
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">详情打开</p>
                        <p className="mt-2 text-lg font-semibold">{share.eventCounts.listingOpen}</p>
                      </div>
                      <div className="rounded-xl border bg-background/70 p-3">
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">有效互动</p>
                        <p className="mt-2 text-lg font-semibold">{engagementCount}</p>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock3 className="h-3.5 w-3.5" />
                      {share.lastActivityAt
                        ? "最近活动 " + formatActivityTime(share.lastActivityAt)
                        : "创建于 " + formatActivityTime(share.createdAt)}
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleCopyShareLink(share.sharePath)}>
                        <Copy className="mr-2 h-4 w-4" />
                        复制链接
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleOpenShare(share.sharePath)}>
                        <ExternalLink className="mr-2 h-4 w-4" />
                        打开分享页
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        disabled={share.status !== "active" || revokeShareMutation.isPending}
                        onClick={() => revokeShareMutation.mutate({ token: share.token })}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        撤销
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
