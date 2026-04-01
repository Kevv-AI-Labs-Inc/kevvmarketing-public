"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { useT } from "@/i18n";
import {
  Archive,
  Code,
  Copy,
  Eye,
  FileText,
  Link2,
  Loader2,
  Mailbox,
  Plus,
  QrCode,
  Share2,
  Target,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { CampaignLinkQrDialog } from "./campaign-link-qr-dialog";
import { CampaignLinkEmbedDialog } from "./campaign-link-embed-dialog";

type LinkSource = "postcard" | "social" | "embed" | "article" | "direct";

const sourceConfig: Record<LinkSource, { icon: React.ElementType; color: string }> = {
  postcard: { icon: Mailbox, color: "bg-amber-100 text-amber-800" },
  social: { icon: Share2, color: "bg-blue-100 text-blue-800" },
  embed: { icon: Code, color: "bg-violet-100 text-violet-800" },
  article: { icon: FileText, color: "bg-emerald-100 text-emerald-800" },
  direct: { icon: Link2, color: "bg-stone-100 text-stone-700" },
};

export function CampaignLinksSection() {
  const { t } = useT();
  const utils = trpc.useUtils();
  const [showCreate, setShowCreate] = useState(false);

  const linksQuery = trpc.homeValue.listCampaignLinks.useQuery();

  const createMutation = trpc.homeValue.createCampaignLink.useMutation({
    onSuccess: () => {
      utils.homeValue.listCampaignLinks.invalidate();
      setShowCreate(false);
      toast.success(t("homeValueDashboard.campaignLinks.linkCreated"));
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = trpc.homeValue.updateCampaignLink.useMutation({
    onSuccess: () => {
      utils.homeValue.listCampaignLinks.invalidate();
      toast.success(t("homeValueDashboard.campaignLinks.linkUpdated"));
    },
  });

  function handleCopyUrl(url: string) {
    navigator.clipboard.writeText(url);
    toast.success(t("homeValueDashboard.campaignLinks.urlCopied"));
  }

  const links = linksQuery.data ?? [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Link2 className="h-5 w-5" />
          {t("homeValueDashboard.campaignLinks.sectionTitle")}
        </CardTitle>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1" />
              {t("homeValueDashboard.campaignLinks.createLink")}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("homeValueDashboard.campaignLinks.createLink")}</DialogTitle>
            </DialogHeader>
            <CreateLinkForm
              onSubmit={(data) => createMutation.mutate(data)}
              isLoading={createMutation.isPending}
            />
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {links.length === 0 ? (
          <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            <QrCode className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p>{t("homeValueDashboard.campaignLinks.noLinksYet")}</p>
            <p className="mt-1 text-xs">{t("homeValueDashboard.campaignLinks.createFirstLink")}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {links.map((link) => {
              const src = sourceConfig[link.source as LinkSource] ?? sourceConfig.direct;
              const Icon = src.icon;
              return (
                <div
                  key={link.id}
                  className="flex items-center justify-between gap-3 rounded-xl border p-4"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <Badge variant="outline" className={`gap-1 text-xs shrink-0 ${src.color}`}>
                      <Icon className="h-3 w-3" />
                      {t(`homeValueDashboard.campaignLinks.source${link.source.charAt(0).toUpperCase() + link.source.slice(1)}` as Parameters<typeof t>[0])}
                    </Badge>
                    <span className="font-medium text-sm truncate">{link.label}</span>
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground shrink-0">
                    <span className="flex items-center gap-1">
                      <Eye className="h-3 w-3" /> {link.viewCount}
                    </span>
                    <span className="flex items-center gap-1">
                      <Target className="h-3 w-3" /> {link.valuationCount}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" /> {link.leadCount}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleCopyUrl(link.url)}
                      title={t("homeValueDashboard.campaignLinks.copyUrl")}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    <CampaignLinkQrDialog url={link.url} label={link.label ?? ""} />
                    <CampaignLinkEmbedDialog
                      directUrl={link.directUrl ?? link.url}
                      label={link.label ?? ""}
                    />
                    {link.status === "active" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() =>
                          updateMutation.mutate({ id: link.id, status: "archived" })
                        }
                        title={t("homeValueDashboard.campaignLinks.archiveLink")}
                      >
                        <Archive className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Create Link Form ─────────────────────────────────────

function CreateLinkForm({
  onSubmit,
  isLoading,
}: {
  onSubmit: (data: {
    label: string;
    source: LinkSource;
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
    ogTitle?: string;
    ogDescription?: string;
  }) => void;
  isLoading: boolean;
}) {
  const { t } = useT();
  const [label, setLabel] = useState("");
  const [source, setSource] = useState<LinkSource>("direct");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [utmSource, setUtmSource] = useState("");
  const [utmMedium, setUtmMedium] = useState("");
  const [utmCampaign, setUtmCampaign] = useState("");
  const [ogTitle, setOgTitle] = useState("");
  const [ogDescription, setOgDescription] = useState("");

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label className="text-sm font-medium">{t("homeValueDashboard.campaignLinks.labelField")}</label>
        <Input
          placeholder={t("homeValueDashboard.campaignLinks.labelPlaceholder")}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="mt-1"
        />
      </div>

      <div>
        <label className="text-sm font-medium">{t("homeValueDashboard.campaignLinks.sourceLabel")}</label>
        <Select value={source} onValueChange={(v) => setSource(v as LinkSource)}>
          <SelectTrigger className="mt-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="postcard">{t("homeValueDashboard.campaignLinks.sourcePostcard")}</SelectItem>
            <SelectItem value="social">{t("homeValueDashboard.campaignLinks.sourceSocial")}</SelectItem>
            <SelectItem value="embed">{t("homeValueDashboard.campaignLinks.sourceEmbed")}</SelectItem>
            <SelectItem value="article">{t("homeValueDashboard.campaignLinks.sourceArticle")}</SelectItem>
            <SelectItem value="direct">{t("homeValueDashboard.campaignLinks.sourceDirect")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <button
        type="button"
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="text-xs text-muted-foreground hover:text-foreground text-left"
      >
        {showAdvanced ? "- " : "+ "}{t("homeValueDashboard.campaignLinks.advancedOptions")}
      </button>

      {showAdvanced && (
        <div className="flex flex-col gap-3 rounded-lg border p-3 bg-muted/30">
          <div className="grid grid-cols-3 gap-2">
            <Input placeholder="utm_source" value={utmSource} onChange={(e) => setUtmSource(e.target.value)} className="text-xs" />
            <Input placeholder="utm_medium" value={utmMedium} onChange={(e) => setUtmMedium(e.target.value)} className="text-xs" />
            <Input placeholder="utm_campaign" value={utmCampaign} onChange={(e) => setUtmCampaign(e.target.value)} className="text-xs" />
          </div>
          <Input
            placeholder={t("homeValueDashboard.campaignLinks.ogTitlePlaceholder")}
            value={ogTitle}
            onChange={(e) => setOgTitle(e.target.value)}
            className="text-xs"
          />
          <Input
            placeholder={t("homeValueDashboard.campaignLinks.ogDescriptionPlaceholder")}
            value={ogDescription}
            onChange={(e) => setOgDescription(e.target.value)}
            className="text-xs"
          />
        </div>
      )}

      <Button
        onClick={() =>
          onSubmit({
            label,
            source,
            ...(utmSource ? { utmSource } : {}),
            ...(utmMedium ? { utmMedium } : {}),
            ...(utmCampaign ? { utmCampaign } : {}),
            ...(ogTitle ? { ogTitle } : {}),
            ...(ogDescription ? { ogDescription } : {}),
          })
        }
        disabled={!label.trim() || isLoading}
      >
        {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
        {t("homeValueDashboard.campaignLinks.createLink")}
      </Button>
    </div>
  );
}
