// legacy page — incrementally migrated
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { useT } from "@/i18n";
import {
  renderSlideshowVideo,
  resolveVideoDimensions,
  StudioAspectRatio,
} from "@/lib/slideshowVideo";
import {
  Clapperboard,
  Cloud,
  Download,
  Image as ImageIcon,
  Loader2,
  Search,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

type StudioProvider = "local" | "sora" | "jimeng";

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

function formatPrice(value: string | null | undefined, fallback: string) {
  if (!value) return fallback;
  const number = Number(value);
  if (!Number.isFinite(number)) return value;
  if (number >= 1_000_000) return `$${(number / 1_000_000).toFixed(2)}M`;
  if (number >= 1_000) return `$${(number / 1_000).toFixed(0)}K`;
  return `$${number.toLocaleString()}`;
}

function displayAddress(item: {
  unparsedAddress?: string | null;
  listingId?: string | null;
  city?: string | null;
  stateOrProvince?: string | null;
  postalCode?: string | null;
}, fallback: string) {
  const full = item.unparsedAddress?.trim();
  if (full) return full;
  return [item.listingId, item.city, item.stateOrProvince, item.postalCode]
    .filter(Boolean)
    .join(" · ") || fallback;
}

export default function Studios() {
  const { t } = useT();
  const [search, setSearch] = useState("");
  const [selectedListingKey, setSelectedListingKey] = useState("");
  const [provider, setProvider] = useState<StudioProvider>("local");
  const [aspectRatio, setAspectRatio] = useState<StudioAspectRatio>("9:16");
  const [secondsPerImage, setSecondsPerImage] = useState("2.5");
  const [stylePrompt, setStylePrompt] = useState("");

  const [rendering, setRendering] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const [progressText, setProgressText] = useState("");
  const [downloadUrl, setDownloadUrl] = useState("");
  const [downloadFileName, setDownloadFileName] = useState("");
  const [cloudTaskInfo, setCloudTaskInfo] = useState<string>("");

  const [uploadedImages, setUploadedImages] = useState<{ url: string; filename: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadImageMutation = trpc.studio.uploadImage.useMutation({
    onError: (error) => {
      toast.error(t("studios.uploadFailed"), { description: error.message });
    },
  });

  const handleFileUpload = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files).filter(
      (f) => f.type.startsWith("image/") && f.size <= 10 * 1024 * 1024
    );
    if (fileArray.length === 0) {
      toast.error(t("studios.invalidFile"));
      return;
    }

    setUploading(true);
    const results: { url: string; filename: string }[] = [];

    for (const file of fileArray) {
      try {
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });

        const mimeType = file.type === "image/png" ? "image/png" as const
          : file.type === "image/webp" ? "image/webp" as const
            : "image/jpeg" as const;

        const result = await uploadImageMutation.mutateAsync({
          base64Data: base64,
          fileName: file.name,
          mimeType,
        });
        results.push(result);
      } catch {
        // error already handled by onError
      }
    }

    if (results.length > 0) {
      setUploadedImages((prev) => [...prev, ...results]);
      toast.success(t("studios.uploadSuccess", { count: String(results.length) }));
    }
    setUploading(false);
  }, [uploadImageMutation, t]);

  const removeUploadedImage = (index: number) => {
    setUploadedImages((prev) => prev.filter((_, i) => i !== index));
  };

  const providerStatusQuery = trpc.studio.providerStatus.useQuery();
  const listingsQuery = trpc.mls.getProperties.useQuery({
    search: search || undefined,
    status: "Active",
    limit: 24,
    offset: 0,
  });
  const listingDetailQuery = trpc.mls.getPropertyById.useQuery(
    { listingKey: selectedListingKey },
    { enabled: Boolean(selectedListingKey) }
  );

  const createCloudVideoTaskMutation = trpc.studio.createCloudVideoTask.useMutation({
    onError: (error) => {
      toast.error(t("studios.cloudTaskFailed"), { description: error.message });
    },
  });

  const listingResults = (listingsQuery.data ?? []) as ListingSearchItem[];
  const selectedListing = (listingDetailQuery.data ?? null) as ListingDetail | null;

  const mlsImageUrls = useMemo(() => {
    const urls = (selectedListing?.media ?? [])
      .map((item) => item.mediaURL)
      .filter((item): item is string => Boolean(item && item.trim().length > 0));
    return Array.from(new Set(urls));
  }, [selectedListing]);

  const imageUrls = useMemo(() => {
    return [...mlsImageUrls, ...uploadedImages.map((img) => img.url)];
  }, [mlsImageUrls, uploadedImages]);

  const providerStatus = providerStatusQuery.data;

  useEffect(() => {
    if (!selectedListingKey && listingResults.length > 0) {
      setSelectedListingKey(listingResults[0].listingKey);
    }
  }, [listingResults, selectedListingKey]);

  useEffect(() => {
    if (providerStatus?.defaultProvider) {
      const defaultProvider = providerStatus.defaultProvider as StudioProvider;
      const defaultEnabled =
        defaultProvider === "local"
          ? true
          : Boolean(providerStatus.providers[defaultProvider]?.enabled);
      setProvider(defaultEnabled ? defaultProvider : "local");
    }
  }, [providerStatus]);

  useEffect(() => {
    return () => {
      if (downloadUrl.startsWith("blob:")) {
        URL.revokeObjectURL(downloadUrl);
      }
    };
  }, [downloadUrl]);

  const providerEnabled = useMemo(() => {
    if (provider === "local") return true;
    if (!providerStatus) return false;
    return Boolean(providerStatus.providers[provider]?.enabled);
  }, [provider, providerStatus]);

  const providerNote = (provider !== "local" && providerStatus?.providers?.[provider]?.note) || "";

  const startGenerateVideo = async () => {
    if (!selectedListing) {
      toast.error(t("studios.selectListing"));
      return;
    }
    if (imageUrls.length === 0) {
      toast.error(t("studios.noAvailableImages"));
      return;
    }

    const perImageSeconds = Number.parseFloat(secondsPerImage);
    if (!Number.isFinite(perImageSeconds) || perImageSeconds <= 0) {
      toast.error(t("studios.invalidDuration"));
      return;
    }

    setCloudTaskInfo("");
    setProgressPercent(0);
    setProgressText("");
    setRendering(true);

    try {
      if (provider === "local") {
        const { width, height } = resolveVideoDimensions(aspectRatio);
        const result = await renderSlideshowVideo({
          imageUrls,
          width,
          height,
          fps: 24,
          secondsPerImage: perImageSeconds,
          bitrateMbps: 8,
          onProgress: (progress) => {
            setProgressPercent(progress.percent);
            if (progress.phase === "loading") {
              setProgressText(
                t("studios.loadingImagesProgress", { loaded: String(progress.loadedImages), total: String(progress.totalImages) })
              );
            } else {
              setProgressText(
                t("studios.renderingFrames", { rendered: String(progress.renderedFrames), total: String(progress.totalFrames) })
              );
            }
          },
        });

        if (downloadUrl.startsWith("blob:")) {
          URL.revokeObjectURL(downloadUrl);
        }

        const objectUrl = URL.createObjectURL(result.blob);
        const fileName = `${selectedListing.listingKey}-${Date.now()}.${result.extension}`;
        setDownloadUrl(objectUrl);
        setDownloadFileName(fileName);
        setProgressPercent(100);
        setProgressText(t("studios.videoComplete", { count: String(result.imageCount) }));
        toast.success(t("studios.videoGenerated"));
        return;
      }

      if (!providerEnabled) {
        toast.error(t("studios.cloudNotConfigured"), {
          description: providerNote,
        });
        return;
      }

      const response = await createCloudVideoTaskMutation.mutateAsync({
        provider,
        title: displayAddress(selectedListing, t("studios.addressUnknown")),
        prompt: stylePrompt.trim() || undefined,
        imageUrls,
        aspectRatio,
        durationSecondsPerImage: perImageSeconds,
      });

      if (response.downloadUrl) {
        setCloudTaskInfo(t("studios.cloudComplete", { url: response.downloadUrl }));
        setDownloadUrl(response.downloadUrl);
        setDownloadFileName(
          `${selectedListing.listingKey}-${provider}-${Date.now()}.mp4`
        );
        setProgressPercent(100);
        setProgressText(t("studios.cloudTaskComplete"));
        toast.success(t("studios.cloudVideoGenerated"));
      } else {
        setProgressPercent(35);
        setProgressText(t("studios.cloudTaskCreated"));
        setCloudTaskInfo(
          t("studios.taskSubmitted", { provider: response.provider, jobId: response.jobId ?? "unknown" })
        );
        toast.success(t("studios.cloudTaskSuccess"));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : t("studios.videoFailed");
      toast.error(t("studios.videoFailed"), { description: message });
    } finally {
      setRendering(false);
    }
  };

  return (
    <div className="space-y-6 pb-8">
      <div className="rounded-3xl border border-primary/10 bg-gradient-to-br from-primary/5 via-primary/2 to-transparent p-6 text-foreground shadow-sm md:p-8">
        <div className="flex items-center gap-2 text-sm text-primary">
          <Clapperboard className="h-4 w-4" />
          {t("studios.eyebrow")}
        </div>
        <h1 className="mt-2 text-3xl font-serif tracking-tight md:text-4xl">
          {t("studios.heroTitle")}
        </h1>
        <p className="mt-3 max-w-3xl text-sm text-muted-foreground md:text-base">
          {t("studios.heroDescription")}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-4 w-4" />
              {t("studios.step1Title")}
            </CardTitle>
            <CardDescription>{t("studios.step1Description")}</CardDescription>
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("studios.searchPlaceholder")}
            />
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[420px] pr-3">
              <div className="space-y-2">
                {listingsQuery.isLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t("studios.loadingListings")}
                  </div>
                ) : listingResults.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("studios.noSearchResults")}</p>
                ) : (
                  listingResults.map((item) => {
                    const active = selectedListingKey === item.listingKey;
                    return (
                      <button
                        key={item.listingKey}
                        type="button"
                        onClick={() => setSelectedListingKey(item.listingKey)}
                        className={`w-full rounded-xl border p-3 text-left transition ${active
                          ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                          : "hover:bg-muted/40"
                          }`}
                      >
                        <div className="flex items-start gap-3">
                          {item.thumbnailUrl ? (
                            <img
                              src={item.thumbnailUrl}
                              alt={displayAddress(item, t("studios.addressUnknown"))}
                              className="h-16 w-24 rounded-md border object-cover"
                            />
                          ) : (
                            <div className="h-16 w-24 rounded-md border bg-muted/30" />
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">
                              {displayAddress(item, t("studios.addressUnknown"))}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {formatPrice(item.listPrice, t("studios.pricePending"))} · {item.listingKey}
                            </p>
                            <div className="mt-1.5 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                              {item.bedroomsTotal != null ? <span>{item.bedroomsTotal} bd</span> : null}
                              {item.bathroomsTotalInteger != null ? (
                                <span>{item.bathroomsTotalInteger} ba</span>
                              ) : null}
                              {item.livingArea ? (
                                <span>{Number(item.livingArea).toLocaleString()} sqft</span>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              {t("studios.step2Title")}
            </CardTitle>
            <CardDescription>{t("studios.step2Description")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{t("studios.videoModel")}</Label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {(["local", "sora", "jimeng"] as StudioProvider[]).map((item) => {
                  const enabled =
                    item === "local"
                      ? true
                      : Boolean(providerStatus?.providers?.[item]?.enabled);
                  const isActive = provider === item;
                  return (
                    <Button
                      key={item}
                      type="button"
                      variant={isActive ? "default" : "outline"}
                      className="justify-start"
                      onClick={() => setProvider(item)}
                    >
                      <Cloud className="h-4 w-4 mr-2" />
                      {item === "local" ? "Local" : item === "sora" ? "Sora" : "Jimeng"}
                      {!enabled ? <Badge className="ml-2" variant="secondary">{t("studios.notConfigured")}</Badge> : null}
                    </Button>
                  );
                })}
              </div>
              {providerNote ? (
                <p className="text-xs text-muted-foreground">{providerNote}</p>
              ) : null}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label>{t("studios.ratio")}</Label>
                <Input
                  value={aspectRatio}
                  onChange={(event) => {
                    const value = event.target.value as StudioAspectRatio;
                    if (value === "9:16" || value === "16:9" || value === "1:1") {
                      setAspectRatio(value);
                    }
                  }}
                  placeholder="9:16 / 16:9 / 1:1"
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t("studios.secondsPerImage")}</Label>
                <Input
                  value={secondsPerImage}
                  onChange={(event) => setSecondsPerImage(event.target.value)}
                  placeholder="2.5"
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t("studios.totalImages")}</Label>
                <Input value={String(imageUrls.length)} readOnly />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>{t("studios.stylePrompt")}</Label>
              <Textarea
                value={stylePrompt}
                onChange={(event) => setStylePrompt(event.target.value)}
                rows={4}
                placeholder={t("studios.stylePromptPlaceholder")}
              />
            </div>

            <Button
              type="button"
              onClick={startGenerateVideo}
              disabled={rendering || !selectedListingKey}
              className="w-full"
            >
              {rendering ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t("studios.generating")}
                </>
              ) : (
                <>
                  <Clapperboard className="h-4 w-4 mr-2" />
                  {t("studios.generateVideo")}
                </>
              )}
            </Button>

            <div className="space-y-2">
              <Progress value={progressPercent} />
              <p className="text-xs text-muted-foreground">
                {progressText || t("studios.ready")}
              </p>
            </div>

            {cloudTaskInfo ? (
              <div className="rounded-md border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">
                {cloudTaskInfo}
              </div>
            ) : null}

            {downloadUrl ? (
              <a
                className="inline-flex w-full items-center justify-center rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
                href={downloadUrl}
                download={downloadFileName || undefined}
                target={downloadUrl.startsWith("http") ? "_blank" : undefined}
                rel={downloadUrl.startsWith("http") ? "noreferrer" : undefined}
              >
                <Download className="h-4 w-4 mr-2" />
                {t("studios.downloadVideo")}
              </a>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {/* Upload Custom Images */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            {t("studios.uploadCustomImages")}
          </CardTitle>
          <CardDescription>
            {t("studios.uploadDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            className="relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-muted-foreground/25 bg-muted/20 p-8 transition hover:border-primary/40 hover:bg-primary/5 cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (e.dataTransfer.files.length > 0) handleFileUpload(e.dataTransfer.files);
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
                <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                <p className="text-sm text-muted-foreground">{t("studios.uploading")}</p>
              </>
            ) : (
              <>
                <Upload className="h-8 w-8 text-muted-foreground/60 mb-2" />
                <p className="text-sm font-medium">{t("studios.clickOrDragUpload")}</p>
                <p className="text-xs text-muted-foreground mt-1">{t("studios.uploadFormats")}</p>
              </>
            )}
          </div>

          {uploadedImages.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">{t("studios.uploaded", { count: String(uploadedImages.length) })}</p>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                {uploadedImages.map((img, index) => (
                  <div key={img.filename} className="relative overflow-hidden rounded-lg border bg-muted/20 group">
                    <img
                      src={img.url}
                      alt={`Upload ${index + 1}`}
                      className="h-28 w-full object-cover"
                      loading="lazy"
                    />
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); removeUploadedImage(index); }}
                      className="absolute top-1 right-1 rounded-full bg-black/60 p-0.5 text-white opacity-0 group-hover:opacity-100 transition"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="h-4 w-4" />
            {t("studios.galleryPreview")}
          </CardTitle>
          <CardDescription>
            {selectedListing ? t("studios.currentListing", { address: displayAddress(selectedListing, t("studios.addressUnknown")) }) : t("studios.noSelection")}
            {uploadedImages.length > 0 && t("studios.customImages", { count: String(uploadedImages.length) })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {listingDetailQuery.isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("studios.loadingImages")}
            </div>
          ) : imageUrls.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("studios.noImages")}</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {imageUrls.map((url, index) => (
                <div key={`${url}-${index}`} className="overflow-hidden rounded-lg border bg-muted/20">
                  <img
                    src={url}
                    alt={`MLS ${index + 1}`}
                    className="h-28 w-full object-cover"
                    loading="lazy"
                  />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
