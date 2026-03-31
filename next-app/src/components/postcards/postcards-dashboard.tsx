"use client";

import { useMemo, useState } from "react";
import { Mailbox, Send, Sparkles, Upload } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useT } from "@/i18n";
import { trpc } from "@/lib/trpc";

const sampleCsv = `first_name,last_name,address,city,state,zip,tags
Jamie,Lee,123 Main St,Los Angeles,CA,90001,just_listed|sphere
Morgan,Diaz,44 Elm Ave,Austin,TX,78701,open_house`;

export function PostcardsDashboard() {
  const { t } = useT();
  const workspaceQuery = trpc.postcard.getWorkspace.useQuery();
  const utils = trpc.useUtils();
  const importMutation = trpc.postcard.importCsv.useMutation();
  const manualMutation = trpc.postcard.createManualContact.useMutation();
  const copyMutation = trpc.postcard.generateCopy.useMutation();
  const createCampaignMutation = trpc.postcard.createCampaign.useMutation();
  const launchCampaignMutation = trpc.postcard.launchCampaign.useMutation();

  const [csvText, setCsvText] = useState(sampleCsv);
  const [manualContact, setManualContact] = useState({
    fullName: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    postalCode: "",
    tags: "",
  });
  const [campaignName, setCampaignName] = useState("Spring Seller Reactivation");
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [selectedContactIds, setSelectedContactIds] = useState<number[] | null>(null);
  const [sendStrategy, setSendStrategy] = useState<"send_now" | "scheduled">("send_now");
  const [scheduledAt, setScheduledAt] = useState("");
  const [copyPrompt, setCopyPrompt] = useState("seller valuation postcard for nearby homeowners");

  const verifiedContacts = useMemo(
    () => workspaceQuery.data?.contacts.filter((contact) => contact.addressVerified) ?? [],
    [workspaceQuery.data?.contacts]
  );
  const verifiedContactIds = useMemo(
    () => verifiedContacts.map((contact) => contact.id),
    [verifiedContacts]
  );
  const activeSelectedTemplateId = selectedTemplateId ?? workspaceQuery.data?.templates[0]?.id ?? null;
  const activeSelectedContactIds = selectedContactIds ?? verifiedContactIds;

  const refresh = async () => {
    await utils.postcard.getWorkspace.invalidate();
  };

  const handleImport = async () => {
    try {
      const result = await importMutation.mutateAsync({ csvText });
      toast.success(t("postcardsDashboard.importSuccess", { count: String(result.importedRows) }));
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("postcardsDashboard.importFailed"));
    }
  };

  const handleManualCreate = async () => {
    try {
      await manualMutation.mutateAsync({
        fullName: manualContact.fullName,
        addressLine1: manualContact.addressLine1,
        addressLine2: manualContact.addressLine2 || undefined,
        city: manualContact.city,
        state: manualContact.state,
        postalCode: manualContact.postalCode,
        tags: manualContact.tags
          .split(/[|,;]/)
          .map((item) => item.trim())
          .filter(Boolean),
      });
      toast.success(t("postcardsDashboard.manualSaved"));
      setManualContact({
        fullName: "",
        addressLine1: "",
        addressLine2: "",
        city: "",
        state: "",
        postalCode: "",
        tags: "",
      });
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("postcardsDashboard.manualFailed"));
    }
  };

  const handleGenerateCopy = async () => {
    const activeTemplate = workspaceQuery.data?.templates.find(
      (template) => template.id === activeSelectedTemplateId
    );

    if (!activeTemplate) {
      toast.error(t("postcardsDashboard.chooseTemplate"));
      return;
    }

    try {
      await copyMutation.mutateAsync({
        prompt: copyPrompt,
        templateName: activeTemplate.name,
        language: "en",
      });
      toast.success(t("postcardsDashboard.copyGenerated"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("postcardsDashboard.copyFailed"));
    }
  };

  const handleCreateCampaign = async () => {
    if (!activeSelectedTemplateId) {
      toast.error(t("postcardsDashboard.chooseTemplateShort"));
      return;
    }

    try {
      await createCampaignMutation.mutateAsync({
        name: campaignName,
        templateId: activeSelectedTemplateId,
        contactIds: activeSelectedContactIds,
      });
      toast.success(t("postcardsDashboard.draftCreated"));
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("postcardsDashboard.createFailed"));
    }
  };

  const handleLaunchCampaign = async (campaignId: number) => {
    try {
      await launchCampaignMutation.mutateAsync({
        campaignId,
        sendStrategy,
        scheduledAt:
          sendStrategy === "scheduled" && scheduledAt
            ? new Date(scheduledAt).toISOString()
            : undefined,
      });
      toast.success(sendStrategy === "scheduled" ? t("postcardsDashboard.campaignScheduled") : t("postcardsDashboard.campaignLaunched"));
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("postcardsDashboard.launchFailed"));
    }
  };

  if (workspaceQuery.isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="text-sm text-muted-foreground">{t("postcardsDashboard.loading")}</div>
      </div>
    );
  }

  return (
    <div className="space-y-8 px-6 py-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.32em] text-muted-foreground">
            {t("postcardsDashboard.eyebrow")}
          </div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">{t("postcardsDashboard.heroTitle")}</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            {t("postcardsDashboard.heroDescription")}
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-2xl bg-amber-100 p-3 text-amber-700">
              <Mailbox className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm text-muted-foreground">{t("postcardsDashboard.totalContacts")}</div>
              <div className="text-2xl font-semibold">{workspaceQuery.data?.stats.totalContacts ?? 0}</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-2xl bg-emerald-100 p-3 text-emerald-700">
              <Upload className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm text-muted-foreground">{t("postcardsDashboard.verified")}</div>
              <div className="text-2xl font-semibold">
                {workspaceQuery.data?.stats.verifiedContacts ?? 0}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-2xl bg-violet-100 p-3 text-violet-700">
              <Send className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm text-muted-foreground">{t("postcardsDashboard.deliverability")}</div>
              <div className="text-2xl font-semibold">
                {workspaceQuery.data?.stats.deliverabilityRate ?? 0}%
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-8 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t("postcardsDashboard.importContacts")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                rows={10}
                value={csvText}
                onChange={(event) => setCsvText(event.target.value)}
              />
              <Button disabled={importMutation.isPending} onClick={() => void handleImport()}>
                {importMutation.isPending ? t("postcardsDashboard.importing") : t("postcardsDashboard.importCsv")}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("postcardsDashboard.manualContact")}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <Input
                placeholder={t("postcardsDashboard.fullName")}
                value={manualContact.fullName}
                onChange={(event) =>
                  setManualContact((current) => ({ ...current, fullName: event.target.value }))
                }
              />
              <Input
                placeholder={t("postcardsDashboard.addressLine1")}
                value={manualContact.addressLine1}
                onChange={(event) =>
                  setManualContact((current) => ({ ...current, addressLine1: event.target.value }))
                }
              />
              <Input
                placeholder={t("postcardsDashboard.addressLine2")}
                value={manualContact.addressLine2}
                onChange={(event) =>
                  setManualContact((current) => ({ ...current, addressLine2: event.target.value }))
                }
              />
              <div className="grid gap-4 md:grid-cols-3">
                <Input
                  placeholder={t("postcardsDashboard.city")}
                  value={manualContact.city}
                  onChange={(event) =>
                    setManualContact((current) => ({ ...current, city: event.target.value }))
                  }
                />
                <Input
                  placeholder={t("postcardsDashboard.state")}
                  value={manualContact.state}
                  onChange={(event) =>
                    setManualContact((current) => ({ ...current, state: event.target.value.toUpperCase() }))
                  }
                />
                <Input
                  placeholder={t("postcardsDashboard.zip")}
                  value={manualContact.postalCode}
                  onChange={(event) =>
                    setManualContact((current) => ({ ...current, postalCode: event.target.value }))
                  }
                />
              </div>
              <Input
                placeholder={t("postcardsDashboard.tags")}
                value={manualContact.tags}
                onChange={(event) =>
                  setManualContact((current) => ({ ...current, tags: event.target.value }))
                }
              />
              <Button disabled={manualMutation.isPending} onClick={() => void handleManualCreate()}>
                {manualMutation.isPending ? t("postcardsDashboard.saving") : t("postcardsDashboard.saveManual")}
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t("postcardsDashboard.templateLibrary")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-3 md:grid-cols-2">
                {workspaceQuery.data?.templates.map((template) => (
                  <button
                    className={`rounded-2xl border p-4 text-left transition ${
                      activeSelectedTemplateId === template.id
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-border bg-background hover:border-slate-500"
                    }`}
                    key={template.id}
                    onClick={() => setSelectedTemplateId(template.id)}
                    type="button"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-medium">{template.name}</div>
                      <Badge variant="secondary">{template.sizeCode}</Badge>
                    </div>
                    <div className="mt-2 text-sm opacity-75">{template.note}</div>
                  </button>
                ))}
              </div>

              <div className="rounded-2xl border bg-muted/20 p-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Sparkles className="h-4 w-4" />
                  {t("postcardsDashboard.suggestedCopy")}
                </div>
                <Textarea
                  className="mt-3"
                  placeholder="seller valuation postcard for nearby homeowners"
                  rows={3}
                  value={copyPrompt}
                  onChange={(event) => setCopyPrompt(event.target.value)}
                />
                <Button
                  className="mt-3"
                  disabled={copyMutation.isPending}
                  onClick={() => void handleGenerateCopy()}
                >
                  {copyMutation.isPending ? t("postcardsDashboard.generating") : t("postcardsDashboard.generateCopy")}
                </Button>
                {copyMutation.data ? (
                  <div className="mt-4 rounded-2xl bg-background p-4 text-sm">
                    <div className="font-medium">{copyMutation.data.headline}</div>
                    <div className="mt-2 text-muted-foreground">{copyMutation.data.body}</div>
                    <div className="mt-3 font-medium text-slate-900">{copyMutation.data.callout}</div>
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("postcardsDashboard.createLaunch")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                placeholder={t("postcardsDashboard.campaignName")}
                value={campaignName}
                onChange={(event) => setCampaignName(event.target.value)}
              />
              <div className="max-h-[240px] space-y-3 overflow-y-auto rounded-2xl border p-4">
                {verifiedContacts.map((contact) => (
                  <label className="flex items-start gap-3" key={contact.id}>
                    <input
                      checked={activeSelectedContactIds.includes(contact.id)}
                      onChange={() =>
                        setSelectedContactIds((current) =>
                          (current ?? verifiedContactIds).includes(contact.id)
                            ? (current ?? verifiedContactIds).filter((id) => id !== contact.id)
                            : [...(current ?? verifiedContactIds), contact.id]
                        )
                      }
                      type="checkbox"
                    />
                    <div>
                      <div className="font-medium">{contact.name || t("postcardsDashboard.currentResident")}</div>
                      <div className="text-sm text-muted-foreground">
                        {contact.addressLine1}, {contact.city}, {contact.state} {contact.postalCode}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
              <div className="grid gap-4 md:grid-cols-[200px_1fr]">
                <label className="space-y-2 text-sm">
                  <span className="text-muted-foreground">{t("postcardsDashboard.sendMode")}</span>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs"
                    value={sendStrategy}
                    onChange={(event) =>
                      setSendStrategy(event.target.value as "send_now" | "scheduled")
                    }
                  >
                    <option value="send_now">{t("postcardsDashboard.sendNow")}</option>
                    <option value="scheduled">{t("postcardsDashboard.schedule")}</option>
                  </select>
                </label>
                <label className="space-y-2 text-sm">
                  <span className="text-muted-foreground">{t("postcardsDashboard.scheduledTime")}</span>
                  <Input
                    disabled={sendStrategy !== "scheduled"}
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={(event) => setScheduledAt(event.target.value)}
                  />
                </label>
              </div>
              <Button
                disabled={createCampaignMutation.isPending}
                onClick={() => void handleCreateCampaign()}
              >
                {createCampaignMutation.isPending ? t("postcardsDashboard.creating") : t("postcardsDashboard.createDraft")}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("postcardsDashboard.campaignBoard")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {workspaceQuery.data?.campaigns.length ? (
                workspaceQuery.data.campaigns.map((campaign) => (
                  <div className="rounded-2xl border p-4" key={campaign.id}>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-medium">{campaign.name}</div>
                        <div className="mt-1 text-sm text-muted-foreground">
                          {campaign.templateName} · {campaign.recipientCount} {t("postcardsDashboard.recipients")}
                        </div>
                      </div>
                      <Badge variant="secondary">{campaign.status}</Badge>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-4 text-sm text-muted-foreground">
                      <span>{t("postcardsDashboard.total")}: ${(campaign.totalCents / 100).toFixed(2)}</span>
                      <span>{t("postcardsDashboard.submitted")}: {campaign.submittedCount}</span>
                      <span>{t("postcardsDashboard.delivered")}: {campaign.deliveredCount}</span>
                      <span>{t("postcardsDashboard.failed")}: {campaign.failedCount}</span>
                    </div>
                    {campaign.status === "draft" || campaign.status === "failed" ? (
                      <Button
                        className="mt-4"
                        disabled={launchCampaignMutation.isPending}
                        onClick={() => void handleLaunchCampaign(campaign.id)}
                      >
                        {launchCampaignMutation.isPending ? t("postcardsDashboard.queueing") : sendStrategy === "scheduled" ? t("postcardsDashboard.scheduleCampaign") : t("postcardsDashboard.launchCampaign")}
                      </Button>
                    ) : null}
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
                  {t("postcardsDashboard.noCampaigns")}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
