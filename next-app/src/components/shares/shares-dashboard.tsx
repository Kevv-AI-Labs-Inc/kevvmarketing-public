"use client";

import { useState } from "react";
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
import { formatDateTime } from "@/lib/format";
import {
  Clock3,
  Copy,
  ExternalLink,
  Eye,
  Filter,
  Globe,
  Home,
  Loader2,
  MapPin,
  RotateCcw,
  Share2,
  Trash2,
  User,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

type ShareType = "all" | "listing_share" | "area_magnet" | "home_value" | "agent_site";

const SHARE_TYPE_ICON: Record<string, typeof Share2> = {
  listing_share: Share2,
  area_magnet: MapPin,
  home_value: Home,
  agent_site: User,
};

const SHARE_TYPE_COLOR: Record<string, string> = {
  listing_share: "bg-blue-500/10 text-blue-600 border-blue-200",
  area_magnet: "bg-violet-500/10 text-violet-600 border-violet-200",
  home_value: "bg-emerald-500/10 text-emerald-600 border-emerald-200",
  agent_site: "bg-amber-500/10 text-amber-600 border-amber-200",
};

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

export function SharesDashboard() {
  const { t, locale } = useT();
  const router = useRouter();

  const [filterType, setFilterType] = useState<ShareType>("all");
  const [search, setSearch] = useState("");

  const unifiedQuery = trpc.share.listUnified.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  const revokeShareMutation = trpc.share.revokeSession.useMutation({
    onSuccess: async () => {
      await unifiedQuery.refetch();
      toast.success(t("magicShare.shareLinkRevoked"));
    },
    onError: (error) => {
      toast.error(t("magicShare.revokeFailed"), { description: error.message });
    },
  });

  const handleCopyShareLink = async (sharePath: string) => {
    const shareUrl = window.location.origin + sharePath;
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success(t("magicShare.shareLinkCopied"), { description: shareUrl });
    } catch {
      toast.error(t("magicShare.copyFailed"));
    }
  };

  const handleOpenShare = (sharePath: string) => {
    window.open(window.location.origin + sharePath, "_blank", "noopener,noreferrer");
  };

  const describeFollowUpSignal = (signal: string) => {
    switch (signal) {
      case "hot": return t("magicShare.followUpHot");
      case "warm": return t("magicShare.followUpWarm");
      case "new": return t("magicShare.followUpNew");
      default: return t("magicShare.followUpQuiet");
    }
  };

  const shareTypeLabel = (shareType: string) => {
    switch (shareType) {
      case "listing_share": return t("shares.typeListingShare");
      case "area_magnet": return t("shares.typeAreaMagnet");
      case "home_value": return t("shares.typeHomeValue");
      case "agent_site": return t("shares.typeAgentSite");
      default: return shareType;
    }
  };

  const allShares = unifiedQuery.data ?? [];

  const filteredShares = allShares.filter((share) => {
    const typeMatch = filterType === "all" || share.shareType === filterType;
    const searchLower = search.toLowerCase();
    const textMatch =
      !search ||
      share.title?.toLowerCase().includes(searchLower) ||
      share.description?.toLowerCase().includes(searchLower) ||
      share.sharePath?.toLowerCase().includes(searchLower);
    return typeMatch && textMatch;
  });

  const countByType: Record<ShareType, number> = {
    all: allShares.length,
    listing_share: allShares.filter((s) => s.shareType === "listing_share").length,
    area_magnet: allShares.filter((s) => s.shareType === "area_magnet").length,
    home_value: allShares.filter((s) => s.shareType === "home_value").length,
    agent_site: allShares.filter((s) => s.shareType === "agent_site").length,
  };

  const filterTypes: ShareType[] = ["all", "listing_share", "area_magnet", "home_value", "agent_site"];

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="rounded-3xl border border-primary/10 bg-gradient-to-br from-primary/5 via-primary/2 to-transparent p-6 text-foreground shadow-sm md:p-8">
        <div className="flex items-center gap-2 text-sm text-primary">
          <Share2 className="h-4 w-4" />
          {t("shares.eyebrow")}
        </div>
        <h1 className="mt-2 text-3xl font-serif tracking-tight md:text-4xl">
          {t("shares.heroTitle")}
        </h1>
        <p className="mt-3 max-w-3xl text-sm text-muted-foreground md:text-base">
          {t("shares.heroDescription")}
        </p>

        {/* Quick actions */}
        <div className="mt-5 flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            className="border-primary/30 text-primary hover:bg-primary/5"
            onClick={() => router.push("/magic-share")}
          >
            <Share2 className="mr-2 h-3.5 w-3.5" />
            {t("shares.createListingShare")}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="border-primary/30 text-primary hover:bg-primary/5"
            onClick={() => router.push("/area-magnet")}
          >
            <MapPin className="mr-2 h-3.5 w-3.5" />
            {t("shares.createAreaMagnet")}
          </Button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {(["listing_share", "area_magnet", "home_value", "agent_site"] as const).map((type) => {
          const Icon = SHARE_TYPE_ICON[type] ?? Globe;
          const count = countByType[type];
          return (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`group rounded-2xl border p-4 text-left transition-colors hover:bg-muted/20 ${
                filterType === type ? "border-primary/40 bg-primary/5" : ""
              }`}
            >
              <div className="flex items-center gap-2">
                <div className={`rounded-lg p-2 ${SHARE_TYPE_COLOR[type]}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <span className="text-xs font-medium text-muted-foreground">
                  {shareTypeLabel(type)}
                </span>
              </div>
              <div className="mt-3 text-2xl font-semibold">{count}</div>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {filterTypes.map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                filterType === type
                  ? "bg-primary text-primary-foreground"
                  : "border border-border bg-muted/40 text-muted-foreground hover:bg-muted/60"
              }`}
            >
              {type === "all" ? t("shares.filterAll") : shareTypeLabel(type)}
              <span className="ml-1.5 opacity-70">
                {countByType[type]}
              </span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-8 pl-9 text-sm w-56"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("shares.searchPlaceholder")}
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            disabled={unifiedQuery.isFetching}
            onClick={() => unifiedQuery.refetch()}
          >
            {unifiedQuery.isFetching ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RotateCcw className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      </div>

      {/* Shares list */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{t("shares.listTitle")}</CardTitle>
              <CardDescription>{t("shares.listDescription")}</CardDescription>
            </div>
            <Badge variant="secondary">
              {filteredShares.length} / {allShares.length}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {unifiedQuery.isLoading ? (
            <div className="flex items-center py-12 text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t("magicShare.loadingShares")}
            </div>
          ) : filteredShares.length === 0 ? (
            <div className="rounded-2xl border border-dashed bg-muted/10 p-8 text-center text-sm text-muted-foreground">
              {allShares.length === 0 ? t("shares.emptyAll") : t("shares.emptyFiltered")}
            </div>
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              {filteredShares.map((share) => {
                const Icon = SHARE_TYPE_ICON[share.shareType] ?? Globe;
                const isRevokeAllowed =
                  share.status === "active" &&
                  share.shareType !== "agent_site" &&
                  share.id.startsWith("share_");

                return (
                  <div key={share.id} className="rounded-2xl border bg-muted/10 p-4 shadow-sm">
                    {/* Top: Preview + metadata */}
                    <div className="flex gap-4">
                      {/* OG preview thumb */}
                      <div className="hidden sm:flex h-20 w-20 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-muted/30">
                        {share.ogImageUrl ? (
                          <img
                            src={share.ogImageUrl}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <Icon className="h-8 w-8 text-muted-foreground/40" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">
                              {share.title}
                            </p>
                            <p className="mt-0.5 truncate text-xs text-muted-foreground">
                              {share.description}
                            </p>
                          </div>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <Badge variant="outline" className={SHARE_TYPE_COLOR[share.shareType]}>
                            {shareTypeLabel(share.shareType)}
                          </Badge>
                          <Badge variant={share.status === "active" ? "default" : "secondary"}>
                            {share.status}
                          </Badge>
                          <Badge variant="outline" className={followUpTone(share.followUpSignal)}>
                            {describeFollowUpSignal(share.followUpSignal)}
                          </Badge>
                          {share.shareType === "agent_site" && (
                            <Badge variant="outline" className="border-sky-200 bg-sky-50 text-sky-600">
                              {t("shares.permanentLink")}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
                      <div className="rounded-xl border bg-background/70 p-2.5">
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          {t("magicShare.views")}
                        </p>
                        <div className="mt-1.5 flex items-center gap-1.5 text-base font-semibold">
                          <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                          {share.viewCount}
                        </div>
                      </div>
                      <div className="rounded-xl border bg-background/70 p-2.5">
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          {t("shares.leads")}
                        </p>
                        <div className="mt-1.5 flex items-center gap-1.5 text-base font-semibold">
                          <Users className="h-3.5 w-3.5 text-muted-foreground" />
                          {share.leadCount}
                        </div>
                      </div>
                      {share.shareType !== "agent_site" && (
                        <>
                          <div className="rounded-xl border bg-background/70 p-2.5">
                            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                              {share.shareType === "home_value"
                                ? t("shares.valuations")
                                : t("magicShare.detailOpens")}
                            </p>
                            <p className="mt-1.5 text-base font-semibold">
                              {share.shareType === "home_value"
                                ? share.eventCounts.total - share.viewCount - share.leadCount
                                : share.eventCounts.listingOpen}
                            </p>
                          </div>
                          <div className="rounded-xl border bg-background/70 p-2.5">
                            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                              {t("magicShare.engagements")}
                            </p>
                            <p className="mt-1.5 text-base font-semibold">
                              {share.eventCounts.total}
                            </p>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Timestamp */}
                    <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock3 className="h-3.5 w-3.5" />
                      {share.lastActivityAt
                        ? t("magicShare.lastActivity") + " " + formatDateTime(share.lastActivityAt, locale)
                        : t("magicShare.createdAt") + " " + formatDateTime(share.createdAt, locale)}
                    </div>

                    {/* Actions */}
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCopyShareLink(share.sharePath)}
                      >
                        <Copy className="mr-2 h-4 w-4" />
                        {t("magicShare.copyLink")}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenShare(share.sharePath)}
                      >
                        <ExternalLink className="mr-2 h-4 w-4" />
                        {t("magicShare.openSharePage")}
                      </Button>
                      {isRevokeAllowed && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          disabled={revokeShareMutation.isPending}
                          onClick={() => {
                            const token = share.sharePath.replace("/s/", "");
                            revokeShareMutation.mutate({ token });
                          }}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          {t("magicShare.revoke")}
                        </Button>
                      )}
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
