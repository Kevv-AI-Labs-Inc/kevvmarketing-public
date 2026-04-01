"use client";

import { useState } from "react";
import {
  Badge,
} from "@/components/ui/badge";
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
  Loader2,
  RotateCcw,
  Share2,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

type SessionType = "all" | "listing_share" | "area_magnet";

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

function sessionTypeLabel(sessionType: string, t: ReturnType<typeof useT>["t"]) {
  if (sessionType === "area_magnet") return t("shares.typeAreaMagnet");
  if (sessionType === "listing_share") return t("shares.typeListingShare");
  return sessionType;
}

function sessionTypeBadgeVariant(sessionType: string): "default" | "secondary" | "outline" {
  if (sessionType === "area_magnet") return "outline";
  return "secondary";
}

export function SharesDashboard() {
  const { t, locale } = useT();
  const router = useRouter();
  const utils = trpc.useUtils();

  const [filterType, setFilterType] = useState<SessionType>("all");
  const [search, setSearch] = useState("");

  // Fetch ALL share sessions — no sessionType filter
  const sharesQuery = trpc.share.listMine.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  const revokeShareMutation = trpc.share.revokeSession.useMutation({
    onSuccess: async () => {
      await utils.share.listMine.invalidate();
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

  const describeSessionStatus = (status: string) => {
    switch (status) {
      case "active": return t("magicShare.statusActive");
      case "revoked": return t("magicShare.statusRevoked");
      case "expired": return t("magicShare.statusExpired");
      default: return status;
    }
  };

  const allShares = sharesQuery.data ?? [];

  // Client-side filter by type + search
  const filteredShares = allShares.filter((share) => {
    const typeMatch = filterType === "all" || share.sessionType === filterType;
    const searchLower = search.toLowerCase();
    const textMatch =
      !search ||
      share.title?.toLowerCase().includes(searchLower) ||
      share.clientName?.toLowerCase().includes(searchLower) ||
      share.sharePath?.toLowerCase().includes(searchLower);
    return typeMatch && textMatch;
  });

  const countByType = {
    all: allShares.length,
    listing_share: allShares.filter((s) => s.sessionType === "listing_share").length,
    area_magnet: allShares.filter((s) => s.sessionType === "area_magnet").length,
  };

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
            <Share2 className="mr-2 h-3.5 w-3.5" />
            {t("shares.createAreaMagnet")}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2">
          {(["all", "listing_share", "area_magnet"] as SessionType[]).map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                filterType === type
                  ? "bg-primary text-primary-foreground"
                  : "border border-border bg-muted/40 text-muted-foreground hover:bg-muted/60"
              }`}
            >
              {type === "all"
                ? t("shares.filterAll")
                : type === "listing_share"
                  ? t("shares.typeListingShare")
                  : t("shares.typeAreaMagnet")}
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
            disabled={sharesQuery.isFetching}
            onClick={() => sharesQuery.refetch()}
          >
            {sharesQuery.isFetching ? (
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
          {sharesQuery.isLoading ? (
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
                const engagementCount =
                  share.eventCounts.contactClick +
                  share.eventCounts.tourInterest +
                  share.eventCounts.routeRequest +
                  share.eventCounts.wechatCopy;

                return (
                  <div key={share.token} className="rounded-2xl border bg-muted/10 p-4 shadow-sm">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">
                          {share.title || t("magicShare.untitledShare")}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {(share.clientName || t("magicShare.noClient")) + " · " + share.sharePath}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {/* Session type badge */}
                        <Badge variant={sessionTypeBadgeVariant(share.sessionType)}>
                          {sessionTypeLabel(share.sessionType, t)}
                        </Badge>
                        <Badge variant={share.status === "active" ? "default" : "secondary"}>
                          {describeSessionStatus(share.status)}
                        </Badge>
                        <Badge variant="outline" className={followUpTone(share.followUpSignal)}>
                          {describeFollowUpSignal(share.followUpSignal)}
                        </Badge>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                      <div className="rounded-xl border bg-background/70 p-3">
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                          {t("magicShare.views")}
                        </p>
                        <div className="mt-2 flex items-center gap-2 text-lg font-semibold">
                          <Eye className="h-4 w-4 text-muted-foreground" />
                          {share.viewCount}
                        </div>
                      </div>
                      <div className="rounded-xl border bg-background/70 p-3">
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                          {t("magicShare.listingsLabel")}
                        </p>
                        <p className="mt-2 text-lg font-semibold">{share.listingCount}</p>
                      </div>
                      <div className="rounded-xl border bg-background/70 p-3">
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                          {t("magicShare.detailOpens")}
                        </p>
                        <p className="mt-2 text-lg font-semibold">{share.eventCounts.listingOpen}</p>
                      </div>
                      <div className="rounded-xl border bg-background/70 p-3">
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                          {t("magicShare.engagements")}
                        </p>
                        <p className="mt-2 text-lg font-semibold">{engagementCount}</p>
                      </div>
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
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        disabled={share.status !== "active" || revokeShareMutation.isPending}
                        onClick={() => revokeShareMutation.mutate({ token: share.token })}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        {t("magicShare.revoke")}
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
