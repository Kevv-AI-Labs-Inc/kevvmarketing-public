// MagicShare Studio — Classic + Magic share modes
import { useAuth } from "@/hooks/useAuth";
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
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { useT } from "@/i18n";
import {
  Bath,
  BedDouble,
  Calendar,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Copy,
  DollarSign,
  ExternalLink,
  FileText,
  Loader2,
  MapPin,
  MessageSquareText,
  Plus,
  Ruler,
  Search,
  Send,
  Settings,
  Share2,
  Sparkles,
  Target,
  Trash2,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

/* ────────────────────────────────────────────────────────────── */
/*  Types                                                        */
/* ────────────────────────────────────────────────────────────── */

type ShareMode = "classic" | "magic" | "buyer_board" | "tour_recap" | "offer_worksheet";

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

/* ────────────────────────────────────────────────────────────── */
/*  Helpers                                                      */
/* ────────────────────────────────────────────────────────────── */

function formatPrice(price: string | null | undefined, fallback: string) {
  if (!price) return fallback;
  const num = Number(price);
  if (!Number.isFinite(num)) return price;
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000) return `$${(num / 1_000).toFixed(0)}K`;
  return `$${num.toLocaleString()}`;
}

function displayAddress(
  item: {
    unparsedAddress?: string | null;
    listingId?: string | null;
    city?: string | null;
    stateOrProvince?: string | null;
    postalCode?: string | null;
  },
  fallback: string
) {
  const full = item.unparsedAddress?.trim();
  if (full) return full;
  const fb = [
    item.listingId,
    item.city,
    item.stateOrProvince,
    item.postalCode,
  ]
    .filter(Boolean)
    .join(" · ");
  return fb || fallback;
}

function parsePrefillFromUrl() {
  if (typeof window === "undefined") {
    return { listingKeys: [] as string[], title: "", clientName: "", mode: "magic" as ShareMode };
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
    mode: (params.get("mode") === "classic" ? "classic" : "magic") as ShareMode,
  };
}

/* ────────────────────────────────────────────────────────────── */
/*  Tab Bar                                                      */
/* ────────────────────────────────────────────────────────────── */

const MODE_TABS: {
  id: ShareMode;
  icon: React.ReactNode;
}[] = [
  { id: "classic", icon: <FileText className="h-4 w-4" /> },
  { id: "magic", icon: <Sparkles className="h-4 w-4" /> },
  { id: "buyer_board", icon: <ClipboardList className="h-4 w-4" /> },
  { id: "tour_recap", icon: <MapPin className="h-4 w-4" /> },
  { id: "offer_worksheet", icon: <DollarSign className="h-4 w-4" /> },
];

/* ────────────────────────────────────────────────────────────── */
/*  Listing Search Card (shared between modes)                   */
/* ────────────────────────────────────────────────────────────── */

function ListingSearchCard({
  search,
  setSearch,
  selectedKeys,
  addListing,
  removeListing,
  moveListing,
  selectedListings,
  selectedKeySet,
  searchResults,
  searchLoading,
  selectedLoading,
  t,
}: {
  search: string;
  setSearch: (v: string) => void;
  selectedKeys: string[];
  addListing: (key: string) => void;
  removeListing: (key: string) => void;
  moveListing: (index: number, direction: -1 | 1) => void;
  selectedListings: MlsListing[];
  selectedKeySet: Set<string>;
  searchResults: MlsListing[];
  searchLoading: boolean;
  selectedLoading: boolean;
  t: (...args: any[]) => string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("magicShare.listingSelection")}</CardTitle>
        <CardDescription>
          {t("magicShare.listingSelectionDescription")}
        </CardDescription>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("magicShare.searchPlaceholder")}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Selected listings */}
        <div className="rounded-xl border bg-muted/20 p-3">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-medium">
              {t("magicShare.selectedListings")}
            </p>
            <Badge variant="secondary">{selectedKeys.length} / 15</Badge>
          </div>
          {selectedLoading ? (
            <div className="flex items-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t("magicShare.loadingSelected")}
            </div>
          ) : selectedListings.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("magicShare.noSelected")}
            </p>
          ) : (
            <div className="space-y-2">
              {selectedListings.map((item, index) => (
                <div
                  key={item.listingKey}
                  className="rounded-lg border bg-background p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      {item.thumbnailUrl ? (
                        <img
                          src={item.thumbnailUrl}
                          alt=""
                          className="h-10 w-14 rounded-md border object-cover shrink-0"
                        />
                      ) : (
                        <div className="h-10 w-14 rounded-md border bg-muted/30 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {displayAddress(
                            item,
                            t("listings.addressUnknown")
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatPrice(
                            item.listPrice,
                            t("listings.pricePending")
                          )}{" "}
                          · {item.listingId || item.listingKey}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
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

        {/* Search results */}
        <div>
          <p className="mb-2 text-sm font-medium">
            {t("magicShare.searchResults")}
          </p>
          <ScrollArea className="h-[380px] pr-3">
            <div className="space-y-2">
              {searchLoading ? (
                <div className="flex items-center py-8 text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("magicShare.loadingSearch")}
                </div>
              ) : searchResults.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t("magicShare.noResults")}
                </p>
              ) : (
                searchResults.map((item) => {
                  const isSelected = selectedKeySet.has(item.listingKey);
                  return (
                    <div
                      key={item.listingKey}
                      className="rounded-xl border p-3"
                    >
                      <div className="flex items-start gap-3">
                        {item.thumbnailUrl ? (
                          <img
                            src={item.thumbnailUrl}
                            alt={displayAddress(
                              item,
                              t("listings.addressUnknown")
                            )}
                            className="h-20 w-28 rounded-md border object-cover shrink-0"
                          />
                        ) : (
                          <div className="h-20 w-28 rounded-md border bg-muted/40 shrink-0" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">
                            {displayAddress(
                              item,
                              t("listings.addressUnknown")
                            )}
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {formatPrice(
                              item.listPrice,
                              t("listings.pricePending")
                            )}
                          </p>
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            {item.bedroomsTotal != null && (
                              <span className="inline-flex items-center gap-1">
                                <BedDouble className="h-3.5 w-3.5" />
                                {item.bedroomsTotal}
                              </span>
                            )}
                            {item.bathroomsTotalInteger != null && (
                              <span className="inline-flex items-center gap-1">
                                <Bath className="h-3.5 w-3.5" />
                                {item.bathroomsTotalInteger}
                              </span>
                            )}
                            {item.livingArea && (
                              <span className="inline-flex items-center gap-1">
                                <Ruler className="h-3.5 w-3.5" />
                                {Number(item.livingArea).toLocaleString()} sqft
                              </span>
                            )}
                          </div>
                          <div className="mt-2 flex items-center justify-between">
                            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                              <MapPin className="h-3.5 w-3.5" />
                              {item.city ||
                                item.stateOrProvince ||
                                t("magicShare.locationUnknown")}
                            </span>
                            <Button
                              size="sm"
                              variant={isSelected ? "secondary" : "outline"}
                              disabled={isSelected}
                              onClick={() => addListing(item.listingKey)}
                            >
                              {isSelected ? (
                                t("magicShare.added")
                              ) : (
                                <>
                                  <Plus className="mr-1 h-3.5 w-3.5" />
                                  {t("magicShare.add")}
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
  );
}

/* ────────────────────────────────────────────────────────────── */
/*  Main Component                                               */
/* ────────────────────────────────────────────────────────────── */

export default function MagicShareStudio() {
  const { t } = useT();
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const prefill = useMemo(() => parsePrefillFromUrl(), []);

  // ─── Mode ──────────────────────────────────────────
  const [mode, setMode] = useState<ShareMode>(prefill.mode);

  // ─── Shared state ──────────────────────────────────
  const [search, setSearch] = useState("");
  const [selectedKeys, setSelectedKeys] = useState<string[]>(
    prefill.listingKeys
  );
  const [generatedShareUrl, setGeneratedShareUrl] = useState("");

  // ─── Classic-only state ────────────────────────────
  const [classicNote, setClassicNote] = useState("");

  // ─── Buyer Board state ────────────────────────────
  const [boardTitle, setBoardTitle] = useState("");
  const [boardDescription, setBoardDescription] = useState("");
  const [boardClientName, setBoardClientName] = useState("");
  const [listingNotes, setListingNotes] = useState<Record<string, string>>({});

  // ─── Tour Recap state ─────────────────────────────
  const [tourDate, setTourDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [tourClientName, setTourClientName] = useState("");
  const [tourSummary, setTourSummary] = useState("");
  const [tourNextSteps, setTourNextSteps] = useState("");
  const [listingFeedback, setListingFeedback] = useState<Record<string, { agentNotes: string; highlights: string; concerns: string }>>({});

  // ─── Offer Worksheet state ────────────────────────
  const [offerClientName, setOfferClientName] = useState("");
  const [targetListingKey, setTargetListingKey] = useState("");
  const [suggestedOfferLow, setSuggestedOfferLow] = useState("");
  const [suggestedOfferHigh, setSuggestedOfferHigh] = useState("");
  const [agentRecommendation, setAgentRecommendation] = useState("");
  const [compNotes, setCompNotes] = useState<Record<string, { whyComparable: string; soldPrice: string; adjustmentNotes: string }>>({});

  // ─── Magic-only state ──────────────────────────────
  const [clientName, setClientName] = useState(prefill.clientName);
  const [clientNeeds, setClientNeeds] = useState("");
  const [headerTitle, setHeaderTitle] = useState(
    prefill.title ||
      (prefill.clientName
        ? t("magicShare.clientTitle", { name: prefill.clientName })
        : t("magicShare.defaultTitle"))
  );
  const [headerDescription, setHeaderDescription] = useState("");
  const [strategyPointsText, setStrategyPointsText] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  // ─── Agent branding ────────────────────────────────
  const profileQuery = trpc.profile.getMine.useQuery(undefined, {
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const [agentTitle, setAgentTitle] = useState("");
  const [agentPhone, setAgentPhone] = useState("");
  const [agentEmail, setAgentEmail] = useState("");
  const [agentWechatId, setAgentWechatId] = useState("");
  const [agentAvatarUrl, setAgentAvatarUrl] = useState("");
  const [agentCompany, setAgentCompany] = useState("");

  useEffect(() => {
    const p = profileQuery.data?.profile;
    if (!p) return;
    setAgentTitle((prev) => prev || p.title || "");
    setAgentPhone((prev) => prev || p.phone || "");
    setAgentEmail((prev) => prev || p.email || user?.email || "");
    setAgentWechatId((prev) => {
      if (prev) return prev;
      const socials = (p.socialLinks ?? {}) as Record<string, string>;
      return socials.wechat || "";
    });
    setAgentAvatarUrl((prev) => prev || p.photoUrl || "");
    setAgentCompany((prev) => prev || p.brokerage || "");
  }, [profileQuery.data, user]);

  // ─── Queries ───────────────────────────────────────
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

  const analyzeForShareMutation =
    trpc.smartMatch.analyzeForShare.useMutation({
      onSuccess: (data: any) => {
        if (data.headerDescription)
          setHeaderDescription(data.headerDescription);
        if (data.strategyPoints?.length > 0)
          setStrategyPointsText(data.strategyPoints.join("\n"));
        if (data.headerTitle) setHeaderTitle(data.headerTitle);
        toast.success(t("magicShare.aiAnalysisDone"), {
          description: t("magicShare.aiAnalysisDoneDescription"),
        });
      },
      onError: (error) => {
        toast.error(t("magicShare.aiAnalysisFailed"), {
          description: error.message,
        });
      },
    });

  const shareSuccessHandler = async (data: { shareUrl: string | null; sharePath: string }) => {
    const shareUrl = data.shareUrl ?? window.location.origin + data.sharePath;
    setGeneratedShareUrl(shareUrl);
    try { await navigator.clipboard.writeText(shareUrl); } catch { /* noop */ }
    await utils.share.listMine.invalidate();
    toast.success(t("magicShare.shareLinkGenerated"), { description: shareUrl });
  };
  const shareErrorHandler = (error: { message: string }) => {
    toast.error(t("magicShare.shareGenerateFailed"), { description: error.message });
  };

  const createShareMutation = trpc.share.createSession.useMutation({
    onSuccess: shareSuccessHandler,
    onError: shareErrorHandler,
  });

  const createBuyerBoardMutation = trpc.share.createBuyerBoard.useMutation({
    onSuccess: shareSuccessHandler,
    onError: shareErrorHandler,
  });

  const createTourRecapMutation = trpc.share.createTourRecap.useMutation({
    onSuccess: shareSuccessHandler,
    onError: shareErrorHandler,
  });

  const createOfferWorksheetMutation = trpc.share.createOfferWorksheet.useMutation({
    onSuccess: shareSuccessHandler,
    onError: shareErrorHandler,
  });

  const selectedListings = (
    (selectedQuery.data ?? []) as MlsListing[]
  ).filter(Boolean);
  const selectedKeySet = useMemo(
    () => new Set(selectedKeys),
    [selectedKeys]
  );
  const searchResults = (searchQuery.data ?? []) as MlsListing[];

  // ─── Listing Handlers ─────────────────────────────
  const addListing = (listingKey: string) => {
    setSelectedKeys((prev) => {
      if (prev.includes(listingKey)) return prev;
      if (prev.length >= 15) {
        toast.error(t("magicShare.maxListings"));
        return prev;
      }
      return [...prev, listingKey];
    });
  };

  const removeListing = (listingKey: string) => {
    setSelectedKeys((prev) =>
      prev.filter((item) => item !== listingKey)
    );
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

  // ─── AI Auto-fill (Magic only) ────────────────────
  const handleAiAutoFill = () => {
    if (selectedListings.length === 0) {
      toast.error(t("magicShare.selectAtLeastOne"));
      return;
    }
    analyzeForShareMutation.mutate({
      listings: selectedListings.map((item) => ({
        address: displayAddress(item, t("listings.addressUnknown")),
        price: item.listPrice ?? undefined,
        beds:
          item.bedroomsTotal != null
            ? String(item.bedroomsTotal)
            : undefined,
        baths:
          item.bathroomsTotalInteger != null
            ? String(item.bathroomsTotalInteger)
            : undefined,
        sqft: item.livingArea ?? undefined,
        propertyType: item.propertyType ?? undefined,
        city: item.city ?? undefined,
        publicRemarks: item.publicRemarks?.slice(0, 200) ?? undefined,
      })),
      clientNeeds: clientNeeds.trim() || undefined,
    });
  };

  // ─── Build agent branding ──────────────────────────
  const buildAgentBranding = () =>
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

  // ─── Create Share (Classic / Magic) ──────────────
  const handleCreateShare = () => {
    if (selectedListings.length === 0) {
      toast.error(t("magicShare.selectAtLeastOne"));
      return;
    }
    const agentBranding = buildAgentBranding();

    if (mode === "classic") {
      const firstListing = selectedListings[0];
      const autoTitle =
        selectedListings.length === 1
          ? displayAddress(firstListing, t("listings.addressUnknown"))
          : t("magicShare.classicMultiTitle", { count: String(selectedListings.length) });
      createShareMutation.mutate({
        title: autoTitle,
        introMessage: classicNote.trim() || undefined,
        listingKeys: selectedKeys,
        shareConfig: { shareMode: "classic", agentNote: classicNote.trim() || undefined },
        agentBranding,
        externalListings: [],
      });
    } else {
      if (!headerTitle.trim()) { toast.error(t("magicShare.fillShareTitle")); return; }
      const strategyPoints = strategyPointsText.split("\n").map((s) => s.trim()).filter(Boolean).slice(0, 10);
      createShareMutation.mutate({
        title: headerTitle.trim(),
        introMessage: headerDescription.trim() || undefined,
        clientName: clientName.trim() || undefined,
        shareConfig: { shareMode: "magic", strategyPoints: strategyPoints.length > 0 ? strategyPoints : undefined },
        listingKeys: selectedKeys,
        agentBranding,
        externalListings: [],
      });
    }
  };

  // ─── Create Buyer Board ──────────────────────────
  const handleCreateBuyerBoard = () => {
    if (selectedListings.length === 0) { toast.error(t("magicShare.selectAtLeastOne")); return; }
    const title = boardTitle.trim() || (boardClientName.trim() ? `${boardClientName.trim()}'s Board` : `${selectedListings.length} Listings Board`);
    createBuyerBoardMutation.mutate({
      title,
      clientName: boardClientName.trim() || undefined,
      boardDescription: boardDescription.trim() || undefined,
      listingKeys: selectedKeys,
      listingNotes,
      agentBranding: buildAgentBranding(),
    });
  };

  // ─── Create Tour Recap ───────────────────────────
  const handleCreateTourRecap = () => {
    if (selectedListings.length === 0) { toast.error(t("magicShare.selectAtLeastOne")); return; }
    const nextSteps = tourNextSteps.split("\n").map((s) => s.trim()).filter(Boolean).slice(0, 10);
    const feedbackForApi: Record<string, { agentNotes: string; tourOrder: number; highlights?: string; concerns?: string }> = {};
    selectedKeys.forEach((key, idx) => {
      const fb = listingFeedback[key];
      feedbackForApi[key] = {
        agentNotes: fb?.agentNotes?.trim() || "",
        tourOrder: idx,
        highlights: fb?.highlights?.trim() || undefined,
        concerns: fb?.concerns?.trim() || undefined,
      };
    });
    createTourRecapMutation.mutate({
      title: tourClientName.trim() ? `Tour Recap — ${tourClientName.trim()}` : `Tour Recap — ${tourDate}`,
      clientName: tourClientName.trim() || undefined,
      tourDate,
      overallSummary: tourSummary.trim() || undefined,
      nextSteps: nextSteps.length > 0 ? nextSteps : undefined,
      listingKeys: selectedKeys,
      listingFeedback: feedbackForApi,
      agentBranding: buildAgentBranding(),
    });
  };

  // ─── Create Offer Worksheet ──────────────────────
  const handleCreateOfferWorksheet = () => {
    if (selectedListings.length === 0) { toast.error(t("magicShare.selectAtLeastOne")); return; }
    const target = targetListingKey || selectedKeys[0];
    if (!target) { toast.error(t("magicShare.selectAtLeastOne")); return; }
    const comps = selectedKeys.filter((k) => k !== target).map((k) => ({
      listingKey: k,
      whyComparable: compNotes[k]?.whyComparable?.trim() || "",
      soldPrice: compNotes[k]?.soldPrice ? Number(compNotes[k].soldPrice) : undefined,
      adjustmentNotes: compNotes[k]?.adjustmentNotes?.trim() || undefined,
    }));
    const title = offerClientName.trim()
      ? `Offer Analysis — ${offerClientName.trim()}`
      : `Offer Analysis — ${displayAddress(selectedListings.find((l) => l.listingKey === target) ?? selectedListings[0], "Property")}`;
    createOfferWorksheetMutation.mutate({
      title,
      clientName: offerClientName.trim() || undefined,
      targetListingKey: target,
      listingKeys: selectedKeys,
      suggestedOfferLow: suggestedOfferLow ? Number(suggestedOfferLow) : undefined,
      suggestedOfferHigh: suggestedOfferHigh ? Number(suggestedOfferHigh) : undefined,
      agentRecommendation: agentRecommendation.trim() || undefined,
      comparables: comps.length > 0 ? comps : undefined,
      agentBranding: buildAgentBranding(),
    });
  };

  const isAnyMutationPending = createShareMutation.isPending || createBuyerBoardMutation.isPending || createTourRecapMutation.isPending || createOfferWorksheetMutation.isPending;

  // ─── Render ────────────────────────────────────────
  return (
    <div className="space-y-6 pb-8">
      {/* ─── Hero ──────────────────────────────────── */}
      <div className="rounded-3xl border border-primary/10 bg-gradient-to-br from-primary/5 via-primary/2 to-transparent p-6 text-foreground shadow-sm md:p-8">
        <div className="flex items-center gap-2 text-sm text-primary">
          <Share2 className="h-4 w-4" />
          {t("magicShare.eyebrow")}
        </div>
        <h1 className="mt-2 text-3xl font-serif tracking-tight md:text-4xl">
          {t("magicShare.heroTitleV2")}
        </h1>
        <p className="mt-3 max-w-3xl text-sm text-muted-foreground md:text-base">
          {t("magicShare.heroDescriptionV2")}
        </p>
      </div>

      {/* ─── Mode Tabs ─────────────────────────────── */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {MODE_TABS.map((tab) => {
          const active = mode === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setMode(tab.id);
                setGeneratedShareUrl("");
              }}
              className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all whitespace-nowrap ${
                active
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {tab.icon}
              {(t as any)(`magicShare.tab_${tab.id}`)}
            </button>
          );
        })}
      </div>

      {/* ═══════ CLASSIC MODE ═══════ */}
      {mode === "classic" && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <ListingSearchCard
            search={search}
            setSearch={setSearch}
            selectedKeys={selectedKeys}
            addListing={addListing}
            removeListing={removeListing}
            moveListing={moveListing}
            selectedListings={selectedListings}
            selectedKeySet={selectedKeySet}
            searchResults={searchResults}
            searchLoading={searchQuery.isLoading}
            selectedLoading={selectedQuery.isLoading}
            t={t}
          />

          {/* Classic — Minimal config */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  {t("magicShare.classicTitle")}
                </CardTitle>
                <CardDescription>
                  {t("magicShare.classicDesc")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Optional personal note */}
                <div className="space-y-2">
                  <p className="text-sm font-medium">
                    {t("magicShare.classicNote")}
                  </p>
                  <Textarea
                    rows={3}
                    value={classicNote}
                    onChange={(e) => setClassicNote(e.target.value)}
                    placeholder={t("magicShare.classicNotePlaceholder")}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t("magicShare.classicNoteHint")}
                  </p>
                </div>

                {/* Summary preview */}
                {selectedListings.length > 0 && (
                  <div className="rounded-xl border bg-muted/20 p-4 space-y-3">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                      {t("magicShare.classicPreview")}
                    </p>
                    {selectedListings.slice(0, 5).map((item) => (
                      <div
                        key={item.listingKey}
                        className="flex items-center gap-3"
                      >
                        {item.thumbnailUrl ? (
                          <img
                            src={item.thumbnailUrl}
                            alt=""
                            className="h-10 w-14 rounded-md border object-cover shrink-0"
                          />
                        ) : (
                          <div className="h-10 w-14 rounded-md border bg-muted/30 shrink-0" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {displayAddress(
                              item,
                              t("listings.addressUnknown")
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatPrice(
                              item.listPrice,
                              t("listings.pricePending")
                            )}
                            {item.bedroomsTotal != null &&
                              ` · ${item.bedroomsTotal}bd`}
                            {item.bathroomsTotalInteger != null &&
                              ` ${item.bathroomsTotalInteger}ba`}
                            {item.livingArea &&
                              ` · ${Number(item.livingArea).toLocaleString()} sqft`}
                          </p>
                        </div>
                      </div>
                    ))}
                    {selectedListings.length > 5 && (
                      <p className="text-xs text-muted-foreground">
                        +{selectedListings.length - 5} more
                      </p>
                    )}
                  </div>
                )}

                {/* Generate button */}
                <Button
                  className="w-full gap-2"
                  size="lg"
                  disabled={
                    createShareMutation.isPending ||
                    selectedListings.length === 0
                  }
                  onClick={handleCreateShare}
                >
                  {createShareMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {t("magicShare.generating")}
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      {t("magicShare.classicGenerate")}
                    </>
                  )}
                </Button>

                {/* Generated link */}
                {generatedShareUrl && <ShareLinkResult url={generatedShareUrl} t={t} />}
              </CardContent>
            </Card>

            {/* Info card */}
            <Card className="border-dashed">
              <CardContent className="p-4 space-y-2">
                <p className="text-sm font-medium">
                  {t("magicShare.classicVsMagic")}
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {t("magicShare.classicVsMagicDesc")}
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-primary"
                  onClick={() => setMode("magic")}
                >
                  <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                  {t("magicShare.switchToMagic")}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ═══════ MAGIC MODE ═══════ */}
      {mode === "magic" && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <ListingSearchCard
            search={search}
            setSearch={setSearch}
            selectedKeys={selectedKeys}
            addListing={addListing}
            removeListing={removeListing}
            moveListing={moveListing}
            selectedListings={selectedListings}
            selectedKeySet={selectedKeySet}
            searchResults={searchResults}
            searchLoading={searchQuery.isLoading}
            selectedLoading={selectedQuery.isLoading}
            t={t}
          />

          <Card>
            <CardHeader>
              <CardTitle>{t("magicShare.shareConfig")}</CardTitle>
              <CardDescription>
                {t("magicShare.shareConfigDescription")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm font-medium">
                  {t("magicShare.clientName")}
                </p>
                <Input
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder={t("magicShare.clientNamePlaceholder")}
                />
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">
                  {t("magicShare.clientNeeds")}
                </p>
                <Textarea
                  rows={3}
                  value={clientNeeds}
                  onChange={(e) => setClientNeeds(e.target.value)}
                  placeholder={t("magicShare.clientNeedsPlaceholder")}
                />
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">
                  {t("magicShare.shareTitle")}
                </p>
                <Input
                  value={headerTitle}
                  onChange={(e) => setHeaderTitle(e.target.value)}
                />
              </div>

              {/* AI Auto-fill */}
              <Button
                variant="outline"
                className="w-full gap-2 border-primary/30 text-primary hover:bg-primary/5"
                disabled={
                  analyzeForShareMutation.isPending ||
                  selectedListings.length === 0
                }
                onClick={handleAiAutoFill}
              >
                {analyzeForShareMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t("magicShare.aiAnalyzing")}
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    {t("magicShare.aiAutoFill")}
                  </>
                )}
              </Button>

              <div className="space-y-2">
                <p className="text-sm font-medium">
                  {t("magicShare.shareDescription")}
                </p>
                <Textarea
                  rows={3}
                  value={headerDescription}
                  onChange={(e) => setHeaderDescription(e.target.value)}
                  placeholder={t("magicShare.shareDescriptionPlaceholder")}
                />
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">
                  {t("magicShare.strategyPoints")}
                </p>
                <Textarea
                  rows={3}
                  value={strategyPointsText}
                  onChange={(e) => setStrategyPointsText(e.target.value)}
                  placeholder={t("magicShare.strategyPlaceholder")}
                />
              </div>

              {/* Collapsible advanced settings */}
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-lg border border-dashed p-3 text-sm text-muted-foreground hover:border-primary/30 hover:text-primary transition-colors"
                onClick={() => setShowAdvanced(!showAdvanced)}
              >
                <Settings className="h-4 w-4" />
                {t("magicShare.advancedSettings")}
                <ChevronDown
                  className={`ml-auto h-4 w-4 transition-transform ${
                    showAdvanced ? "rotate-180" : ""
                  }`}
                />
              </button>

              {showAdvanced && (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 rounded-lg border p-3 bg-muted/10">
                  <div className="space-y-2">
                    <p className="text-sm font-medium">
                      {t("magicShare.agentTitle")}
                    </p>
                    <Input
                      value={agentTitle}
                      onChange={(e) => setAgentTitle(e.target.value)}
                      placeholder="Your Local Listing Strategist"
                    />
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium">
                      {t("magicShare.agentPhone")}
                    </p>
                    <Input
                      value={agentPhone}
                      onChange={(e) => setAgentPhone(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium">
                      {t("magicShare.agentEmail")}
                    </p>
                    <Input
                      value={agentEmail}
                      onChange={(e) => setAgentEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium">
                      {t("magicShare.wechatId")}
                    </p>
                    <Input
                      value={agentWechatId}
                      onChange={(e) => setAgentWechatId(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <p className="text-sm font-medium">
                      {t("magicShare.avatarUrl")}
                    </p>
                    <Input
                      value={agentAvatarUrl}
                      onChange={(e) => setAgentAvatarUrl(e.target.value)}
                    />
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
                    {t("magicShare.generating")}
                  </>
                ) : (
                  <>
                    <Share2 className="h-4 w-4" />
                    {t("magicShare.generate")}
                  </>
                )}
              </Button>

              {generatedShareUrl && <ShareLinkResult url={generatedShareUrl} t={t} />}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ═══════ BUYER BOARD MODE ═══════ */}
      {mode === "buyer_board" && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <ListingSearchCard
            search={search}
            setSearch={setSearch}
            selectedKeys={selectedKeys}
            addListing={addListing}
            removeListing={removeListing}
            moveListing={moveListing}
            selectedListings={selectedListings}
            selectedKeySet={selectedKeySet}
            searchResults={searchResults}
            searchLoading={searchQuery.isLoading}
            selectedLoading={selectedQuery.isLoading}
            t={t}
          />

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ClipboardList className="h-4 w-4" />
                  {(t as any)("magicShare.buyerBoardTitle")}
                </CardTitle>
                <CardDescription>
                  {(t as any)("magicShare.buyerBoardDesc")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <p className="text-sm font-medium">{(t as any)("magicShare.boardClientName")}</p>
                    <Input
                      value={boardClientName}
                      onChange={(e) => setBoardClientName(e.target.value)}
                      placeholder="e.g. Sarah & David"
                    />
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium">{(t as any)("magicShare.boardTitleLabel")}</p>
                    <Input
                      value={boardTitle}
                      onChange={(e) => setBoardTitle(e.target.value)}
                      placeholder="e.g. Dream Home Shortlist"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium">{(t as any)("magicShare.boardDescLabel")}</p>
                  <Textarea
                    rows={2}
                    value={boardDescription}
                    onChange={(e) => setBoardDescription(e.target.value)}
                    placeholder={(t as any)("magicShare.boardDescPlaceholder")}
                  />
                </div>

                {/* Per-listing notes */}
                {selectedListings.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-sm font-medium">{(t as any)("magicShare.perListingNotes")}</p>
                    {selectedListings.map((item) => (
                      <div key={item.listingKey} className="rounded-lg border p-3 space-y-2">
                        <div className="flex items-center gap-2">
                          {item.thumbnailUrl ? (
                            <img src={item.thumbnailUrl} alt="" className="h-8 w-12 rounded border object-cover shrink-0" />
                          ) : (
                            <div className="h-8 w-12 rounded border bg-muted/30 shrink-0" />
                          )}
                          <p className="text-sm font-medium truncate">{displayAddress(item, t("listings.addressUnknown"))}</p>
                        </div>
                        <Input
                          value={listingNotes[item.listingKey] || ""}
                          onChange={(e) => setListingNotes((prev) => ({ ...prev, [item.listingKey]: e.target.value }))}
                          placeholder={(t as any)("magicShare.listingNotePlaceholder")}
                          className="text-sm"
                        />
                      </div>
                    ))}
                  </div>
                )}

                <Button
                  className="w-full gap-2"
                  size="lg"
                  disabled={createBuyerBoardMutation.isPending || selectedListings.length === 0}
                  onClick={handleCreateBuyerBoard}
                >
                  {createBuyerBoardMutation.isPending ? (
                    <><Loader2 className="h-4 w-4 animate-spin" />{t("magicShare.generating")}</>
                  ) : (
                    <><ClipboardList className="h-4 w-4" />{(t as any)("magicShare.generateBoard")}</>
                  )}
                </Button>

                {generatedShareUrl && <ShareLinkResult url={generatedShareUrl} t={t} />}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ═══════ TOUR RECAP MODE ═══════ */}
      {mode === "tour_recap" && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <ListingSearchCard
            search={search}
            setSearch={setSearch}
            selectedKeys={selectedKeys}
            addListing={addListing}
            removeListing={removeListing}
            moveListing={moveListing}
            selectedListings={selectedListings}
            selectedKeySet={selectedKeySet}
            searchResults={searchResults}
            searchLoading={searchQuery.isLoading}
            selectedLoading={selectedQuery.isLoading}
            t={t}
          />

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  {(t as any)("magicShare.tourRecapTitle")}
                </CardTitle>
                <CardDescription>
                  {(t as any)("magicShare.tourRecapDesc")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <p className="text-sm font-medium">{(t as any)("magicShare.tourClientName")}</p>
                    <Input
                      value={tourClientName}
                      onChange={(e) => setTourClientName(e.target.value)}
                      placeholder="Client name"
                    />
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium">{(t as any)("magicShare.tourDateLabel")}</p>
                    <Input
                      type="date"
                      value={tourDate}
                      onChange={(e) => setTourDate(e.target.value)}
                    />
                  </div>
                </div>

                {/* Per-listing feedback */}
                {selectedListings.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-sm font-medium">{(t as any)("magicShare.perPropertyFeedback")}</p>
                    {selectedListings.map((item, idx) => (
                      <div key={item.listingKey} className="rounded-lg border p-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-stone-900 text-xs font-bold text-white shrink-0">{idx + 1}</span>
                          {item.thumbnailUrl ? (
                            <img src={item.thumbnailUrl} alt="" className="h-8 w-12 rounded border object-cover shrink-0" />
                          ) : (
                            <div className="h-8 w-12 rounded border bg-muted/30 shrink-0" />
                          )}
                          <p className="text-sm font-medium truncate">{displayAddress(item, t("listings.addressUnknown"))}</p>
                        </div>
                        <Input
                          value={listingFeedback[item.listingKey]?.highlights || ""}
                          onChange={(e) => setListingFeedback((prev) => ({ ...prev, [item.listingKey]: { ...prev[item.listingKey], agentNotes: prev[item.listingKey]?.agentNotes || "", concerns: prev[item.listingKey]?.concerns || "", highlights: e.target.value } }))}
                          placeholder={(t as any)("magicShare.highlightsPlaceholder")}
                          className="text-sm"
                        />
                        <Input
                          value={listingFeedback[item.listingKey]?.concerns || ""}
                          onChange={(e) => setListingFeedback((prev) => ({ ...prev, [item.listingKey]: { ...prev[item.listingKey], agentNotes: prev[item.listingKey]?.agentNotes || "", highlights: prev[item.listingKey]?.highlights || "", concerns: e.target.value } }))}
                          placeholder={(t as any)("magicShare.concernsPlaceholder")}
                          className="text-sm"
                        />
                        <Input
                          value={listingFeedback[item.listingKey]?.agentNotes || ""}
                          onChange={(e) => setListingFeedback((prev) => ({ ...prev, [item.listingKey]: { ...prev[item.listingKey], highlights: prev[item.listingKey]?.highlights || "", concerns: prev[item.listingKey]?.concerns || "", agentNotes: e.target.value } }))}
                          placeholder={(t as any)("magicShare.agentNotesPlaceholder")}
                          className="text-sm"
                        />
                      </div>
                    ))}
                  </div>
                )}

                <div className="space-y-2">
                  <p className="text-sm font-medium">{(t as any)("magicShare.tourOverallSummary")}</p>
                  <Textarea
                    rows={3}
                    value={tourSummary}
                    onChange={(e) => setTourSummary(e.target.value)}
                    placeholder={(t as any)("magicShare.tourSummaryPlaceholder")}
                  />
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium">{(t as any)("magicShare.tourNextSteps")}</p>
                  <Textarea
                    rows={3}
                    value={tourNextSteps}
                    onChange={(e) => setTourNextSteps(e.target.value)}
                    placeholder={(t as any)("magicShare.tourNextStepsPlaceholder")}
                  />
                  <p className="text-xs text-muted-foreground">{(t as any)("magicShare.onePerLine")}</p>
                </div>

                <Button
                  className="w-full gap-2"
                  size="lg"
                  disabled={createTourRecapMutation.isPending || selectedListings.length === 0}
                  onClick={handleCreateTourRecap}
                >
                  {createTourRecapMutation.isPending ? (
                    <><Loader2 className="h-4 w-4 animate-spin" />{t("magicShare.generating")}</>
                  ) : (
                    <><Send className="h-4 w-4" />{(t as any)("magicShare.generateRecap")}</>
                  )}
                </Button>

                {generatedShareUrl && <ShareLinkResult url={generatedShareUrl} t={t} />}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ═══════ OFFER WORKSHEET MODE ═══════ */}
      {mode === "offer_worksheet" && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <ListingSearchCard
            search={search}
            setSearch={setSearch}
            selectedKeys={selectedKeys}
            addListing={addListing}
            removeListing={removeListing}
            moveListing={moveListing}
            selectedListings={selectedListings}
            selectedKeySet={selectedKeySet}
            searchResults={searchResults}
            searchLoading={searchQuery.isLoading}
            selectedLoading={selectedQuery.isLoading}
            t={t}
          />

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  {(t as any)("magicShare.offerTitle")}
                </CardTitle>
                <CardDescription>
                  {(t as any)("magicShare.offerDesc")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <p className="text-sm font-medium">{(t as any)("magicShare.offerClientName")}</p>
                  <Input
                    value={offerClientName}
                    onChange={(e) => setOfferClientName(e.target.value)}
                    placeholder="Client name"
                  />
                </div>

                {/* Target listing selector */}
                {selectedListings.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">{(t as any)("magicShare.targetListing")}</p>
                    <p className="text-xs text-muted-foreground">{(t as any)("magicShare.targetListingHint")}</p>
                    <div className="space-y-2">
                      {selectedListings.map((item) => {
                        const isTarget = (targetListingKey || selectedKeys[0]) === item.listingKey;
                        return (
                          <button
                            key={item.listingKey}
                            type="button"
                            onClick={() => setTargetListingKey(item.listingKey)}
                            className={`w-full flex items-center gap-3 rounded-lg border p-3 text-left transition-all ${
                              isTarget ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "hover:bg-muted/50"
                            }`}
                          >
                            <div className={`flex h-5 w-5 items-center justify-center rounded-full border-2 shrink-0 ${isTarget ? "border-primary bg-primary" : "border-muted-foreground/30"}`}>
                              {isTarget && <div className="h-2 w-2 rounded-full bg-white" />}
                            </div>
                            {item.thumbnailUrl ? (
                              <img src={item.thumbnailUrl} alt="" className="h-8 w-12 rounded border object-cover shrink-0" />
                            ) : (
                              <div className="h-8 w-12 rounded border bg-muted/30 shrink-0" />
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium">{displayAddress(item, t("listings.addressUnknown"))}</p>
                              <p className="text-xs text-muted-foreground">{formatPrice(item.listPrice, t("listings.pricePending"))}</p>
                            </div>
                            {isTarget && <Badge variant="default" className="shrink-0"><Target className="mr-1 h-3 w-3" />Target</Badge>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Offer range */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <p className="text-sm font-medium">{(t as any)("magicShare.offerLow")}</p>
                    <Input
                      type="number"
                      value={suggestedOfferLow}
                      onChange={(e) => setSuggestedOfferLow(e.target.value)}
                      placeholder="e.g. 1100000"
                    />
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium">{(t as any)("magicShare.offerHigh")}</p>
                    <Input
                      type="number"
                      value={suggestedOfferHigh}
                      onChange={(e) => setSuggestedOfferHigh(e.target.value)}
                      placeholder="e.g. 1200000"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium">{(t as any)("magicShare.offerRecommendation")}</p>
                  <Textarea
                    rows={3}
                    value={agentRecommendation}
                    onChange={(e) => setAgentRecommendation(e.target.value)}
                    placeholder={(t as any)("magicShare.offerRecommendationPlaceholder")}
                  />
                </div>

                {/* Comp notes */}
                {selectedListings.filter((l) => l.listingKey !== (targetListingKey || selectedKeys[0])).length > 0 && (
                  <div className="space-y-3">
                    <p className="text-sm font-medium">{(t as any)("magicShare.compNotes")}</p>
                    {selectedListings
                      .filter((l) => l.listingKey !== (targetListingKey || selectedKeys[0]))
                      .map((item) => (
                        <div key={item.listingKey} className="rounded-lg border p-3 space-y-2">
                          <div className="flex items-center gap-2">
                            {item.thumbnailUrl ? (
                              <img src={item.thumbnailUrl} alt="" className="h-8 w-12 rounded border object-cover shrink-0" />
                            ) : (
                              <div className="h-8 w-12 rounded border bg-muted/30 shrink-0" />
                            )}
                            <p className="text-sm font-medium truncate">{displayAddress(item, t("listings.addressUnknown"))}</p>
                          </div>
                          <Input
                            value={compNotes[item.listingKey]?.whyComparable || ""}
                            onChange={(e) => setCompNotes((prev) => ({ ...prev, [item.listingKey]: { ...prev[item.listingKey], soldPrice: prev[item.listingKey]?.soldPrice || "", adjustmentNotes: prev[item.listingKey]?.adjustmentNotes || "", whyComparable: e.target.value } }))}
                            placeholder={(t as any)("magicShare.whyComparablePlaceholder")}
                            className="text-sm"
                          />
                          <div className="grid grid-cols-2 gap-2">
                            <Input
                              type="number"
                              value={compNotes[item.listingKey]?.soldPrice || ""}
                              onChange={(e) => setCompNotes((prev) => ({ ...prev, [item.listingKey]: { ...prev[item.listingKey], whyComparable: prev[item.listingKey]?.whyComparable || "", adjustmentNotes: prev[item.listingKey]?.adjustmentNotes || "", soldPrice: e.target.value } }))}
                              placeholder={(t as any)("magicShare.soldPricePlaceholder")}
                              className="text-sm"
                            />
                            <Input
                              value={compNotes[item.listingKey]?.adjustmentNotes || ""}
                              onChange={(e) => setCompNotes((prev) => ({ ...prev, [item.listingKey]: { ...prev[item.listingKey], whyComparable: prev[item.listingKey]?.whyComparable || "", soldPrice: prev[item.listingKey]?.soldPrice || "", adjustmentNotes: e.target.value } }))}
                              placeholder={(t as any)("magicShare.adjustmentPlaceholder")}
                              className="text-sm"
                            />
                          </div>
                        </div>
                      ))}
                  </div>
                )}

                <Button
                  className="w-full gap-2"
                  size="lg"
                  disabled={createOfferWorksheetMutation.isPending || selectedListings.length === 0}
                  onClick={handleCreateOfferWorksheet}
                >
                  {createOfferWorksheetMutation.isPending ? (
                    <><Loader2 className="h-4 w-4 animate-spin" />{t("magicShare.generating")}</>
                  ) : (
                    <><DollarSign className="h-4 w-4" />{(t as any)("magicShare.generateOffer")}</>
                  )}
                </Button>

                {generatedShareUrl && <ShareLinkResult url={generatedShareUrl} t={t} />}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ─── My Shares ─────────────────────────────── */}
      <Card>
        <CardContent className="flex items-center justify-between gap-4 p-4">
          <div>
            <p className="text-sm font-medium">
              {t("magicShare.myShares")}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("magicShare.mySharesDescription")}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => (window.location.href = "/shares")}
          >
            <ExternalLink className="mr-2 h-3.5 w-3.5" />
            {t("magicShare.myShares")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────── */
/*  Share Link Result                                            */
/* ────────────────────────────────────────────────────────────── */

function ShareLinkResult({
  url,
  t,
}: {
  url: string;
  t: (...args: any[]) => string;
}) {
  return (
    <div className="rounded-xl border bg-muted/20 p-3">
      <p className="text-xs text-muted-foreground">
        {t("magicShare.shareLink")}
      </p>
      <p className="break-all text-sm font-medium">{url}</p>
      <div className="mt-3 flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigator.clipboard.writeText(url)}
        >
          <Copy className="mr-2 h-4 w-4" />
          {t("magicShare.copy")}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            window.open(url, "_blank", "noopener,noreferrer")
          }
        >
          <ExternalLink className="mr-2 h-4 w-4" />
          {t("magicShare.open")}
        </Button>
      </div>
    </div>
  );
}
