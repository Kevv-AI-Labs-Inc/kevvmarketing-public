// legacy page — incrementally migrated
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
import { useT } from "@/i18n";
import type { MessageKey } from "@/i18n";
import {
  Check,
  ClipboardCopy,
  ExternalLink,
  Eye,
  Image,
  Link2,
  MessageCircle,
  QrCode,
  ScanLine,
  Settings2,
  Share2,
  Users,
} from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";

/* ─── WeChat icon ────────────────────────────────────────────── */

function WeChatIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 0 1 .213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 0 0 .167-.054l1.903-1.114a.864.864 0 0 1 .717-.098 10.16 10.16 0 0 0 2.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-2.187 6.112-2.187.202 0 .397.013.592.025C16.84 4.07 13.073 2.188 8.691 2.188zm-2.6 4.408c.58 0 1.049.47 1.049 1.049 0 .58-.47 1.049-1.049 1.049a1.049 1.049 0 1 1 0-2.098zm5.143 0c.58 0 1.049.47 1.049 1.049 0 .58-.47 1.049-1.049 1.049a1.049 1.049 0 1 1 0-2.098zM16.547 8.7c-4.234 0-7.453 2.837-7.453 6.402 0 3.796 3.601 6.403 7.453 6.403a9.15 9.15 0 0 0 2.396-.319.724.724 0 0 1 .588.082l1.558.912a.27.27 0 0 0 .137.044c.131 0 .238-.107.238-.238 0-.059-.024-.117-.039-.174l-.32-1.211a.484.484 0 0 1 .174-.544C23.08 18.907 24 17.19 24 15.1c0-3.565-3.219-6.4-7.453-6.4zm-2.197 3.563c.474 0 .858.385.858.858a.858.858 0 1 1-.858-.858zm4.394 0c.474 0 .858.385.858.858a.858.858 0 1 1-.858-.858z" />
    </svg>
  );
}

/* ─── Types ───────────────────────────────────────────────────── */

type ShareLink = {
  id: string;
  title: string;
  url: string;
  createdAt: string;
  views: number;
  uniqueVisitors: number;
};

/* ─── Component ──────────────────────────────────────────────── */

export default function WechatShare() {
  const { t, locale } = useT();

  // Share card config
  const [shareTitle, setShareTitle] = useState("");
  const [shareDesc, setShareDesc] = useState("");
  const [shareUrl, setShareUrl] = useState("");

  // Mock data
  const [recentLinks] = useState<ShareLink[]>([
    {
      id: "1",
      title: locale === "zh" ? "法拉盛 2BR 精装公寓" : "Flushing 2BR Luxury Condo",
      url: "https://share.kevv.co/s/abc123",
      createdAt: "2026-03-28",
      views: 47,
      uniqueVisitors: 23,
    },
    {
      id: "2",
      title: locale === "zh" ? "尔湾学区房 · 新上市" : "Irvine School District · Just Listed",
      url: "https://share.kevv.co/s/def456",
      createdAt: "2026-03-25",
      views: 132,
      uniqueVisitors: 61,
    },
    {
      id: "3",
      title: locale === "zh" ? "曼哈顿下城 Studio" : "Downtown Manhattan Studio",
      url: "https://share.kevv.co/s/ghi789",
      createdAt: "2026-03-20",
      views: 89,
      uniqueVisitors: 42,
    },
  ]);

  const copyLink = useCallback((url: string) => {
    navigator.clipboard.writeText(url);
    toast.success(t("wechatShare.linkCopied"));
  }, [t]);

  const isConfigured = false; // WeChat OA not configured yet

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-serif tracking-tight flex items-center gap-2">
          <WeChatIcon className="h-6 w-6 text-emerald-600" />
          {t("wechatShare.title")}
        </h1>
        <p className="text-muted-foreground mt-1">
          {t("wechatShare.subtitle")}
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* ─── Share Card Settings ─── */}
        <div className="xl:col-span-1 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Settings2 className="h-4 w-4" />
                {t("wechatShare.cardSettingsTitle")}
              </CardTitle>
              <CardDescription>{t("wechatShare.cardSettingsDescription")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground">{t("wechatShare.shareTitle")}</label>
                <Input
                  placeholder={t("wechatShare.shareTitlePlaceholder")}
                  value={shareTitle}
                  onChange={(e) => setShareTitle(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">{t("wechatShare.shareDesc")}</label>
                <Input
                  placeholder={t("wechatShare.shareDescPlaceholder")}
                  value={shareDesc}
                  onChange={(e) => setShareDesc(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">{t("wechatShare.shareUrl")}</label>
                <Input
                  placeholder="https://..."
                  value={shareUrl}
                  onChange={(e) => setShareUrl(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">{t("wechatShare.thumbnail")}</label>
                <div className="mt-1 flex h-20 items-center justify-center rounded-lg border-2 border-dashed border-border hover:border-primary/30 transition-colors cursor-pointer">
                  <div className="text-center">
                    <Image className="h-5 w-5 mx-auto text-muted-foreground" />
                    <p className="text-xs text-muted-foreground mt-1">{t("wechatShare.uploadThumbnail")}</p>
                  </div>
                </div>
              </div>
              <Button className="w-full" disabled={!shareTitle.trim()}>
                <Share2 className="h-4 w-4 mr-2" />
                {t("wechatShare.generateLink")}
              </Button>
            </CardContent>
          </Card>

          {/* JSSDK Status */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <QrCode className="h-4 w-4" />
                {t("wechatShare.jssdkTitle")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`rounded-xl border p-4 ${isConfigured ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
                <div className="flex items-center gap-2">
                  {isConfigured ? (
                    <Check className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <ScanLine className="h-4 w-4 text-amber-600" />
                  )}
                  <span className={`text-sm font-medium ${isConfigured ? "text-emerald-700" : "text-amber-700"}`}>
                    {isConfigured ? t("wechatShare.configured") : t("wechatShare.notConfigured")}
                  </span>
                </div>
                <p className="text-xs mt-2 opacity-70">
                  {isConfigured ? t("wechatShare.configuredDesc") : t("wechatShare.notConfiguredDesc")}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* How it works */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t("wechatShare.howItWorksTitle")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {(["step1", "step2", "step3"] as const).map((step, idx) => (
                  <div key={step} className="flex items-start gap-3">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700">
                      {idx + 1}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{t(`wechatShare.howItWorks.${step}.title` as MessageKey)}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{t(`wechatShare.howItWorks.${step}.desc` as MessageKey)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ─── Preview + Tracking ─── */}
        <div className="xl:col-span-2 space-y-4">
          {/* WeChat Card Preview */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <MessageCircle className="h-4 w-4" />
                {t("wechatShare.previewTitle")}
              </CardTitle>
              <CardDescription>{t("wechatShare.previewDescription")}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mx-auto max-w-sm">
                {/* Mock WeChat chat bubble */}
                <div className="rounded-2xl bg-[#EBEBEB] p-4 dark:bg-zinc-800">
                  <div className="rounded-xl bg-white p-3 shadow-sm dark:bg-zinc-700">
                    <div className="flex gap-3">
                      <div className="h-12 w-12 shrink-0 rounded-lg bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center">
                        <Image className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-zinc-900 dark:text-zinc-100 truncate">
                          {shareTitle || (locale === "zh" ? "分享标题" : "Share Title")}
                        </p>
                        <p className="text-xs text-zinc-500 mt-0.5 line-clamp-2">
                          {shareDesc || (locale === "zh" ? "分享描述内容" : "Share description content")}
                        </p>
                      </div>
                    </div>
                    <div className="mt-2 pt-2 border-t border-zinc-100 dark:border-zinc-600 flex items-center gap-1 text-[10px] text-zinc-400">
                      <WeChatIcon className="h-3 w-3" />
                      <span>kevv.co</span>
                    </div>
                  </div>
                </div>
                <p className="text-center text-xs text-muted-foreground mt-3">
                  {t("wechatShare.previewNote")}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Recent Shared Links + Tracking */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Eye className="h-4 w-4" />
                {t("wechatShare.trackingTitle")}
              </CardTitle>
              <CardDescription>{t("wechatShare.trackingDescription")}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentLinks.map((link) => (
                  <div key={link.id} className="rounded-xl border p-4 hover:border-emerald-300 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{link.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                          <Link2 className="h-3 w-3" />
                          {link.url}
                        </p>
                      </div>
                      <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8" onClick={() => copyLink(link.url)}>
                        <ClipboardCopy className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div className="mt-3 flex items-center gap-4 text-xs">
                      <div className="flex items-center gap-1.5">
                        <Eye className="h-3 w-3 text-muted-foreground" />
                        <span className="font-medium">{link.views}</span>
                        <span className="text-muted-foreground">{t("wechatShare.views")}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Users className="h-3 w-3 text-muted-foreground" />
                        <span className="font-medium">{link.uniqueVisitors}</span>
                        <span className="text-muted-foreground">{t("wechatShare.uniqueVisitors")}</span>
                      </div>
                      <span className="text-muted-foreground ml-auto">{link.createdAt}</span>
                    </div>

                    {/* Mock visitor avatars */}
                    <div className="mt-3 pt-3 border-t">
                      <p className="text-xs text-muted-foreground mb-2">{t("wechatShare.recentVisitors")}</p>
                      <div className="flex items-center -space-x-2">
                        {Array.from({ length: Math.min(link.uniqueVisitors, 6) }).map((_, i) => (
                          <div
                            key={i}
                            className="h-7 w-7 rounded-full border-2 border-background flex items-center justify-center text-[10px] font-medium"
                            style={{
                              backgroundColor: `hsl(${(i * 60 + 200) % 360}, 50%, 90%)`,
                              color: `hsl(${(i * 60 + 200) % 360}, 50%, 35%)`,
                            }}
                          >
                            {String.fromCharCode(65 + i)}
                          </div>
                        ))}
                        {link.uniqueVisitors > 6 && (
                          <div className="h-7 w-7 rounded-full border-2 border-background bg-muted flex items-center justify-center text-[10px] font-medium text-muted-foreground">
                            +{link.uniqueVisitors - 6}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
