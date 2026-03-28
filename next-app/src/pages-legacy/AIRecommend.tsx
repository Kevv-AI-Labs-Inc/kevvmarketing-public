// legacy page — incrementally migrated
import { useT } from "@/i18n";
import { getDashboardPageCopy } from "@/i18n/dashboard-pages";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/useMobile";
import {
  BarChart3,
  Bath,
  Bed,
  Check,
  CheckCircle2,
  Copy,
  Eye,
  Loader2,
  MapPin,
  MessageSquare,
  Send,
  Sparkles,
  Square,
  ThumbsDown,
  ThumbsUp,
  User,
  Wand2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Streamdown } from "streamdown";
import { toast } from "sonner";

interface SearchResultProperty {
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
  similarity_score: number;
  boost_score: number;
  final_score: number;
}

interface PropertyRecommendation {
  property: SearchResultProperty;
  pitch?: string;
  matchReasons: string[];
  images: string[];
}

interface RecommendationResult {
  recommendations: PropertyRecommendation[];
  clientId?: number;
  requirements: {
    hard: Record<string, unknown>;
    soft: string[];
  };
  candidateCount: number;
  processingTime: number;
}

export default function AIRecommend() {
  const { locale } = useT();
  const copy = getDashboardPageCopy(locale).aiRecommend;
  const router = useRouter();
  const pathname = usePathname();
  const isMobile = useIsMobile();
  const resultsPanelRef = useRef<HTMLDivElement | null>(null);
  const isSummaryCopyMode = pathname.startsWith("/summary-copy");
  const pageTitle = isSummaryCopyMode ? copy.titles.summaryCopy : copy.titles.smartMatch;
  const pageDescription = isSummaryCopyMode
    ? copy.titles.summaryCopyDescription
    : copy.titles.smartMatchDescription;

  const [clientName, setClientName] = useState("");
  const [budgetMin, setBudgetMin] = useState("");
  const [budgetMax, setBudgetMax] = useState("");
  const [requirements, setRequirements] = useState("");

  const [results, setResults] = useState<RecommendationResult | null>(null);
  const [selectedProperties, setSelectedProperties] = useState<Set<number>>(new Set());
  const [copiedPitch, setCopiedPitch] = useState(false);

  const recommendMutation = trpc.ai.recommend.useMutation({
    onSuccess: (data) => {
      const typedData = data as RecommendationResult;
      setResults(typedData);
      const firstThree = new Set<number>(typedData.recommendations.slice(0, 3).map((item) => item.property.id));
      setSelectedProperties(firstThree);
    },
    onError: (error) => {
      toast.error(copy.toasts.recommendFailed, {
        description: error.message,
      });
    },
  });

  const feedbackMutation = trpc.ai.feedback.useMutation({
    onSuccess: () => {
      toast.success(copy.toasts.feedbackSubmitted, {
        description: copy.toasts.feedbackDescription,
      });
    },
  });

  useEffect(() => {
    if (!results || !isMobile) return;
    const raf = window.requestAnimationFrame(() => {
      resultsPanelRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
    return () => window.cancelAnimationFrame(raf);
  }, [results, isMobile]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!clientName.trim() || !requirements.trim()) {
      toast.error(copy.toasts.requiredFields, {
        description: copy.toasts.requiredFieldsDescription,
      });
      return;
    }

    const budgetText = copy.section.budgetSummary({
      min: budgetMin.trim(),
      max: budgetMax.trim(),
    });

    const profileText = `${clientName}: ${budgetText}${requirements}`;

    recommendMutation.mutate({
      profileText,
      topK: 10,
      generatePitch: true,
    });
  };

  const togglePropertySelection = (id: number) => {
    const next = new Set(selectedProperties);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedProperties(next);
  };

  const getSelectedPitch = (): string => {
    if (!results) return "";
    const selectedRecs = results.recommendations.filter((item) => selectedProperties.has(item.property.id));
    return selectedRecs.map((item) => item.pitch || "").filter(Boolean).join("\n\n---\n\n");
  };

  const copyPitch = async () => {
    const pitch = getSelectedPitch();
    if (pitch) {
      await navigator.clipboard.writeText(pitch);
      setCopiedPitch(true);
      toast.success(copy.toasts.copied);
      setTimeout(() => setCopiedPitch(false), 2000);
    }
  };

  const handleFeedback = (isPositive: boolean) => {
    if (!results) return;
    feedbackMutation.mutate({
      recommendationId: Date.now(),
      feedbackType: isPositive ? "approved" : "rejected",
      feedbackRating: isPositive ? 5 : 1,
      feedbackNotes: isPositive ? copy.feedbackNotes.approved : copy.feedbackNotes.rejected,
    });
  };

  const formatPrice = (price: string | null) => {
    if (!price) return copy.section.notAvailable;
    const num = parseFloat(price);
    if (!Number.isFinite(num)) return price;
    if (num >= 1_000_000) {
      return `$${(num / 1_000_000).toFixed(2)}M`;
    }
    return `$${(num / 1_000).toFixed(0)}K`;
  };

  const selectedListingKeys = useMemo(() => {
    if (!results) return [] as string[];
    return results.recommendations
      .filter((item) => selectedProperties.has(item.property.id))
      .map((item) => item.property.listingKey)
      .filter((item) => item && item.trim().length > 0);
  }, [results, selectedProperties]);

  const goToShareStudio = () => {
    if (selectedListingKeys.length === 0) {
      toast.error(copy.toasts.selectOneListing);
      return;
    }
    const params = new URLSearchParams();
    params.set("listingKeys", Array.from(new Set(selectedListingKeys)).slice(0, 15).join(","));
    params.set("source", "ai");
    if (clientName.trim().length > 0) {
      params.set("title", copy.summary.shareTitle(clientName.trim()));
      params.set("clientName", clientName.trim());
    }
    router.push(`/magic-share?${params.toString()}`);
  };

  const goToCmaStudio = () => {
    const subjectKey = selectedListingKeys[0];
    if (!subjectKey) {
      toast.error(copy.toasts.selectOneListing);
      return;
    }
    const params = new URLSearchParams();
    params.set("subjectKey", subjectKey);
    router.push(`/cma-studio?${params.toString()}`);
  };

  return (
    <div className="min-h-full bg-background font-sans">
      <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center justify-between border-b border-border bg-background/80 px-6 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-gradient-to-br from-primary to-amber-700 p-2">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-foreground">{pageTitle}</h2>
            <p className="text-xs text-muted-foreground">{pageDescription}</p>
          </div>
        </div>
        <Badge variant="secondary" className="bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary">
          Beta
        </Badge>
      </header>

      <div className="flex min-h-0 flex-col lg:h-[calc(100vh-4rem)] lg:flex-row">
        <div className="w-full shrink-0 border-b border-border bg-muted/30 p-6 lg:min-h-0 lg:w-[400px] lg:overflow-y-auto lg:border-b-0 lg:border-r">
          <form onSubmit={handleSubmit} className="space-y-6">
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-base">
                  <User className="h-4 w-4" />
                  {copy.section.clientInfo}
                </CardTitle>
                <CardDescription>{copy.section.clientInfoDescription}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="clientName">{copy.section.clientName}</Label>
                  <Input
                    id="clientName"
                    placeholder={copy.section.clientNamePlaceholder}
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>{copy.section.budget}</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder={copy.section.budgetMinPlaceholder}
                      value={budgetMin}
                      onChange={(e) => setBudgetMin(e.target.value.replace(/[^0-9]/g, ""))}
                      className="flex-1"
                    />
                    <span className="text-muted-foreground">-</span>
                    <Input
                      placeholder={copy.section.budgetMaxPlaceholder}
                      value={budgetMax}
                      onChange={(e) => setBudgetMax(e.target.value.replace(/[^0-9]/g, ""))}
                      className="flex-1"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">{copy.section.budgetHint}</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="requirements">{copy.section.requirements}</Label>
                  <Textarea
                    id="requirements"
                    placeholder={copy.section.requirementsPlaceholder}
                    value={requirements}
                    onChange={(e) => setRequirements(e.target.value)}
                    rows={8}
                    className="resize-none"
                  />
                </div>
              </CardContent>
            </Card>

            <Button type="submit" className="w-full gap-2" size="lg" disabled={recommendMutation.isPending}>
              {recommendMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {copy.section.submitting}
                </>
              ) : (
                <>
                  <Wand2 className="h-4 w-4" />
                  {copy.section.submit}
                </>
              )}
            </Button>

            {results && (
              <div className="space-y-2">
                <div className="text-center text-sm text-muted-foreground">
                  {copy.summary.found(results.recommendations.length, (results.processingTime / 1000).toFixed(1))}
                </div>
                {isMobile && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() =>
                      resultsPanelRef.current?.scrollIntoView({
                        behavior: "smooth",
                        block: "start",
                      })
                    }
                  >
                    {copy.section.resultsJump}
                  </Button>
                )}
              </div>
            )}
          </form>
        </div>

        <div ref={resultsPanelRef} className="flex min-h-[420px] flex-1 flex-col lg:min-h-0">
          {!results ? (
            <div className="flex flex-1 items-center justify-center py-16 text-muted-foreground lg:py-0">
              <div className="space-y-4 text-center">
                <Sparkles className="mx-auto h-12 w-12 opacity-20" />
                <div>
                  <p className="font-medium">{copy.section.emptyTitle}</p>
                  <p className="text-sm">{copy.section.emptyDescription}</p>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <div className="shrink-0 border-b border-border bg-muted/30 p-4">
                  <h3 className="flex items-center gap-2 font-medium">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    {copy.section.resultsTitle}
                    <Badge variant="secondary" className="ml-auto">
                      {copy.section.selectedCount} {selectedProperties.size} {copy.section.selectedCountSuffix}
                    </Badge>
                  </h3>
                </div>

                <div className="flex-1 overflow-y-auto">
                  <div className="space-y-3 p-4">
                    {results.recommendations.map((rec, index) => (
                      <Card
                        key={rec.property.id}
                        className={cn(
                          "rounded-xl border-border/50 transition-all hover:shadow-md hover:ring-1 hover:ring-primary/20",
                          selectedProperties.has(rec.property.id) && "bg-primary/5 ring-2 ring-primary",
                        )}
                      >
                        <CardContent className="p-4">
                          <div className="flex gap-4">
                            <div
                              className="mt-1 flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-full border-2"
                              onClick={() => togglePropertySelection(rec.property.id)}
                            >
                              {selectedProperties.has(rec.property.id) ? (
                                <Check className="h-4 w-4 text-primary" />
                              ) : (
                                <span className="text-xs text-muted-foreground">{index + 1}</span>
                              )}
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="mb-2 flex items-start justify-between gap-2">
                                <div>
                                  <p className="text-lg font-semibold">{formatPrice(rec.property.listPrice)}</p>
                                  <p className="flex items-center gap-1 text-sm text-muted-foreground">
                                    <MapPin className="h-3 w-3" />
                                    {rec.property.unparsedAddress || `${rec.property.city}, ${rec.property.stateOrProvince}`}
                                  </p>
                                </div>
                                <div className="flex shrink-0 items-center gap-2">
                                  <Badge variant="outline" className={cn(rec.property.final_score > 0.5 && "border-green-200 bg-green-50 text-green-700")}>
                                    {copy.section.matchScore} {(rec.property.final_score * 100).toFixed(0)}%
                                  </Badge>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      window.open(`/listings?key=${rec.property.listingKey}`, "_blank");
                                    }}
                                    title={copy.section.viewDetails}
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>

                              <div className="mb-2 flex items-center gap-4 text-sm text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Bed className="h-3 w-3" />
                                  {rec.property.bedroomsTotal || copy.section.notAvailable} {copy.section.beds}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Bath className="h-3 w-3" />
                                  {rec.property.bathroomsTotalInteger || copy.section.notAvailable} {copy.section.baths}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Square className="h-3 w-3" />
                                  {rec.property.livingArea ? `${parseInt(rec.property.livingArea, 10).toLocaleString()} ${copy.section.sqft}` : copy.section.notAvailable}
                                </span>
                              </div>

                              {rec.matchReasons.length > 0 && (
                                <div className="mb-2 flex flex-wrap gap-1">
                                  {rec.matchReasons.slice(0, 4).map((reason, reasonIndex) => (
                                    <Badge key={reasonIndex} variant="secondary" className="text-xs">
                                      {reason}
                                    </Badge>
                                  ))}
                                </div>
                              )}

                              {rec.property.publicRemarks && <p className="line-clamp-2 text-sm text-muted-foreground">{rec.property.publicRemarks}</p>}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              </div>

              <div className="shrink-0 border-t border-border bg-muted/30 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="flex items-center gap-2 font-medium">
                    <MessageSquare className="h-4 w-4 text-primary" />
                    {copy.section.aiPitch}
                  </h3>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => handleFeedback(true)} disabled={feedbackMutation.isPending}>
                      <ThumbsUp className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleFeedback(false)} disabled={feedbackMutation.isPending}>
                      <ThumbsDown className="h-4 w-4" />
                    </Button>
                    <Separator orientation="vertical" className="h-6" />
                    <Button variant="outline" size="sm" onClick={copyPitch} className="gap-2" disabled={selectedProperties.size === 0}>
                      {copiedPitch ? (
                        <>
                          <Check className="h-4 w-4" />
                          {copy.section.copied}
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4" />
                          {copy.section.copyPitch}
                        </>
                      )}
                    </Button>
                    <Button size="sm" variant="outline" className="gap-2" disabled={selectedProperties.size === 0} onClick={goToCmaStudio}>
                      <BarChart3 className="h-4 w-4" />
                      {copy.section.generateCma}
                    </Button>
                    <Button size="sm" className="gap-2" disabled={selectedProperties.size === 0} onClick={goToShareStudio}>
                      <Send className="h-4 w-4" />
                      {copy.section.openShare}
                    </Button>
                  </div>
                </div>

                <Card className="bg-background">
                  <CardContent className="max-h-48 overflow-y-auto p-4">
                    {selectedProperties.size > 0 ? (
                      <div className="prose prose-sm max-w-none">
                        <Streamdown>{getSelectedPitch()}</Streamdown>
                      </div>
                    ) : (
                      <p className="py-4 text-center text-sm text-muted-foreground">{copy.section.pitchEmpty}</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
