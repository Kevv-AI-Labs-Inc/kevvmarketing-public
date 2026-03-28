"use client";

import { useEffect, useMemo, useState } from "react";
import { Mailbox, Send, Sparkles, Upload } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";

const sampleCsv = `first_name,last_name,address,city,state,zip,tags
Jamie,Lee,123 Main St,Los Angeles,CA,90001,just_listed|sphere
Morgan,Diaz,44 Elm Ave,Austin,TX,78701,open_house`;

export function PostcardsDashboard() {
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
  const [selectedContactIds, setSelectedContactIds] = useState<number[]>([]);
  const [sendStrategy, setSendStrategy] = useState<"send_now" | "scheduled">("send_now");
  const [scheduledAt, setScheduledAt] = useState("");
  const [copyPrompt, setCopyPrompt] = useState("seller valuation postcard for nearby homeowners");

  useEffect(() => {
    if (!workspaceQuery.data) return;
    if (!selectedTemplateId && workspaceQuery.data.templates[0]) {
      setSelectedTemplateId(workspaceQuery.data.templates[0].id);
    }
    if (selectedContactIds.length === 0) {
      setSelectedContactIds(
        workspaceQuery.data.contacts
          .filter((contact) => contact.addressVerified)
          .map((contact) => contact.id)
      );
    }
  }, [selectedContactIds.length, selectedTemplateId, workspaceQuery.data]);

  const verifiedContacts = useMemo(
    () => workspaceQuery.data?.contacts.filter((contact) => contact.addressVerified) ?? [],
    [workspaceQuery.data?.contacts]
  );

  const refresh = async () => {
    await utils.postcard.getWorkspace.invalidate();
  };

  const handleImport = async () => {
    try {
      const result = await importMutation.mutateAsync({ csvText });
      toast.success(`Imported ${result.importedRows} contacts`);
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Import failed.");
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
      toast.success("Manual contact saved.");
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
      toast.error(error instanceof Error ? error.message : "Failed to create contact.");
    }
  };

  const handleGenerateCopy = async () => {
    const activeTemplate = workspaceQuery.data?.templates.find(
      (template) => template.id === selectedTemplateId
    );

    if (!activeTemplate) {
      toast.error("Choose a template first.");
      return;
    }

    try {
      await copyMutation.mutateAsync({
        prompt: copyPrompt,
        templateName: activeTemplate.name,
        language: "en",
      });
      toast.success("Suggested postcard copy generated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Copy generation failed.");
    }
  };

  const handleCreateCampaign = async () => {
    if (!selectedTemplateId) {
      toast.error("Choose a template.");
      return;
    }

    try {
      await createCampaignMutation.mutateAsync({
        name: campaignName,
        templateId: selectedTemplateId,
        contactIds: selectedContactIds,
      });
      toast.success("Draft campaign created.");
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create campaign.");
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
      toast.success(sendStrategy === "scheduled" ? "Campaign scheduled." : "Campaign launched.");
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Launch failed.");
    }
  };

  if (workspaceQuery.isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="text-sm text-muted-foreground">Loading postcards workspace...</div>
      </div>
    );
  }

  return (
    <div className="space-y-8 px-6 py-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.32em] text-muted-foreground">
            Postcards
          </div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Direct mail activation</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Import addresses into the unified contact spine, choose a template, quote the send,
            and launch mock postcard fulfillment without leaving Kevv Marketing.
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
              <div className="text-sm text-muted-foreground">Total contacts</div>
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
              <div className="text-sm text-muted-foreground">Verified</div>
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
              <div className="text-sm text-muted-foreground">Deliverability</div>
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
              <CardTitle>Import contacts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                rows={10}
                value={csvText}
                onChange={(event) => setCsvText(event.target.value)}
              />
              <Button disabled={importMutation.isPending} onClick={() => void handleImport()}>
                {importMutation.isPending ? "Importing..." : "Import CSV contacts"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Manual contact</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <Input
                placeholder="Full name"
                value={manualContact.fullName}
                onChange={(event) =>
                  setManualContact((current) => ({ ...current, fullName: event.target.value }))
                }
              />
              <Input
                placeholder="Address line 1"
                value={manualContact.addressLine1}
                onChange={(event) =>
                  setManualContact((current) => ({ ...current, addressLine1: event.target.value }))
                }
              />
              <Input
                placeholder="Address line 2"
                value={manualContact.addressLine2}
                onChange={(event) =>
                  setManualContact((current) => ({ ...current, addressLine2: event.target.value }))
                }
              />
              <div className="grid gap-4 md:grid-cols-3">
                <Input
                  placeholder="City"
                  value={manualContact.city}
                  onChange={(event) =>
                    setManualContact((current) => ({ ...current, city: event.target.value }))
                  }
                />
                <Input
                  placeholder="State"
                  value={manualContact.state}
                  onChange={(event) =>
                    setManualContact((current) => ({ ...current, state: event.target.value.toUpperCase() }))
                  }
                />
                <Input
                  placeholder="ZIP"
                  value={manualContact.postalCode}
                  onChange={(event) =>
                    setManualContact((current) => ({ ...current, postalCode: event.target.value }))
                  }
                />
              </div>
              <Input
                placeholder="Tags (comma separated)"
                value={manualContact.tags}
                onChange={(event) =>
                  setManualContact((current) => ({ ...current, tags: event.target.value }))
                }
              />
              <Button disabled={manualMutation.isPending} onClick={() => void handleManualCreate()}>
                {manualMutation.isPending ? "Saving..." : "Save manual contact"}
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Template library + copy</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-3 md:grid-cols-2">
                {workspaceQuery.data?.templates.map((template) => (
                  <button
                    className={`rounded-2xl border p-4 text-left transition ${
                      selectedTemplateId === template.id
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
                  Suggested postcard copy
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
                  {copyMutation.isPending ? "Generating..." : "Generate postcard copy"}
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
              <CardTitle>Create and launch campaign</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                placeholder="Campaign name"
                value={campaignName}
                onChange={(event) => setCampaignName(event.target.value)}
              />
              <div className="max-h-[240px] space-y-3 overflow-y-auto rounded-2xl border p-4">
                {verifiedContacts.map((contact) => (
                  <label className="flex items-start gap-3" key={contact.id}>
                    <input
                      checked={selectedContactIds.includes(contact.id)}
                      onChange={() =>
                        setSelectedContactIds((current) =>
                          current.includes(contact.id)
                            ? current.filter((id) => id !== contact.id)
                            : [...current, contact.id]
                        )
                      }
                      type="checkbox"
                    />
                    <div>
                      <div className="font-medium">{contact.name || "Current Resident"}</div>
                      <div className="text-sm text-muted-foreground">
                        {contact.addressLine1}, {contact.city}, {contact.state} {contact.postalCode}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
              <div className="grid gap-4 md:grid-cols-[200px_1fr]">
                <label className="space-y-2 text-sm">
                  <span className="text-muted-foreground">Send mode</span>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs"
                    value={sendStrategy}
                    onChange={(event) =>
                      setSendStrategy(event.target.value as "send_now" | "scheduled")
                    }
                  >
                    <option value="send_now">Send now</option>
                    <option value="scheduled">Schedule</option>
                  </select>
                </label>
                <label className="space-y-2 text-sm">
                  <span className="text-muted-foreground">Scheduled time</span>
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
                {createCampaignMutation.isPending ? "Creating..." : "Create draft campaign"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Campaign board</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {workspaceQuery.data?.campaigns.length ? (
                workspaceQuery.data.campaigns.map((campaign) => (
                  <div className="rounded-2xl border p-4" key={campaign.id}>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-medium">{campaign.name}</div>
                        <div className="mt-1 text-sm text-muted-foreground">
                          {campaign.templateName} · {campaign.recipientCount} recipients
                        </div>
                      </div>
                      <Badge variant="secondary">{campaign.status}</Badge>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-4 text-sm text-muted-foreground">
                      <span>Total: ${(campaign.totalCents / 100).toFixed(2)}</span>
                      <span>Submitted: {campaign.submittedCount}</span>
                      <span>Delivered: {campaign.deliveredCount}</span>
                      <span>Failed: {campaign.failedCount}</span>
                    </div>
                    {campaign.status === "draft" || campaign.status === "failed" ? (
                      <Button
                        className="mt-4"
                        disabled={launchCampaignMutation.isPending}
                        onClick={() => void handleLaunchCampaign(campaign.id)}
                      >
                        {launchCampaignMutation.isPending ? "Queueing..." : sendStrategy === "scheduled" ? "Schedule campaign" : "Launch campaign"}
                      </Button>
                    ) : null}
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
                  No postcard campaigns yet.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
