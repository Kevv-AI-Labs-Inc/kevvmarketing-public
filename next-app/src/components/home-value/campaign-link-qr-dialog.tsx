"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useT } from "@/i18n";
import { Download, Loader2, QrCode } from "lucide-react";

export function CampaignLinkQrDialog({
  url,
  label,
}: {
  url: string;
  label: string;
}) {
  const { t } = useT();
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function generateQr() {
    if (qrDataUrl) return;
    setLoading(true);
    try {
      const { generateQRDataUrl } = await import("@/lib/qrcode");
      const dataUrl = await generateQRDataUrl(url, { width: 512 });
      setQrDataUrl(dataUrl);
    } catch {
      // QR generation failed silently
    } finally {
      setLoading(false);
    }
  }

  function handleDownload() {
    if (!qrDataUrl) return;
    const a = document.createElement("a");
    a.href = qrDataUrl;
    a.download = `qr-${label.replace(/[^a-zA-Z0-9]/g, "-")}.png`;
    a.click();
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={generateQr}
          title={t("homeValueDashboard.campaignLinks.showQr")}
        >
          <QrCode className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-4 w-4" />
            {t("homeValueDashboard.campaignLinks.qrTitle")}
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-4">
          {loading ? (
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          ) : qrDataUrl ? (
            <>
              <img
                src={qrDataUrl}
                alt={`QR code for ${label}`}
                className="w-64 h-64 rounded-lg border"
              />
              <p className="text-xs text-muted-foreground text-center max-w-[250px] truncate">
                {url}
              </p>
              <Button onClick={handleDownload} variant="outline" size="sm">
                <Download className="h-4 w-4 mr-1" />
                {t("homeValueDashboard.campaignLinks.downloadQr")}
              </Button>
            </>
          ) : (
            <div className="text-sm text-muted-foreground">
              {t("homeValueDashboard.campaignLinks.qrGenerating")}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
