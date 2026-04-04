// Studios — AI Video Generator for Real Estate Listings
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
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { useT } from "@/i18n";
import { StudioAspectRatio } from "@/lib/slideshowVideo";
import {
  Check,
  CheckCircle2,
  ChevronRight,
  Clapperboard,
  Clock,
  Download,
  FlaskConical,
  GripVertical,
  Image as ImageIcon,
  Loader2,
  Monitor,
  Search,
  Sparkles,
  Upload,
  Video,
  X,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

/* ────────────────────────────────────────────────────────────── */
/*  Types                                                        */
/* ────────────────────────────────────────────────────────────── */

type ListingSearchItem = {
  id: number;
  listingKey: string;
  listingId: string | null;
  unparsedAddress: string | null;
  city: string | null;
  stateOrProvince: string | null;
  postalCode: string | null;
  listPrice: string | null;
  bedroomsTotal: number | null;
  bathroomsTotalInteger: number | null;
  livingArea: string | null;
  propertyType: string | null;
  thumbnailUrl?: string | null;
};

type ListingMedia = {
  mediaURL: string | null;
  order?: number | null;
};

type ListingDetail = ListingSearchItem & {
  publicRemarks?: string | null;
  media?: ListingMedia[];
};

type ImageItem = {
  url: string;
  source: "mls" | "upload";
  label: string;
  selected: boolean;
};

/* ────────────────────────────────────────────────────────────── */
/*  Helpers                                                      */
/* ────────────────────────────────────────────────────────────── */

function formatPrice(value: string | null | undefined, fallback: string) {
  if (!value) return fallback;
  const number = Number(value);
  if (!Number.isFinite(number)) return value;
  if (number >= 1_000_000) return `$${(number / 1_000_000).toFixed(2)}M`;
  if (number >= 1_000) return `$${(number / 1_000).toFixed(0)}K`;
  return `$${number.toLocaleString()}`;
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
  return (
    [item.listingId, item.city, item.stateOrProvince, item.postalCode]
      .filter(Boolean)
      .join(" · ") || fallback
  );
}

/* ────────────────────────────────────────────────────────────── */
/*  Step indicator                                               */
/* ────────────────────────────────────────────────────────────── */

function StepIndicator({
  steps,
  current,
}: {
  steps: { label: string; icon: React.ReactNode }[];
  current: number;
}) {
  return (
    <div className="flex items-center gap-1 sm:gap-2">
      {steps.map((step, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={step.label} className="flex items-center gap-1 sm:gap-2">
            {i > 0 && (
              <ChevronRight
                className={`h-3.5 w-3.5 shrink-0 ${
                  done ? "text-primary" : "text-muted-foreground/30"
                }`}
              />
            )}
            <div
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                active
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : done
                  ? "bg-primary/10 text-primary"
                  : "bg-muted/50 text-muted-foreground"
              }`}
            >
              {done ? <Check className="h-3 w-3" /> : step.icon}
              <span className="hidden sm:inline">{step.label}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────── */
/*  Main Component                                               */
/* ────────────────────────────────────────────────────────────── */

export default function Studios() {
  const { t } = useT();

  // ─── State ─────────────────────────────────────────
  const [step, setStep] = useState(0);
  const [search, setSearch] = useState("");
  const [selectedListingKey, setSelectedListingKey] = useState("");
  const [aspectRatio, setAspectRatio] = useState<StudioAspectRatio>("9:16");
  const [secondsPerImage, setSecondsPerImage] = useState("3");
  const [stylePrompt, setStylePrompt] = useState("");

  const [images, setImages] = useState<ImageItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [rendering, setRendering] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const [progressText, setProgressText] = useState("");
  const [downloadUrl, setDownloadUrl] = useState("");
  const [downloadFileName, setDownloadFileName] = useState("");
  const [pollingJobId, setPollingJobId] = useState("");
  const trimmedSearch = search.trim();
  const shouldSearchListings = trimmedSearch.length >= 2;

  // ─── Queries ───────────────────────────────────────
  const providerStatusQuery = trpc.studio.providerStatus.useQuery();
  const listingsQuery = trpc.mls.getProperties.useQuery(
    {
      search: trimmedSearch || undefined,
      status: "Active",
      limit: 24,
      offset: 0,
    },
    {
      enabled: shouldSearchListings,
    },
  );
  const listingDetailQuery = trpc.mls.getPropertyById.useQuery(
    { listingKey: selectedListingKey },
    { enabled: Boolean(selectedListingKey) }
  );

  const pollJobQuery = trpc.studio.pollVideoJob.useQuery(
    { jobId: pollingJobId },
    {
      enabled: Boolean(pollingJobId),
      refetchInterval: pollingJobId ? 5000 : false,
    }
  );

  const createCloudVideoTaskMutation =
    trpc.studio.createCloudVideoTask.useMutation({
      onError: (error) => {
        toast.error(t("studios.cloudTaskFailed"), {
          description: error.message,
        });
      },
    });

  const uploadImageMutation = trpc.studio.uploadImage.useMutation({
    onError: (error) => {
      toast.error(t("studios.uploadFailed"), { description: error.message });
    },
  });

  const listingResults = (listingsQuery.data ?? []) as ListingSearchItem[];
  const selectedListing = (listingDetailQuery.data ??
    null) as ListingDetail | null;

  const providerStatus = providerStatusQuery.data;
  const soraReady = providerStatus?.providers?.sora?.enabled ?? false;

  // ─── Sync MLS images into the unified images array ─
  const mlsImageUrls = useMemo(() => {
    const urls = (selectedListing?.media ?? [])
      .map((item) => item.mediaURL)
      .filter(
        (item): item is string => Boolean(item && item.trim().length > 0)
      );
    return Array.from(new Set(urls));
  }, [selectedListing]);

  useEffect(() => {
    // Keep uploaded images, replace MLS images
    setImages((prev) => {
      const uploaded = prev.filter((img) => img.source === "upload");
      const mls: ImageItem[] = mlsImageUrls.map((url, i) => ({
        url,
        source: "mls" as const,
        label: `MLS ${i + 1}`,
        selected: true,
      }));
      // Re-select all uploaded that were selected before
      return [...mls, ...uploaded];
    });
  }, [mlsImageUrls]);

  // ─── Poll job completion ───────────────────────────
  useEffect(() => {
    if (!pollJobQuery.data) return;
    const { status, downloadUrl: videoUrl } = pollJobQuery.data;

    if (status === "completed" || status === "succeeded") {
      setPollingJobId("");
      if (videoUrl) {
        setDownloadUrl(videoUrl);
        setDownloadFileName(
          `${selectedListingKey || "video"}-sora-${Date.now()}.mp4`
        );
      }
      setProgressPercent(100);
      setProgressText(t("studios.cloudTaskComplete"));
      setRendering(false);
      toast.success(t("studios.cloudVideoGenerated"));
    } else if (status === "failed" || status === "error") {
      setPollingJobId("");
      setRendering(false);
      setProgressText(t("studios.videoFailed"));
      toast.error(t("studios.videoFailed"));
    } else {
      // Still processing — bump progress bar gently
      setProgressPercent((prev) => Math.min(prev + 2, 90));
    }
  }, [pollJobQuery.data, selectedListingKey, t]);

  // ─── Cleanup blob URLs ─────────────────────────────
  useEffect(() => {
    return () => {
      if (downloadUrl.startsWith("blob:")) {
        URL.revokeObjectURL(downloadUrl);
      }
    };
  }, [downloadUrl]);

  // ─── Derived ───────────────────────────────────────
  const selectedImages = useMemo(
    () => images.filter((img) => img.selected),
    [images]
  );

  const mlsCount = images.filter((img) => img.source === "mls").length;
  const uploadCount = images.filter((img) => img.source === "upload").length;
  const selectedCount = selectedImages.length;

  const estimatedDuration = useMemo(() => {
    const spi = Number.parseFloat(secondsPerImage);
    if (!Number.isFinite(spi) || spi <= 0) return 0;
    return Math.round(selectedCount * spi);
  }, [selectedCount, secondsPerImage]);

  const estimatedCost = useMemo(() => {
    return (estimatedDuration * 0.1).toFixed(2);
  }, [estimatedDuration]);

  // ─── Handlers ──────────────────────────────────────

  const toggleImage = (index: number) => {
    setImages((prev) =>
      prev.map((img, i) =>
        i === index ? { ...img, selected: !img.selected } : img
      )
    );
  };

  const selectAll = () =>
    setImages((prev) => prev.map((img) => ({ ...img, selected: true })));
  const deselectAll = () =>
    setImages((prev) => prev.map((img) => ({ ...img, selected: false })));

  const handleFileUpload = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files).filter(
        (f) => f.type.startsWith("image/") && f.size <= 10 * 1024 * 1024
      );
      if (fileArray.length === 0) {
        toast.error(t("studios.invalidFile"));
        return;
      }

      setUploading(true);
      const newImages: ImageItem[] = [];

      for (const file of fileArray) {
        try {
          const base64 = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.readAsDataURL(file);
          });

          const mimeType =
            file.type === "image/png"
              ? ("image/png" as const)
              : file.type === "image/webp"
              ? ("image/webp" as const)
              : ("image/jpeg" as const);

          const result = await uploadImageMutation.mutateAsync({
            base64Data: base64,
            fileName: file.name,
            mimeType,
          });
          newImages.push({
            url: result.url,
            source: "upload",
            label: file.name.replace(/\.[^.]+$/, ""),
            selected: true,
          });
        } catch {
          // error already handled by onError
        }
      }

      if (newImages.length > 0) {
        setImages((prev) => [...prev, ...newImages]);
        toast.success(
          t("studios.uploadSuccess", { count: String(newImages.length) })
        );
      }
      setUploading(false);
    },
    [uploadImageMutation, t]
  );

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSelectListing = (key: string) => {
    setSelectedListingKey(key);
    setStep(0); // stay on step 0, images will load via effect
  };

  const startGenerate = async () => {
    if (selectedCount === 0) {
      toast.error(t("studios.noAvailableImages"));
      return;
    }

    const perImageSeconds = Number.parseFloat(secondsPerImage);
    if (!Number.isFinite(perImageSeconds) || perImageSeconds <= 0) {
      toast.error(t("studios.invalidDuration"));
      return;
    }

    setDownloadUrl("");
    setProgressPercent(0);
    setProgressText(t("studios.cloudTaskCreated"));
    setRendering(true);

    try {
      const response = await createCloudVideoTaskMutation.mutateAsync({
        provider: "sora",
        title: displayAddress(
          selectedListing ?? {},
          t("studios.addressUnknown")
        ),
        prompt: stylePrompt.trim() || undefined,
        imageUrls: selectedImages.map((img) => img.url),
        aspectRatio,
        durationSecondsPerImage: perImageSeconds,
      });

      if (response.downloadUrl) {
        setDownloadUrl(response.downloadUrl);
        setDownloadFileName(
          `${selectedListingKey || "video"}-sora-${Date.now()}.mp4`
        );
        setProgressPercent(100);
        setProgressText(t("studios.cloudTaskComplete"));
        setRendering(false);
        toast.success(t("studios.cloudVideoGenerated"));
      } else if (response.jobId) {
        // Start polling
        setPollingJobId(response.jobId);
        setProgressPercent(15);
        setProgressText(
          t("studios.taskSubmitted", {
            provider: "Sora 2",
            jobId: response.jobId,
          })
        );
        toast.success(t("studios.cloudTaskSuccess"));
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t("studios.videoFailed");
      toast.error(t("studios.videoFailed"), { description: message });
      setRendering(false);
    }
  };

  // ─── Step definitions ──────────────────────────────
  const steps = [
    { label: t("studios.step1Title"), icon: <Search className="h-3 w-3" /> },
    {
      label: t("studios.stepSelectImages"),
      icon: <ImageIcon className="h-3 w-3" />,
    },
    {
      label: t("studios.step2Title"),
      icon: <Sparkles className="h-3 w-3" />,
    },
  ];

  // ─── Render ────────────────────────────────────────
  return (
    <div className="space-y-6 pb-8">
      {/* ─── Hero ──────────────────────────────────── */}
      <div className="rounded-3xl border border-primary/10 bg-gradient-to-br from-primary/5 via-primary/2 to-transparent p-6 text-foreground shadow-sm md:p-8">
        <div className="flex items-center gap-2 text-sm text-primary">
          <Video className="h-4 w-4" />
          {t("studios.eyebrow")}
        </div>
        <h1 className="mt-2 text-3xl font-serif tracking-tight md:text-4xl">
          {t("studios.heroTitle")}
        </h1>
        <p className="mt-3 max-w-3xl text-sm text-muted-foreground md:text-base">
          {t("studios.heroDescriptionV2")}
        </p>
      </div>

      {/* ─── Step Indicator ────────────────────────── */}
      <div className="flex items-center justify-between">
        <StepIndicator steps={steps} current={step} />
        <div className="flex items-center gap-2">
          {step > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setStep(step - 1)}
            >
              {t("studios.back")}
            </Button>
          )}
          {step < 2 && (
            <Button
              size="sm"
              onClick={() => setStep(step + 1)}
              disabled={step === 0 && !selectedListingKey}
            >
              {t("studios.next")}
              <ChevronRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          )}
        </div>
      </div>

      {/* ═══════════ STEP 0: Select Listing ═══════════ */}
      {step === 0 && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1fr]">
          {/* Left — Search */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Search className="h-4 w-4" />
                {t("studios.step1Title")}
              </CardTitle>
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("studios.searchPlaceholder")}
                className="mt-2"
              />
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[480px] pr-3">
                <div className="space-y-1.5">
                  {!shouldSearchListings ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      {t("studios.startSearch")}
                    </p>
                  ) : listingsQuery.isLoading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {t("studios.loadingListings")}
                    </div>
                  ) : listingResults.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      {t("studios.noSearchResults")}
                    </p>
                  ) : (
                    listingResults.map((item) => {
                      const active = selectedListingKey === item.listingKey;
                      return (
                        <button
                          key={item.listingKey}
                          type="button"
                          onClick={() => handleSelectListing(item.listingKey)}
                          className={`w-full rounded-xl border p-3 text-left transition-all ${
                            active
                              ? "border-primary bg-primary/5 ring-2 ring-primary/20 shadow-sm"
                              : "border-transparent hover:bg-muted/40 hover:border-border"
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            {item.thumbnailUrl ? (
                              <img
                                src={item.thumbnailUrl}
                                alt={displayAddress(
                                  item,
                                  t("studios.addressUnknown")
                                )}
                                className="h-16 w-24 rounded-lg border object-cover shrink-0"
                              />
                            ) : (
                              <div className="flex h-16 w-24 items-center justify-center rounded-lg border bg-muted/30 shrink-0">
                                <ImageIcon className="h-5 w-5 text-muted-foreground/40" />
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium">
                                {displayAddress(
                                  item,
                                  t("studios.addressUnknown")
                                )}
                              </p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {formatPrice(
                                  item.listPrice,
                                  t("studios.pricePending")
                                )}{" "}
                                · {item.listingKey}
                              </p>
                              <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                                {item.bedroomsTotal != null && (
                                  <span>{item.bedroomsTotal} bd</span>
                                )}
                                {item.bathroomsTotalInteger != null && (
                                  <span>{item.bathroomsTotalInteger} ba</span>
                                )}
                                {item.livingArea && (
                                  <span>
                                    {Number(item.livingArea).toLocaleString()}{" "}
                                    sqft
                                  </span>
                                )}
                              </div>
                            </div>
                            {active && (
                              <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-1" />
                            )}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Right — Preview of selected listing */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <ImageIcon className="h-4 w-4" />
                {t("studios.listingPreview")}
              </CardTitle>
              {selectedListing && (
                <CardDescription>
                  {displayAddress(
                    selectedListing,
                    t("studios.addressUnknown")
                  )}{" "}
                  ·{" "}
                  {formatPrice(
                    selectedListing.listPrice,
                    t("studios.pricePending")
                  )}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent>
              {listingDetailQuery.isLoading ? (
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-20">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("studios.loadingImages")}
                </div>
              ) : !selectedListing ? (
                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                  <Search className="h-10 w-10 mb-3 opacity-30" />
                  <p className="text-sm">{t("studios.noSelection")}</p>
                </div>
              ) : mlsImageUrls.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                  <ImageIcon className="h-10 w-10 mb-3 opacity-30" />
                  <p className="text-sm">{t("studios.noImages")}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Main preview image */}
                  <div className="overflow-hidden rounded-xl border">
                    <img
                      src={mlsImageUrls[0]}
                      alt="Primary"
                      className="h-56 w-full object-cover"
                    />
                  </div>
                  {/* Thumbnail strip */}
                  <div className="grid grid-cols-5 gap-2">
                    {mlsImageUrls.slice(1, 6).map((url, i) => (
                      <div
                        key={url}
                        className="overflow-hidden rounded-lg border"
                      >
                        <img
                          src={url}
                          alt={`Photo ${i + 2}`}
                          className="h-16 w-full object-cover"
                          loading="lazy"
                        />
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground text-center">
                    {t("studios.totalMlsImages", {
                      count: String(mlsImageUrls.length),
                    })}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ═══════════ STEP 1: Select & Upload Images ═══════════ */}
      {step === 1 && (
        <div className="space-y-6">
          {/* Upload zone */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Upload className="h-4 w-4" />
                {t("studios.uploadCustomImages")}
              </CardTitle>
              <CardDescription>
                {t("studios.uploadDescription")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div
                className="relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-muted-foreground/20 bg-muted/10 p-6 transition hover:border-primary/40 hover:bg-primary/5 cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (e.dataTransfer.files.length > 0)
                    handleFileUpload(e.dataTransfer.files);
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      handleFileUpload(e.target.files);
                      e.target.value = "";
                    }
                  }}
                />
                {uploading ? (
                  <>
                    <Loader2 className="h-7 w-7 animate-spin text-primary mb-2" />
                    <p className="text-sm text-muted-foreground">
                      {t("studios.uploading")}
                    </p>
                  </>
                ) : (
                  <>
                    <Upload className="h-7 w-7 text-muted-foreground/50 mb-2" />
                    <p className="text-sm font-medium">
                      {t("studios.clickOrDragUpload")}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t("studios.uploadFormats")}
                    </p>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Unified image gallery with selection */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <ImageIcon className="h-4 w-4" />
                    {t("studios.selectImagesTitle")}
                  </CardTitle>
                  <CardDescription className="mt-1">
                    {t("studios.selectImagesDesc", {
                      total: String(images.length),
                      selected: String(selectedCount),
                      mls: String(mlsCount),
                      upload: String(uploadCount),
                    })}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={selectAll}>
                    {t("studios.selectAll")}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={deselectAll}>
                    {t("studios.deselectAll")}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {images.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <ImageIcon className="h-10 w-10 mb-3 opacity-30" />
                  <p className="text-sm">{t("studios.noImages")}</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8">
                  {images.map((img, index) => (
                    <div
                      key={`${img.url}-${index}`}
                      className={`group relative cursor-pointer overflow-hidden rounded-xl border-2 transition-all ${
                        img.selected
                          ? "border-primary ring-1 ring-primary/20 shadow-sm"
                          : "border-transparent opacity-50 hover:opacity-80"
                      }`}
                      onClick={() => toggleImage(index)}
                    >
                      <img
                        src={img.url}
                        alt={img.label}
                        className="h-24 w-full object-cover"
                        loading="lazy"
                      />

                      {/* Selection indicator */}
                      <div
                        className={`absolute top-1.5 left-1.5 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold transition-all ${
                          img.selected
                            ? "bg-primary text-primary-foreground"
                            : "bg-black/40 text-white"
                        }`}
                      >
                        {img.selected ? (
                          <Check className="h-3 w-3" />
                        ) : (
                          ""
                        )}
                      </div>

                      {/* Source badge */}
                      <div className="absolute bottom-1 left-1">
                        <Badge
                          variant="secondary"
                          className="text-[9px] px-1.5 py-0 h-4 bg-black/50 text-white border-0"
                        >
                          {img.source === "mls" ? "MLS" : "Upload"}
                        </Badge>
                      </div>

                      {/* Remove button (uploads only) */}
                      {img.source === "upload" && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeImage(index);
                          }}
                          className="absolute top-1.5 right-1.5 rounded-full bg-black/60 p-0.5 text-white opacity-0 group-hover:opacity-100 transition"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ═══════════ STEP 2: Configure & Generate ═══════════ */}
      {step === 2 && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1fr]">
          {/* Left — Configuration */}
          <div className="space-y-6">
            {/* Provider card */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Zap className="h-4 w-4" />
                  {t("studios.videoModel")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Sora 2 — primary */}
                <div
                  className={`rounded-xl border-2 p-4 transition-all ${
                    soraReady
                      ? "border-primary bg-primary/5"
                      : "border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                        <Sparkles className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">Sora 2</p>
                        <p className="text-xs text-muted-foreground">
                          Azure OpenAI · {t("studios.soraDesc")}
                        </p>
                      </div>
                    </div>
                    {soraReady ? (
                      <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        {t("studios.ready")}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-amber-600 border-amber-300">
                        {t("studios.notConfigured")}
                      </Badge>
                    )}
                  </div>
                  {!soraReady && (
                    <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                      {providerStatus?.providers?.sora?.note}
                    </p>
                  )}
                </div>

                {/* Local — dev */}
                <div className="rounded-xl border border-dashed border-muted-foreground/20 p-3 opacity-50">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted/50">
                      <Monitor className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-sm text-muted-foreground">
                        Local Render
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t("studios.localDesc")}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className="text-muted-foreground border-dashed"
                    >
                      <FlaskConical className="h-3 w-3 mr-1" />
                      {t("studios.inDev")}
                    </Badge>
                  </div>
                </div>

                {/* Jimeng — dev */}
                <div className="rounded-xl border border-dashed border-muted-foreground/20 p-3 opacity-50">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted/50">
                      <FlaskConical className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-sm text-muted-foreground">
                        Jimeng (Dreamina)
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t("studios.jimengDesc")}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className="text-muted-foreground border-dashed"
                    >
                      <FlaskConical className="h-3 w-3 mr-1" />
                      {t("studios.inDev")}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Parameters card */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Clapperboard className="h-4 w-4" />
                  {t("studios.videoParams")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Aspect ratio buttons */}
                <div className="space-y-1.5">
                  <Label>{t("studios.ratio")}</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {(
                      [
                        { value: "9:16", label: "9:16", sub: "Reel / Story" },
                        { value: "16:9", label: "16:9", sub: "YouTube" },
                        { value: "1:1", label: "1:1", sub: "Feed" },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setAspectRatio(opt.value)}
                        className={`rounded-xl border-2 p-3 text-center transition-all ${
                          aspectRatio === opt.value
                            ? "border-primary bg-primary/5"
                            : "border-transparent bg-muted/30 hover:bg-muted/50"
                        }`}
                      >
                        <p className="font-mono text-sm font-bold">
                          {opt.label}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {opt.sub}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Duration per image */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>{t("studios.secondsPerImage")}</Label>
                    <Input
                      value={secondsPerImage}
                      onChange={(e) => setSecondsPerImage(e.target.value)}
                      placeholder="3"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t("studios.selectedImages")}</Label>
                    <div className="flex h-9 items-center rounded-md border bg-muted/30 px-3 text-sm">
                      {selectedCount} / {images.length}
                    </div>
                  </div>
                </div>

                {/* Style prompt */}
                <div className="space-y-1.5">
                  <Label>{t("studios.stylePrompt")}</Label>
                  <Textarea
                    value={stylePrompt}
                    onChange={(e) => setStylePrompt(e.target.value)}
                    rows={3}
                    placeholder={t("studios.stylePromptPlaceholder")}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right — Summary & Generate */}
          <div className="space-y-6">
            {/* Summary card */}
            <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Video className="h-4 w-4" />
                  {t("studios.summary")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Listing info */}
                {selectedListing && (
                  <div className="flex items-center gap-3 rounded-xl bg-background/80 p-3 border">
                    {selectedListing.thumbnailUrl ? (
                      <img
                        src={selectedListing.thumbnailUrl}
                        alt=""
                        className="h-12 w-16 rounded-lg object-cover border"
                      />
                    ) : (
                      <div className="flex h-12 w-16 items-center justify-center rounded-lg border bg-muted/30">
                        <ImageIcon className="h-4 w-4 text-muted-foreground/40" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {displayAddress(
                          selectedListing,
                          t("studios.addressUnknown")
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatPrice(
                          selectedListing.listPrice,
                          t("studios.pricePending")
                        )}
                      </p>
                    </div>
                  </div>
                )}

                {/* Stats grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-background/80 border p-3 text-center">
                    <p className="text-2xl font-bold tabular-nums">
                      {selectedCount}
                    </p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">
                      {t("studios.images")}
                    </p>
                  </div>
                  <div className="rounded-xl bg-background/80 border p-3 text-center">
                    <p className="text-2xl font-bold tabular-nums">
                      {estimatedDuration}s
                    </p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">
                      {t("studios.duration")}
                    </p>
                  </div>
                  <div className="rounded-xl bg-background/80 border p-3 text-center">
                    <p className="text-2xl font-bold tabular-nums">
                      {aspectRatio}
                    </p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">
                      {t("studios.ratio")}
                    </p>
                  </div>
                  <div className="rounded-xl bg-background/80 border p-3 text-center">
                    <p className="text-2xl font-bold tabular-nums">
                      ~${estimatedCost}
                    </p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">
                      {t("studios.estimatedCost")}
                    </p>
                  </div>
                </div>

                {/* Image thumbnails strip */}
                {selectedImages.length > 0 && (
                  <div className="flex gap-1.5 overflow-x-auto pb-1">
                    {selectedImages.slice(0, 12).map((img, i) => (
                      <img
                        key={`${img.url}-${i}`}
                        src={img.url}
                        alt={img.label}
                        className="h-12 w-12 shrink-0 rounded-lg object-cover border"
                        loading="lazy"
                      />
                    ))}
                    {selectedImages.length > 12 && (
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border bg-muted/50 text-xs text-muted-foreground font-medium">
                        +{selectedImages.length - 12}
                      </div>
                    )}
                  </div>
                )}

                {/* Generate button */}
                <Button
                  type="button"
                  onClick={startGenerate}
                  disabled={rendering || !soraReady || selectedCount === 0}
                  className="w-full h-12 text-base"
                  size="lg"
                >
                  {rendering ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      {t("studios.generating")}
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-5 w-5 mr-2" />
                      {t("studios.generateWithSora")}
                    </>
                  )}
                </Button>

                {!soraReady && (
                  <p className="text-xs text-center text-amber-600">
                    {t("studios.configureFirst")}
                  </p>
                )}

                {/* Progress */}
                {(rendering || progressPercent > 0) && (
                  <div className="space-y-2">
                    <Progress value={progressPercent} className="h-2" />
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {rendering && (
                        <Clock className="h-3 w-3 animate-pulse" />
                      )}
                      <span>{progressText || t("studios.ready")}</span>
                    </div>
                  </div>
                )}

                {/* Download button */}
                {downloadUrl && (
                  <a
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-medium text-white hover:bg-emerald-700 transition-colors"
                    href={downloadUrl}
                    download={downloadFileName || undefined}
                    target={
                      downloadUrl.startsWith("http") ? "_blank" : undefined
                    }
                    rel={
                      downloadUrl.startsWith("http")
                        ? "noreferrer"
                        : undefined
                    }
                  >
                    <Download className="h-4 w-4" />
                    {t("studios.downloadVideo")}
                  </a>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
