// legacy page — incrementally migrated
import { useT } from "@/i18n";
import { localeTag } from "@/i18n/copy";
import { getDashboardPageCopy } from "@/i18n/dashboard-pages";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { trpc } from "@/lib/trpc";
import {
  ArrowRight,
  BarChart3,
  Building2,
  Clock3,
  Loader2,
  Search,
  Share2,
  Zap,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

type CmaSubject = {
  listingKey: string;
  listingId: string | null;
  address: string | null;
  city: string | null;
  postalCode: string | null;
  price: string | null;
  propertyType: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  livingArea: string | null;
};

type CmaComparable = {
  listingKey: string;
  listingId: string | null;
  address: string | null;
  city: string | null;
  postalCode: string | null;
  price: string | null;
  propertyType: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  livingArea: string | null;
  status: string | null;
  score: number;
};

type CmaResult = {
  subject: CmaSubject;
  comparables: CmaComparable[];
  source?: "vector" | "sql_fallback";
  meta: {
    total: number;
    responseTimeMs: number;
    source?: string;
  };
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
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(Math.round(rawLimit), 1), 20) : null;

  return { subjectKey, limit };
}

export default function CMAStudio() {
  const { locale } = useT();
  const copy = getDashboardPageCopy(locale).cmaStudio;
  const router = useRouter();
  const prefill = useMemo(() => parseCmaPrefillFromUrl(), []);
  const [search, setSearch] = useState("");
  const [limitText, setLimitText] = useState(prefill.limit ? String(prefill.limit) : "8");
  const [selectedSubjectKey, setSelectedSubjectKey] = useState<string>(prefill.subjectKey);
  const [generated, setGenerated] = useState<CmaResult | null>(null);

  const formatPriceValue = (price: string | null) => {
    if (!price) return copy.fallbackPrice;
    const num = Number(price);
    if (!Number.isFinite(num)) return price;
    return `$${num.toLocaleString()}`;
  };

  const formatDateTime = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString(localeTag(locale));
  };

  const formatAddress = (record: {
    address?: string | null;
    city?: string | null;
    postalCode?: string | null;
    listingId?: string | null;
    listingKey?: string | null;
  }) => {
    const address = record.address?.trim();
    if (address) return address;
    const city = record.city?.trim();
    if (city) return city;
    return record.listingId || record.listingKey || copy.unnamedListing;
  };

  const embeddingStatusQuery = trpc.mls.embeddingStatus.useQuery(undefined, {
    refetchInterval: 15_000,
  });
  const triggerEmbeddingMutation = trpc.mls.triggerEmbedding.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      embeddingStatusQuery.refetch();
    },
    onError: (err) => toast.error(copy.embedding.triggerFailed, { description: err.message }),
  });
  const embeddingStatus = embeddingStatusQuery.data;

  const propertiesQuery = trpc.mls.getProperties.useQuery({
    search: search || undefined,
    limit: 20,
    offset: 0,
    status: "Active",
  });

  const historyQuery = trpc.vector.listCmaDashboard.useQuery({ limit: 20 }, { refetchOnWindowFocus: false });

  const generateMutation = trpc.vector.generateCmaDashboard.useMutation({
    onSuccess: async (data) => {
      const typed = data as CmaResult;
      setGenerated(typed);
      await historyQuery.refetch();
      const sourceLabel = typed.source === "sql_fallback" ? copy.sourceLabels.sqlFallback : copy.sourceLabels.vector;
      toast.success(copy.toasts.generated, {
        description: copy.toasts.generatedDescription(typed.comparables.length, sourceLabel),
      });
    },
    onError: (error) => {
      toast.error(copy.toasts.failed, { description: error.message });
    },
  });

  const parsedLimit = useMemo(() => {
    const value = Number(limitText);
    if (!Number.isFinite(value)) return 8;
    return Math.min(Math.max(Math.round(value), 1), 20);
  }, [limitText]);

  const selectedSubject = useMemo(() => {
    if (!propertiesQuery.data || !selectedSubjectKey) return null;
    return propertiesQuery.data.find((item) => item.listingKey === selectedSubjectKey) ?? null;
  }, [propertiesQuery.data, selectedSubjectKey]);

  const handleGenerate = () => {
    const listingKey = selectedSubjectKey.trim();
    if (!listingKey) {
      toast.error(copy.toasts.selectSubject);
      return;
    }
    generateMutation.mutate({
      listingKey,
      limit: parsedLimit,
    });
  };

  const goToShareStudio = (listingKeys: string[], title?: string) => {
    const unique = Array.from(new Set(listingKeys.map((item) => item.trim()).filter((item) => item.length > 0))).slice(0, 15);

    if (unique.length === 0) {
      toast.error(copy.toasts.noShareListings);
      return;
    }

    const params = new URLSearchParams();
    params.set("listingKeys", unique.join(","));
    params.set("source", "cma");
    if (title && title.trim().length > 0) {
      params.set("title", title.trim());
    }
    router.push(`/magic-share?${params.toString()}`);
  };

  return (
    <div className="space-y-6 pb-8">
      <div className="rounded-3xl border border-primary/10 bg-gradient-to-br from-primary/5 via-primary/2 to-transparent p-6 text-foreground shadow-sm md:p-8">
        <h1 className="text-3xl font-serif tracking-tight text-foreground md:text-4xl">{copy.heroTitle}</h1>
        <p className="mt-3 max-w-3xl text-sm text-muted-foreground md:text-base">{copy.heroDescription}</p>
        {prefill.subjectKey ? (
          <p className="mt-2 text-xs text-muted-foreground/70">
            {copy.prefillLabel}
            {prefill.subjectKey}
          </p>
        ) : null}
      </div>

      {embeddingStatus && (embeddingStatus.needsEmbedding ?? 0) > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm dark:border-amber-800 dark:bg-amber-950/30">
          <Zap className="h-4 w-4 shrink-0 text-amber-600" />
          <span className="text-amber-800 dark:text-amber-300">
            {embeddingStatus.needsEmbedding} / {embeddingStatus.totalProperties} {copy.embedding.pendingSummary}
            {embeddingStatus.isRunning ? ` — ${copy.embedding.processing}` : ""}
          </span>
          <Button
            size="sm"
            variant="outline"
            className="ml-auto h-7 text-xs"
            disabled={embeddingStatus.isRunning || triggerEmbeddingMutation.isPending}
            onClick={() => triggerEmbeddingMutation.mutate()}
          >
            {embeddingStatus.isRunning ? (
              <>
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                {copy.embedding.running}
              </>
            ) : (
              <>
                <Zap className="mr-1 h-3 w-3" />
                {copy.embedding.runNow}
              </>
            )}
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Card>
          <CardHeader>
            <CardTitle>{copy.subjectCard.title}</CardTitle>
            <CardDescription>{copy.subjectCard.description}</CardDescription>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={copy.subjectCard.searchPlaceholder} />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-[1fr_180px_180px]">
              <div className="space-y-1">
                <p className="text-sm font-medium">{copy.subjectCard.currentSubject}</p>
                <p className="text-sm text-muted-foreground">
                  {selectedSubject
                    ? formatAddress({
                        address: selectedSubject.unparsedAddress,
                        city: selectedSubject.city,
                        listingId: selectedSubject.listingId,
                        listingKey: selectedSubject.listingKey,
                      })
                    : copy.subjectCard.notSelected}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium">{copy.subjectCard.comparableCount}</p>
                <Input type="number" min={1} max={20} value={limitText} onChange={(e) => setLimitText(e.target.value)} />
              </div>
              <div className="flex items-end">
                <Button className="w-full gap-2" onClick={handleGenerate} disabled={generateMutation.isPending}>
                  {generateMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {copy.subjectCard.generating}
                    </>
                  ) : (
                    <>
                      <BarChart3 className="h-4 w-4" />
                      {copy.subjectCard.generate}
                    </>
                  )}
                </Button>
              </div>
            </div>

            <ScrollArea className="h-[360px] pr-3">
              <div className="space-y-2">
                {propertiesQuery.isLoading ? (
                  <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {copy.subjectCard.loadingProperties}
                  </div>
                ) : propertiesQuery.data && propertiesQuery.data.length > 0 ? (
                  propertiesQuery.data.map((item) => {
                    const active = selectedSubjectKey === item.listingKey;
                    return (
                      <button
                        key={item.listingKey}
                        type="button"
                        className={`w-full rounded-xl border p-3 text-left transition-colors ${
                          active ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "border-border/50 hover:border-border hover:bg-muted/50"
                        }`}
                        onClick={() => setSelectedSubjectKey(item.listingKey ?? "")}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="line-clamp-1 font-medium">{item.unparsedAddress || item.listingId || item.listingKey}</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {[item.city, item.stateOrProvince, item.postalCode].filter(Boolean).join(", ") || copy.subjectCard.mlsFallback}
                            </p>
                          </div>
                          <Badge variant={active ? "default" : "secondary"}>{formatPriceValue(item.listPrice ?? null)}</Badge>
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <p className="py-8 text-center text-sm text-muted-foreground">{copy.subjectCard.noProperties}</p>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                {copy.outputCard.title}
              </CardTitle>
              <CardDescription>{copy.outputCard.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!generated ? (
                <p className="text-sm text-muted-foreground">{copy.outputCard.empty}</p>
              ) : (
                <>
                  <div className="rounded-xl border border-border/50 bg-muted/30 p-3">
                    <p className="text-xs text-muted-foreground">{copy.outputCard.subject}</p>
                    <p className="mt-1 font-medium">{formatAddress(generated.subject)}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {formatPriceValue(generated.subject.price)} · {generated.subject.propertyType || copy.outputCard.propertyFallback}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{copy.outputCard.comparables} {generated.comparables.length}</Badge>
                    <Badge variant="outline" className="gap-1">
                      <Clock3 className="h-3 w-3" />
                      {(generated.meta.responseTimeMs / 1000).toFixed(2)}s
                    </Badge>
                  </div>

                  <ScrollArea className="h-[260px] pr-3">
                    <div className="space-y-2">
                      {generated.comparables.map((item, index) => (
                        <div key={item.listingKey} className="rounded-xl border border-border/50 px-3 py-2 transition-colors hover:bg-muted/30">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-medium">
                                {index + 1}. {formatAddress(item)}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {formatPriceValue(item.price)} · {item.propertyType || copy.outputCard.propertyFallback} · {item.status || copy.outputCard.unknownStatus}
                              </p>
                            </div>
                            <Badge variant="outline">{copy.outputCard.score} {(item.score * 100).toFixed(1)}%</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>

                  <Button
                    className="w-full gap-2"
                    onClick={() =>
                      goToShareStudio(
                        [generated.subject.listingKey, ...generated.comparables.map((item) => item.listingKey)],
                        `${copy.outputCard.shareTitlePrefix}${formatAddress(generated.subject)}`,
                      )
                    }
                  >
                    <Share2 className="h-4 w-4" />
                    {copy.outputCard.openShare}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{copy.historyCard.title}</CardTitle>
              <CardDescription>{copy.historyCard.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {historyQuery.isLoading ? (
                <p className="flex items-center text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {copy.historyCard.loading}
                </p>
              ) : historyQuery.data && historyQuery.data.length > 0 ? (
                historyQuery.data.slice(0, 10).map((item) => (
                  <div key={item.id} className="rounded-xl border border-border/50 p-3 transition-colors hover:bg-muted/30">
                    <p className="font-medium">{item.subjectAddress || item.subjectListingKey}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {item.comparableCount} {copy.historyCard.comparableCount} · {formatDateTime(item.createdAt)}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          goToShareStudio(
                            [item.subjectListingKey, ...item.comparableKeys],
                            `${copy.outputCard.shareTitlePrefix}${item.subjectAddress || item.subjectListingKey}`,
                          )
                        }
                      >
                        <Share2 className="mr-1.5 h-3.5 w-3.5" />
                        {copy.historyCard.openShare}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setSelectedSubjectKey(item.subjectListingKey);
                          toast.success(copy.historyCard.setSubjectSuccess);
                        }}
                      >
                        {copy.historyCard.setSubject}
                        <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">{copy.historyCard.empty}</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
