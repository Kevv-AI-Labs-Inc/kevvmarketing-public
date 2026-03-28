"use client";

import { useState } from "react";
import { Inbox, Mailbox, Sparkles, Workflow } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";

export function LeadsDashboard() {
  const utils = trpc.useUtils();
  const [query, setQuery] = useState("");
  const [source, setSource] = useState("");
  const [status, setStatus] = useState("");
  const [selectedLeadIds, setSelectedLeadIds] = useState<number[]>([]);
  const [campaignName, setCampaignName] = useState("High Intent Seller Follow-up");
  const [templateId, setTemplateId] = useState<number | null>(null);
  const [dripCampaignId, setDripCampaignId] = useState<number | null>(null);

  const dashboardQuery = trpc.leads.dashboard.useQuery({
    query: query || undefined,
    source: source || undefined,
    status: (status || undefined) as
      | "new"
      | "contacted"
      | "qualified"
      | "converted"
      | "lost"
      | "archived"
      | undefined,
  });
  const updateStatusMutation = trpc.leads.updateStatus.useMutation();
  const createPostcardDraftMutation = trpc.leads.createPostcardDraftFromContacts.useMutation();
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

  const handleStatusUpdate = async (contactId: number, nextStatus: "new" | "contacted" | "qualified" | "converted" | "lost" | "archived") => {
    try {
      await updateStatusMutation.mutateAsync({
        contactId,
        status: nextStatus,
      });
      toast.success("Lead status updated.");
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Status update failed.");
    }
  };

  const handleCreatePostcardDraft = async () => {
    if (!activeTemplateId || selectedLeadIds.length === 0) {
      toast.error("Select leads and a postcard template.");
      return;
    }

    try {
      await createPostcardDraftMutation.mutateAsync({
        name: campaignName,
        templateId: activeTemplateId,
        contactIds: selectedLeadIds,
      });
      toast.success("Postcard draft campaign created.");
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create postcard draft.");
    }
  };

  const handleEnrollInDrip = async () => {
    if (!activeDripCampaignId || selectedLeadIds.length === 0) {
      toast.error("Select leads and a drip campaign.");
      return;
    }

    try {
      const result = await enrollInDripMutation.mutateAsync({
        campaignId: activeDripCampaignId,
        contactIds: selectedLeadIds,
      });
      toast.success(`Enrolled ${result.enrolled} lead(s) into drip.`);
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to enroll leads.");
    }
  };

  if (dashboardQuery.isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="text-sm text-muted-foreground">Loading leads workspace...</div>
      </div>
    );
  }

  return (
    <div className="space-y-8 px-6 py-8">
      <div>
        <div className="text-xs uppercase tracking-[0.32em] text-muted-foreground">
          Leads
        </div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Unified leads and automation</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Agent site chat and forms, Home Value, Area Magnet, and postcard imports all land in the
          same contact spine. Use this page to qualify, route, and activate leads.
        </p>
      </div>

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

      <div className="grid gap-8 xl:grid-cols-[1.08fr_0.92fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Lead filters</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <Input
                placeholder="Search leads"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs"
                value={source}
                onChange={(event) => setSource(event.target.value)}
              >
                <option value="">All sources</option>
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
                <option value="">All statuses</option>
                {["new", "contacted", "qualified", "converted", "lost", "archived"].map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Lead inbox</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {leads.length ? (
                leads.map((lead) => (
                  <div className="rounded-2xl border p-4" key={lead.id}>
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
                        />
                        <div>
                          <div className="font-medium">{lead.name || "Unnamed lead"}</div>
                          <div className="mt-1 text-sm text-muted-foreground">
                            {lead.email || lead.phone || "No direct contact method"}
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                            <Badge variant="secondary">{lead.source}</Badge>
                            <Badge variant="secondary">{lead.status}</Badge>
                            <span>intent: {lead.intent || "n/a"}</span>
                            <span>score: {lead.score}</span>
                            <span>engagement: {lead.engagementScore}</span>
                          </div>
                        </div>
                      </label>
                      <select
                        className="flex h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs"
                        value={lead.status}
                        onChange={(event) =>
                          void handleStatusUpdate(
                            lead.id,
                            event.target.value as
                              | "new"
                              | "contacted"
                              | "qualified"
                              | "converted"
                              | "lost"
                              | "archived"
                          )
                        }
                      >
                        {["new", "contacted", "qualified", "converted", "lost", "archived"].map((item) => (
                          <option key={item} value={item}>
                            {item}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
                  No leads match the current filters.
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mailbox className="h-4 w-4" />
                Lead to postcard
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                placeholder="Campaign name"
                value={campaignName}
                onChange={(event) => setCampaignName(event.target.value)}
              />
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs"
                value={activeTemplateId ?? ""}
                onChange={(event) =>
                  setTemplateId(event.target.value ? Number(event.target.value) : null)
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
                {createPostcardDraftMutation.isPending ? "Creating..." : "Create postcard draft"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Workflow className="h-4 w-4" />
                Lead to drip
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs"
                value={activeDripCampaignId ?? ""}
                onChange={(event) =>
                  setDripCampaignId(event.target.value ? Number(event.target.value) : null)
                }
              >
                {dripOptions.map((campaign) => (
                  <option key={campaign.id} value={campaign.id}>
                    {campaign.name} · {campaign.status}
                  </option>
                ))}
              </select>
              <Button disabled={enrollInDripMutation.isPending} onClick={() => void handleEnrollInDrip()}>
                {enrollInDripMutation.isPending ? "Enrolling..." : "Enroll selected leads"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                Recent insights
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
                  No insights yet.
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Inbox className="h-4 w-4" />
                Workspace note
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm leading-7 text-muted-foreground">
              This workspace now treats `agent_site_chat`, `agent_site_form`, `home_value`,
              `area_magnet`, and `postcard_import` as one operating surface. Qualification,
              activation, and automation all start from the same contact record.
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
