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
  const [copied, setCopied] = useState(false);

  // Form
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [price, setPrice] = useState("");
  const [propertyType, setPropertyType] = useState("");
  const [beds, setBeds] = useState("");
  const [baths, setBaths] = useState("");
  const [sqft, setSqft] = useState("");
  const [highlights, setHighlights] = useState("");
  const [customPrompt, setCustomPrompt] = useState("");

  // Result
  const [result, setResult] = useState<XhsResult | null>(null);

  const generateMutation = trpc.content.xhsGenerate.useMutation({
    onSuccess: (data) => {
      setResult(data);
      toast.success("小红书笔记已生成");
    },
    onError: (err) => toast.error("生成失败", { description: err.message }),
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
      toast.success("已复制到剪贴板", {
        description: "打开小红书后粘贴即可",
      });
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error("复制失败，请手动复制");
    }
  }, [result]);

  const openXhs = useCallback(() => {
    // Try deep link first (mobile), fallback to web
    const deepLink = "xhsdiscover://";
    const webUrl = "https://www.xiaohongshu.com/explore";

    // On mobile, try deep link
    if (/iPhone|iPad|Android/i.test(navigator.userAgent)) {
      window.location.href = deepLink;
      // Fallback after delay
      setTimeout(() => {
        window.open(webUrl, "_blank");
      }, 1500);
    } else {
      // Desktop: open creator platform
      window.open("https://creator.xiaohongshu.com/publish/publish", "_blank");
    }
  }, []);

  return (
    <div className="space-y-6 pb-8">
      {/* Hero */}
      <div className="rounded-3xl border border-red-500/10 bg-gradient-to-br from-red-500/5 via-red-500/2 to-transparent p-6 text-foreground shadow-sm md:p-8">
        <div className="flex items-center gap-2 text-sm text-red-500">
          <BookImage className="h-4 w-4" />
          小红书内容工厂
        </div>
        <h1 className="mt-2 text-3xl font-serif tracking-tight md:text-4xl">
          一键生成小红书笔记
        </h1>
        <p className="mt-3 max-w-3xl text-sm text-muted-foreground md:text-base">
          输入房源信息，AI
          自动生成符合小红书格式的图文笔记。一键复制文案、下载配图，直接发布到小红书。
        </p>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left: Input form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Sparkles className="h-4 w-4 text-primary" />
              房源信息
            </CardTitle>
            <CardDescription>
              填入房源数据，AI 将生成小红书风格的营销笔记
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>地址</Label>
                <Input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="123 Main St"
                />
              </div>
              <div className="space-y-1.5">
                <Label>城市</Label>
                <Input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Irvine, CA"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="space-y-1.5">
                <Label>价格</Label>
                <Input
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="1250000"
                />
              </div>
              <div className="space-y-1.5">
                <Label>类型</Label>
                <Input
                  value={propertyType}
                  onChange={(e) => setPropertyType(e.target.value)}
                  placeholder="Single Family"
                />
              </div>
              <div className="space-y-1.5">
                <Label>卧室</Label>
                <Input
                  type="number"
                  value={beds}
                  onChange={(e) => setBeds(e.target.value)}
                  placeholder="4"
                />
              </div>
              <div className="space-y-1.5">
                <Label>浴室</Label>
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
                <Label>面积 (sqft)</Label>
                <Input
                  type="number"
                  value={sqft}
                  onChange={(e) => setSqft(e.target.value)}
                  placeholder="2500"
                />
              </div>
              <div className="space-y-1.5">
                <Label>房屋亮点</Label>
                <Input
                  value={highlights}
                  onChange={(e) => setHighlights(e.target.value)}
                  placeholder="近好学区、泳池、全新装修"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>补充要求（可选）</Label>
              <Textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                rows={2}
                placeholder="例如：强调投资回报率、适合首次购房"
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
              {generateMutation.isPending ? "AI 生成中..." : "生成小红书笔记"}
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
              笔记预览
            </CardTitle>
            <CardDescription>
              {result
                ? "预览生成的小红书笔记内容"
                : "输入房源信息后点击生成"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {result ? (
              <div className="space-y-4">
                {/* Preview area */}
                <ScrollArea className="max-h-[400px]">
                  <div className="rounded-xl border bg-white dark:bg-zinc-950 p-5 space-y-3">
                    {/* Title */}
                    <h2 className="text-lg font-bold leading-snug">
                      {result.title}
                    </h2>

                    {/* Body */}
                    <div className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/80">
                      {result.body}
                    </div>

                    {/* Hashtags */}
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

                    {/* Photo tips */}
                    {result.photoTips.length > 0 && (
                      <div className="border-t pt-3">
                        <p className="text-[11px] font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
                          <ImageIcon className="h-3 w-3" />
                          推荐配图
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

                {/* Action buttons */}
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
                    {copied ? "已复制 ✓" : "一键复制全文"}
                  </Button>
                  <Button
                    onClick={openXhs}
                    variant="outline"
                    className="gap-2 border-red-500/30 text-red-500 hover:bg-red-500/10"
                    size="lg"
                  >
                    <ExternalLink className="h-4 w-4" />
                    打开小红书发布
                  </Button>
                </div>

                <p className="text-[11px] text-center text-muted-foreground">
                  复制文案 → 打开小红书 → 从相册选图 → 粘贴文案 → 发布
                </p>
              </div>
            ) : (
              <div className="text-center py-16 text-muted-foreground">
                <BookImage className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <p className="text-sm">填入房源信息后点击生成</p>
                <p className="text-xs mt-1 opacity-60">
                  AI 将自动生成标题、正文、话题标签和选图建议
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
