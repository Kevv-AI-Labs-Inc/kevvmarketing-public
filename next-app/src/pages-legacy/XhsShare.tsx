"use client";

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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useT } from "@/i18n";
import {
  BookImage,
  Check,
  ClipboardCopy,
  Download,
  ExternalLink,
  ImageIcon,
  Loader2,
  Sparkles,
} from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";

// ─── Xiaohongshu share icon (simplified) ─────────────────
function XhsIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z" />
      <path d="M8.5 8.5h7v7h-7z" opacity={0.3} />
      <text
        x="12"
        y="14"
        textAnchor="middle"
        fontSize="7"
        fontWeight="bold"
        fill="currentColor"
      >
        小
      </text>
    </svg>
  );
}

interface XhsResult {
  title: string;
  body: string;
  hashtags: string[];
  photoTips: string[];
}

export default function XhsSharePage() {
  const { user } = useAuth();
  const { t } = useT();
  const [copied, setCopied] = useState(false);

  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [price, setPrice] = useState("");
  const [propertyType, setPropertyType] = useState("");
  const [beds, setBeds] = useState("");
  const [baths, setBaths] = useState("");
  const [sqft, setSqft] = useState("");
  const [highlights, setHighlights] = useState("");
  const [customPrompt, setCustomPrompt] = useState("");

  const [result, setResult] = useState<XhsResult | null>(null);

  const generateMutation = trpc.content.xhsGenerate.useMutation({
    onSuccess: (data) => {
      setResult(data);
      toast.success(t("xhsShare.success"));
    },
    onError: (err) => toast.error(t("xhsShare.failed"), { description: err.message }),
  });

  const handleGenerate = () => {
    generateMutation.mutate({
      agentName: user?.name ?? "Agent",
      address: address.trim() || undefined,
      city: city.trim() || undefined,
      price: price.trim() || undefined,
      propertyType: propertyType.trim() || undefined,
      beds: beds ? Number(beds) : undefined,
      baths: baths ? Number(baths) : undefined,
      sqft: sqft ? Number(sqft) : undefined,
      highlights: highlights.trim() || undefined,
      customPrompt: customPrompt.trim() || undefined,
    });
  };

  const copyAll = useCallback(async () => {
    if (!result) return;
    const fullText = [
      result.title,
      "",
      result.body,
      "",
      result.hashtags.join(" "),
    ].join("\n");

    try {
      await navigator.clipboard.writeText(fullText);
      setCopied(true);
      toast.success(t("xhsShare.clipboardSuccess"), {
        description: t("xhsShare.clipboardDescription"),
      });
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error(t("xhsShare.clipboardFailed"));
    }
  }, [result, t]);

  const openXhs = useCallback(() => {
    const deepLink = "xhsdiscover://";
    const webUrl = "https://www.xiaohongshu.com/explore";

    if (/iPhone|iPad|Android/i.test(navigator.userAgent)) {
      window.location.href = deepLink;
      setTimeout(() => {
        window.open(webUrl, "_blank");
      }, 1500);
    } else {
      window.open("https://creator.xiaohongshu.com/publish/publish", "_blank");
    }
  }, []);

  return (
    <div className="space-y-6 pb-8">
      {/* Hero */}
      <div className="rounded-3xl border border-red-500/10 bg-gradient-to-br from-red-500/5 via-red-500/2 to-transparent p-6 text-foreground shadow-sm md:p-8">
        <div className="flex items-center gap-2 text-sm text-red-500">
          <BookImage className="h-4 w-4" />
          {t("xhsShare.eyebrow")}
        </div>
        <h1 className="mt-2 text-3xl font-serif tracking-tight md:text-4xl">
          {t("xhsShare.heroTitle")}
        </h1>
        <p className="mt-3 max-w-3xl text-sm text-muted-foreground md:text-base">
          {t("xhsShare.heroDescription")}
        </p>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left: Input form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Sparkles className="h-4 w-4 text-primary" />
              {t("xhsShare.propertyInfo")}
            </CardTitle>
            <CardDescription>
              {t("xhsShare.propertyInfoDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>{t("xhsShare.address")}</Label>
                <Input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="123 Main St"
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t("xhsShare.city")}</Label>
                <Input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Irvine, CA"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="space-y-1.5">
                <Label>{t("xhsShare.price")}</Label>
                <Input
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="1250000"
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t("xhsShare.type")}</Label>
                <Input
                  value={propertyType}
                  onChange={(e) => setPropertyType(e.target.value)}
                  placeholder="Single Family"
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t("xhsShare.bedrooms")}</Label>
                <Input
                  type="number"
                  value={beds}
                  onChange={(e) => setBeds(e.target.value)}
                  placeholder="4"
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t("xhsShare.bathrooms")}</Label>
                <Input
                  type="number"
                  value={baths}
                  onChange={(e) => setBaths(e.target.value)}
                  placeholder="3"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>{t("xhsShare.area")}</Label>
                <Input
                  type="number"
                  value={sqft}
                  onChange={(e) => setSqft(e.target.value)}
                  placeholder="2500"
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t("xhsShare.highlights")}</Label>
                <Input
                  value={highlights}
                  onChange={(e) => setHighlights(e.target.value)}
                  placeholder={t("xhsShare.highlightsPlaceholder")}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>{t("xhsShare.customPrompt")}</Label>
              <Textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                rows={2}
                placeholder={t("xhsShare.customPromptPlaceholder")}
              />
            </div>

            <Button
              onClick={handleGenerate}
              disabled={generateMutation.isPending}
              className="w-full gap-2 bg-red-500 hover:bg-red-600 text-white"
              size="lg"
            >
              {generateMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {generateMutation.isPending ? t("xhsShare.generating") : t("xhsShare.generate")}
            </Button>
          </CardContent>
        </Card>

        {/* Right: Preview + Actions */}
        <Card
          className={`transition-opacity ${result ? "opacity-100" : "opacity-50"}`}
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <XhsIcon className="h-5 w-5 text-red-500" />
              {t("xhsShare.preview")}
            </CardTitle>
            <CardDescription>
              {result
                ? t("xhsShare.previewReady")
                : t("xhsShare.previewEmpty")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {result ? (
              <div className="space-y-4">
                <ScrollArea className="max-h-[400px]">
                  <div className="rounded-xl border bg-white dark:bg-zinc-950 p-5 space-y-3">
                    <h2 className="text-lg font-bold leading-snug">
                      {result.title}
                    </h2>

                    <div className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/80">
                      {result.body}
                    </div>

                    {result.hashtags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-2 border-t">
                        {result.hashtags.map((tag) => (
                          <Badge
                            key={tag}
                            variant="secondary"
                            className="text-xs text-red-500 bg-red-500/10 border-red-500/20"
                          >
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}

                    {result.photoTips.length > 0 && (
                      <div className="border-t pt-3">
                        <p className="text-[11px] font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
                          <ImageIcon className="h-3 w-3" />
                          {t("xhsShare.recommendedPhotos")}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {result.photoTips.map((tip) => (
                            <Badge
                              key={tip}
                              variant="outline"
                              className="text-[11px]"
                            >
                              📷 {tip}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </ScrollArea>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <Button
                    onClick={copyAll}
                    variant="default"
                    className="gap-2"
                    size="lg"
                  >
                    {copied ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <ClipboardCopy className="h-4 w-4" />
                    )}
                    {copied ? t("xhsShare.copied") : t("xhsShare.copyAll")}
                  </Button>
                  <Button
                    onClick={openXhs}
                    variant="outline"
                    className="gap-2 border-red-500/30 text-red-500 hover:bg-red-500/10"
                    size="lg"
                  >
                    <ExternalLink className="h-4 w-4" />
                    {t("xhsShare.openXhs")}
                  </Button>
                </div>

                <p className="text-[11px] text-center text-muted-foreground">
                  {t("xhsShare.workflow")}
                </p>
              </div>
            ) : (
              <div className="text-center py-16 text-muted-foreground">
                <BookImage className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <p className="text-sm">{t("xhsShare.emptyPrompt")}</p>
                <p className="text-xs mt-1 opacity-60">
                  {t("xhsShare.emptyDescription")}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
