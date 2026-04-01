"use client";

import { useState } from "react";
import { Inbox, Mailbox, Sparkles, Workflow } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { useT } from "@/i18n";

// ─── Status helpers ───────────────────────────────────────────────────────────

const STATUS_OPTIONS = [
  "new",
  "contacted",
  "qualified",
  "converted",
  "lost",
  "archived",
] as const;
type ContactStatus = (typeof STATUS_OPTIONS)[number];

const STATUS_COLORS: Record<ContactStatus, string> = {
  new: "bg-blue-500/10 text-blue-600 border-blue-200",
  contacted: "bg-amber-500/10 text-amber-600 border-amber-200",
  qualified: "bg-emerald-500/10 text-emerald-600 border-emerald-200",
  converted: "bg-violet-500/10 text-violet-600 border-violet-200",
  lost: "bg-rose-500/10 text-rose-500 border-rose-200",
  archived: "bg-neutral-500/10 text-neutral-500 border-neutral-200",
};

const SCORE_COLORS: Record<string, string> = {
  hot: "bg-rose-500/10 text-rose-600",
  warm: "bg-amber-500/10 text-amber-600",
  cold: "bg-sky-500/10 text-sky-600",
};

// ─── Component ────────────────────────────────────────────────────────────────

export function LeadsDashboard() {
  const { t } = useT();
  const utils = trpc.useUtils();
  const [query, setQuery] = useState("");
  const [source, setSource] = useState("");
  const [status, setStatus] = useState("");
  const [selectedLeadIds, setSelectedLeadIds] = useState<number[]>([]);
  const [campaignName, setCampaignName] = useState("");
  const [templateId, setTemplateId] = useState<number | null>(null);
  const [dripCampaignId, setDripCampaignId] = useState<number | null>(null);

  const dashboardQuery = trpc.leads.dashboard.useQuery({
    query: query || undefined,
    source: source || undefined,
    status: (status || undefined) as ContactStatus | undefined,
  });
  const updateStatusMutation = trpc.leads.updateStatus.useMutation();
  const createPostcardDraftMutation =
    trpc.leads.createPostcardDraftFromContacts.useMutation();
  const enrollInDripMutation = trpc.leads.enrollInDrip.useMutation();

  const leads = dashboardQuery.data?.leads ?? [];
  const postcardTemplates = dashboardQuery.data?.postcardTemplates ?? [];
  const dripOptions = dashboardQuery.data?.dripOptions ?? [];
  const activeTemplateId = templateId ?? postcardTemplates[0]?.id ?? null;
  const activeDripCampaignId = dripCampaignId ?? dripOptions[0]?.id ?? null;

  const refresh = async () => {
    await utils.leads.dashboard.invalidate();
    await utils.leads.list.invalidate();
  };

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleStatusUpdate = async (
    contactId: number,
    nextStatus: ContactStatus
  ) => {
    try {
      await updateStatusMutation.mutateAsync({
        contactId,
        status: nextStatus,
      });
      toast.success(t("leadsDashboard.statusUpdated"));
      await refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("leadsDashboard.statusUpdateFailed")
      );
    }
  };

  const handleCreatePostcardDraft = async () => {
    if (!activeTemplateId || selectedLeadIds.length === 0) {
      toast.error(t("leadsDashboard.selectLeadsAndTemplate"));
      return;
    }

    try {
      await createPostcardDraftMutation.mutateAsync({
        name: campaignName || "Follow-up Campaign",
        templateId: activeTemplateId,
        contactIds: selectedLeadIds,
      });
      toast.success(t("leadsDashboard.postcardDraftCreated"));
      await refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("leadsDashboard.postcardDraftFailed")
      );
    }
  };

  const handleEnrollInDrip = async () => {
    if (!activeDripCampaignId || selectedLeadIds.length === 0) {
      toast.error(t("leadsDashboard.selectLeadsAndDrip"));
      return;
    }

    try {
      const result = await enrollInDripMutation.mutateAsync({
        campaignId: activeDripCampaignId,
        contactIds: selectedLeadIds,
      });
      toast.success(
        t("leadsDashboard.enrolled").replace(
          "{count}",
          String(result.enrolled)
        )
      );
      await refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("leadsDashboard.enrollFailed")
      );
    }
  };

  // ── Loading state ───────────────────────────────────────────────────────────

  if (dashboardQuery.isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="text-sm text-muted-foreground">
          {t("leadsDashboard.loading")}
        </div>
      </div>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8 px-6 py-8">
      {/* Hero header */}
      <div>
        <div className="text-xs uppercase tracking-[0.32em] text-muted-foreground">
          {t("leadsDashboard.eyebrow")}
        </div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          {t("leadsDashboard.title")}
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          {t("leadsDashboard.description")}
        </p>
      </div>

      {/* Source breakdown cards */}
      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        {dashboardQuery.data?.sourceBreakdown.map((item) => (
          <Card key={item.source}>
            <CardContent className="p-5">
              <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                {item.source}
              </div>
              <div className="mt-3 text-2xl font-semibold">{item.count}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main two-column layout */}
      <div className="grid gap-8 xl:grid-cols-[1.08fr_0.92fr]">
        {/* Left: Filters + lead inbox */}
        <div className="space-y-6">
          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle>{t("leadsDashboard.filters")}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <Input
                placeholder={t("leadsDashboard.searchPlaceholder")}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs"
                value={source}
                onChange={(event) => setSource(event.target.value)}
              >
                <option value="">{t("leadsDashboard.allSources")}</option>
                {dashboardQuery.data?.sourceBreakdown.map((item) => (
                  <option key={item.source} value={item.source}>
                    {item.source}
                  </option>
                ))}
              </select>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs"
                value={status}
                onChange={(event) => setStatus(event.target.value)}
              >
                <option value="">{t("leadsDashboard.allStatuses")}</option>
                {STATUS_OPTIONS.map((item) => (
                  <option key={item} value={item}>
                    {t(`leadsDashboard.status.${item}`)}
                  </option>
                ))}
              </select>
            </CardContent>
          </Card>

          {/* Lead inbox */}
          <Card>
            <CardHeader>
              <CardTitle>{t("leadsDashboard.inbox")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {leads.length ? (
                leads.map((lead) => (
                  <div
                    className="rounded-2xl border p-4 transition-colors hover:bg-muted/20"
                    key={lead.id}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <label className="flex items-start gap-3">
                        <input
                          checked={selectedLeadIds.includes(lead.id)}
                          onChange={() =>
                            setSelectedLeadIds((current) =>
                              current.includes(lead.id)
                                ? current.filter((id) => id !== lead.id)
                                : [...current, lead.id]
                            )
                          }
                          type="checkbox"
                          className="mt-1 accent-primary"
                        />
                        <div>
                          <div className="font-medium">
                            {lead.name || t("leadsDashboard.unnamedLead")}
                          </div>
                          <div className="mt-1 text-sm text-muted-foreground">
                            {lead.email ||
                              lead.phone ||
                              t("leadsDashboard.noContact")}
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2 text-xs">
                            <Badge variant="secondary">{lead.source}</Badge>
                            <Badge
                              variant="outline"
                              className={
                                STATUS_COLORS[lead.status as ContactStatus] ??
                                ""
                              }
                            >
                              {t(
                                `leadsDashboard.status.${lead.status}` as Parameters<typeof t>[0]
                              )}
                            </Badge>
                            {lead.score && (
                              <Badge
                                variant="outline"
                                className={SCORE_COLORS[lead.score] ?? ""}
                              >
                                {t("leadsDashboard.score")}:{" "}
                                {lead.score}
                              </Badge>
                            )}
                            {lead.intent && (
                              <span className="text-muted-foreground">
                                {t("leadsDashboard.intent")}: {lead.intent}
                              </span>
                            )}
                            {lead.engagementScore > 0 && (
                              <span className="text-muted-foreground">
                                {t("leadsDashboard.engagement")}:{" "}
                                {lead.engagementScore}
                              </span>
                            )}
                          </div>
                        </div>
                      </label>
                      <select
                        className="flex h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs"
                        value={lead.status}
                        onChange={(event) =>
                          void handleStatusUpdate(
                            lead.id,
                            event.target.value as ContactStatus
                          )
                        }
                      >
                        {STATUS_OPTIONS.map((item) => (
                          <option key={item} value={item}>
                            {t(`leadsDashboard.status.${item}`)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
                  {t("leadsDashboard.noLeads")}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: Action panels */}
        <div className="space-y-6">
          {/* Postcard */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mailbox className="h-4 w-4" />
                {t("leadsDashboard.postcardTitle")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                placeholder={t("leadsDashboard.campaignNamePlaceholder")}
                value={campaignName}
                onChange={(event) => setCampaignName(event.target.value)}
              />
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs"
                value={activeTemplateId ?? ""}
                onChange={(event) =>
                  setTemplateId(
                    event.target.value ? Number(event.target.value) : null
                  )
                }
              >
                {postcardTemplates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name} · {template.sizeCode}
                  </option>
                ))}
              </select>
              <Button
                disabled={createPostcardDraftMutation.isPending}
                onClick={() => void handleCreatePostcardDraft()}
              >
                {createPostcardDraftMutation.isPending
                  ? t("leadsDashboard.creating")
                  : t("leadsDashboard.createDraft")}
              </Button>
            </CardContent>
          </Card>

          {/* Drip */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Workflow className="h-4 w-4" />
                {t("leadsDashboard.dripTitle")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs"
                value={activeDripCampaignId ?? ""}
                onChange={(event) =>
                  setDripCampaignId(
                    event.target.value ? Number(event.target.value) : null
                  )
                }
              >
                {dripOptions.map((campaign) => (
                  <option key={campaign.id} value={campaign.id}>
                    {campaign.name} · {campaign.status}
                  </option>
                ))}
              </select>
              <Button
                disabled={enrollInDripMutation.isPending}
                onClick={() => void handleEnrollInDrip()}
              >
                {enrollInDripMutation.isPending
                  ? t("leadsDashboard.enrolling")
                  : t("leadsDashboard.enrollDrip")}
              </Button>
            </CardContent>
          </Card>

          {/* AI Insights */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                {t("leadsDashboard.insightsTitle")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {dashboardQuery.data?.recentInsights.length ? (
                dashboardQuery.data.recentInsights.map((insight) => (
                  <div className="rounded-2xl border p-4" key={insight.id}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-medium">{insight.title}</div>
                      <Badge variant="secondary">{insight.priority}</Badge>
                    </div>
                    <div className="mt-2 text-sm text-muted-foreground">
                      {insight.description}
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
                  {t("leadsDashboard.noInsights")}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Workspace note */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Inbox className="h-4 w-4" />
                {t("leadsDashboard.workspaceNote")}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm leading-7 text-muted-foreground">
              {t("leadsDashboard.workspaceNoteContent")}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
