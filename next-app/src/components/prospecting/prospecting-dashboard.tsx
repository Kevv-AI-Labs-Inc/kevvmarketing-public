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
import { AddressAutocomplete } from "@/components/ui/address-autocomplete";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { useT } from "@/i18n";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Copy,
  Loader2,
  Mail,
  Mailbox,
  MessageSquare,
  Phone,
  RefreshCw,
  Search,
  Target,
  ThumbsDown,
  ThumbsUp,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { BriefDisplay } from "./brief-display";
import { FeedbackPanel } from "./feedback-panel";

type Tone = "professional" | "friendly" | "direct" | "empathetic";
type Language = "en" | "zh";

interface ListingCandidate {
  listingKey: string;
  listingId: string;
  address: string;
  city: string;
  state: string;
  price: string;
  status: string;
}

export function ProspectingDashboard() {
  const { t, locale } = useT();
  const utils = trpc.useUtils();
  const isChinese = locale.startsWith("zh");

  // Input state
  const [inputValue, setInputValue] = useState("");
  const [tone, setTone] = useState<Tone>("professional");
  const [language, setLanguage] = useState<Language>(isChinese ? "zh" : "en");

  // Results state
  const [activeBriefId, setActiveBriefId] = useState<number | null>(null);
  const [disambiguation, setDisambiguation] = useState<ListingCandidate[] | null>(null);

  // Fetch recent briefs
  const briefsQuery = trpc.prospecting.listBriefs.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  // Fetch active brief details
  const activeBriefQuery = trpc.prospecting.getBrief.useQuery(
    { id: activeBriefId! },
    { enabled: !!activeBriefId, refetchOnWindowFocus: false }
  );

  // Generate mutation
  const generateMutation = trpc.prospecting.generateBrief.useMutation({
    onSuccess: (data) => {
      if ("ambiguous" in data && data.ambiguous) {
        setDisambiguation(data.candidates as ListingCandidate[]);
        return;
      }
      // It's a brief
      const brief = data as { id: number };
      setActiveBriefId(brief.id);
      setDisambiguation(null);
      utils.prospecting.listBriefs.invalidate();
      toast.success(t("prospecting.briefGenerated"));
    },
    onError: (error) => {
      toast.error(t("prospecting.generationFailed"), {
        description: error.message,
      });
    },
  });

  function handleGenerate(listingKey?: string) {
    if (!inputValue.trim() && !listingKey) return;

    const isMlsId = /^[A-Z0-9-]+$/i.test(inputValue.trim()) && !inputValue.includes(" ");

    generateMutation.mutate({
      ...(listingKey
        ? { listingKey }
        : isMlsId
          ? { listingId: inputValue.trim() }
          : { address: inputValue.trim() }),
      tone,
      language,
    });
  }

  function handleDisambiguationSelect(candidate: ListingCandidate) {
    setDisambiguation(null);
    handleGenerate(candidate.listingKey);
  }

  const isLoading = generateMutation.isPending;

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Target className="h-6 w-6 text-primary" />
          {t("prospecting.title")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("prospecting.subtitle")}
        </p>
      </div>

      {/* Input Section */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4">
            {/* Search input */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <AddressAutocomplete
                  placeholder={t("prospecting.inputPlaceholder")}
                  value={inputValue}
                  onChange={setInputValue}
                  onSelect={(formatted) => {
                    setInputValue(formatted);
                  }}
                  disabled={isLoading}
                />
              </div>
              <Button
                onClick={() => handleGenerate()}
                disabled={isLoading || !inputValue.trim()}
                className="min-w-[140px]"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t("prospecting.generating")}
                  </>
                ) : (
                  <>
                    {t("prospecting.generateBrief")}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </div>

            {/* Options row */}
            <div className="flex flex-wrap gap-3 items-center">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground font-medium">
                  {t("prospecting.tone")}
                </span>
                <Select value={tone} onValueChange={(v) => setTone(v as Tone)}>
                  <SelectTrigger className="w-[140px] h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="professional">{t("prospecting.toneProfessional")}</SelectItem>
                    <SelectItem value="friendly">{t("prospecting.toneFriendly")}</SelectItem>
                    <SelectItem value="direct">{t("prospecting.toneDirect")}</SelectItem>
                    <SelectItem value="empathetic">{t("prospecting.toneEmpathetic")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground font-medium">
                  {t("prospecting.language")}
                </span>
                <Select value={language} onValueChange={(v) => setLanguage(v as Language)}>
                  <SelectTrigger className="w-[100px] h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="zh">中文</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Address Disambiguation */}
      {disambiguation && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {t("prospecting.multipleListingsFound")}
            </CardTitle>
            <CardDescription>
              {t("prospecting.selectListing")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2">
              {disambiguation.map((candidate) => (
                <button
                  key={candidate.listingKey}
                  onClick={() => handleDisambiguationSelect(candidate)}
                  className="flex items-center justify-between p-3 rounded-lg border bg-background hover:bg-accent transition-colors text-left"
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium text-sm">
                      {candidate.address}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {candidate.city}, {candidate.state} &middot; MLS: {candidate.listingId}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      ${Number(candidate.price).toLocaleString()}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {candidate.status}
                    </Badge>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content: Brief Display or Recent Briefs */}
      {activeBriefId && activeBriefQuery.data ? (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setActiveBriefId(null)}
            >
              {t("prospecting.backToList")}
            </Button>
          </div>
          <BriefDisplay brief={activeBriefQuery.data} />
          <FeedbackPanel
            briefId={activeBriefQuery.data.id}
            existingFeedback={activeBriefQuery.data.feedback}
          />
        </div>
      ) : (
        <RecentBriefs
          briefs={briefsQuery.data ?? []}
          isLoading={briefsQuery.isLoading}
          onSelect={(id) => setActiveBriefId(id)}
        />
      )}
    </div>
  );
}

// ─── Recent Briefs List ───────────────────────────────────

function RecentBriefs({
  briefs,
  isLoading,
  onSelect,
}: {
  briefs: Array<{
    id: number;
    address: string | null;
    listingId: string | null;
    status: string;
    createdAt: Date;
    tone: string | null;
    diagnosis: Record<string, unknown> | null;
  }>;
  isLoading: boolean;
  onSelect: (id: number) => void;
}) {
  const { t } = useT();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (briefs.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-16 gap-3 text-center">
          <Target className="h-10 w-10 text-muted-foreground/50" />
          <div>
            <p className="font-medium text-muted-foreground">
              {t("prospecting.noBriefsYet")}
            </p>
            <p className="text-sm text-muted-foreground/75 mt-1">
              {t("prospecting.noBriefsHint")}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-sm font-medium text-muted-foreground px-1">
        {t("prospecting.recentBriefs")}
      </h2>
      <div className="grid gap-2">
        {briefs.map((brief) => {
          const diagnosis = brief.diagnosis as { summary?: string } | null;
          return (
            <button
              key={brief.id}
              onClick={() => brief.status === "ready" && onSelect(brief.id)}
              className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors text-left"
              disabled={brief.status !== "ready"}
            >
              <div className="flex flex-col gap-1 min-w-0 flex-1">
                <span className="font-medium text-sm truncate">
                  {brief.address ?? brief.listingId ?? "—"}
                </span>
                {diagnosis?.summary && (
                  <span className="text-xs text-muted-foreground truncate">
                    {diagnosis.summary}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 ml-3 shrink-0">
                <StatusBadge status={brief.status} />
                <span className="text-xs text-muted-foreground">
                  {new Date(brief.createdAt).toLocaleDateString()}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "ready":
      return (
        <Badge variant="default" className="gap-1 text-xs bg-emerald-600">
          <CheckCircle2 className="h-3 w-3" />
          Ready
        </Badge>
      );
    case "generating":
      return (
        <Badge variant="secondary" className="gap-1 text-xs">
          <Loader2 className="h-3 w-3 animate-spin" />
          Generating
        </Badge>
      );
    case "failed":
      return (
        <Badge variant="destructive" className="gap-1 text-xs">
          <XCircle className="h-3 w-3" />
          Failed
        </Badge>
      );
    default:
      return null;
  }
}
