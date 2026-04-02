"use client";

import { useMemo, useState } from "react";
import {
  Calendar,
  ChevronDown,
  ChevronUp,
  Clock,
  FileText,
  Globe,
  Loader2,
  Mail,
  Mailbox,
  MapPin,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  Target,
  Upload,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AddressAutocomplete } from "@/components/ui/address-autocomplete";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useT } from "@/i18n";
import { trpc } from "@/lib/trpc";

/* ────────────────────────────────────────────────────────────── */
/*  Tabs                                                          */
/* ────────────────────────────────────────────────────────────── */

type TabId = "campaigns" | "audience" | "automations";

const TABS: { id: TabId; icon: React.ReactNode }[] = [
  { id: "campaigns", icon: <Mail className="h-4 w-4" /> },
  { id: "audience", icon: <Target className="h-4 w-4" /> },
  { id: "automations", icon: <Zap className="h-4 w-4" /> },
];

const sampleCsv = `first_name,last_name,address,city,state,zip,tags
Jamie,Lee,123 Main St,Los Angeles,CA,90001,just_listed|sphere
Morgan,Diaz,44 Elm Ave,Austin,TX,78701,open_house`;

/* ────────────────────────────────────────────────────────────── */
/*  Main Dashboard                                                */
/* ────────────────────────────────────────────────────────────── */

export function PostcardsDashboard() {
  const { t } = useT();
  const workspaceQuery = trpc.postcard.getWorkspace.useQuery();
  const utils = trpc.useUtils();
  const importMutation = trpc.postcard.importCsv.useMutation();
  const manualMutation = trpc.postcard.createManualContact.useMutation();
  const copyMutation = trpc.postcard.generateCopy.useMutation();
  const createCampaignMutation = trpc.postcard.createCampaign.useMutation();
  const launchCampaignMutation = trpc.postcard.launchCampaign.useMutation();
  const scanZipcodeMutation = trpc.postcard.scanZipcode.useMutation();
  const createAutomationMutation = trpc.postcard.createAutomation.useMutation();
  const updateAutomationMutation = trpc.postcard.updateAutomationStatus.useMutation();

  const [activeTab, setActiveTab] = useState<TabId>("campaigns");

  // ─── Campaign state ────────────────────────────────
  const [csvText, setCsvText] = useState(sampleCsv);
  const [manualContact, setManualContact] = useState({
    fullName: "", addressLine1: "", addressLine2: "", city: "", state: "", postalCode: "", tags: "",
  });
  const [campaignName, setCampaignName] = useState("Spring Seller Reactivation");
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [selectedContactIds, setSelectedContactIds] = useState<number[] | null>(null);
  const [sendStrategy, setSendStrategy] = useState<"send_now" | "scheduled">("send_now");
  const [scheduledAt, setScheduledAt] = useState("");
  const [copyPrompt, setCopyPrompt] = useState("seller valuation postcard for nearby homeowners");
  const [showImport, setShowImport] = useState(false);
  const [showManual, setShowManual] = useState(false);

  // ─── Audience state ────────────────────────────────
  const [zipInput, setZipInput] = useState("");
  const [audienceName, setAudienceName] = useState("");
  const [audienceStatus, setAudienceStatus] = useState("Sold");
  const [audienceMinPrice, setAudienceMinPrice] = useState("");
  const [audienceMaxPrice, setAudienceMaxPrice] = useState("");

  // ─── Automation state ──────────────────────────────
  const [autoName, setAutoName] = useState("Closed Deal Lifecycle");
  const [autoTrigger, setAutoTrigger] = useState<"closed_deal_milestone" | "listing_event" | "recurring_schedule">("closed_deal_milestone");

  const verifiedContacts = useMemo(
    () => workspaceQuery.data?.contacts.filter((c) => c.addressVerified) ?? [],
    [workspaceQuery.data?.contacts]
  );
  const verifiedContactIds = useMemo(
    () => verifiedContacts.map((c) => c.id),
    [verifiedContacts]
  );
  const activeSelectedTemplateId = selectedTemplateId ?? workspaceQuery.data?.templates[0]?.id ?? null;
  const activeSelectedContactIds = selectedContactIds ?? verifiedContactIds;

  const refresh = async () => { await utils.postcard.getWorkspace.invalidate(); };

  // ─── Handlers ──────────────────────────────────────

  const handleImport = async () => {
    try {
      const result = await importMutation.mutateAsync({ csvText });
      toast.success((t as any)("postcardsDashboard.importSuccess", { count: String(result.importedRows) }));
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : (t as any)("postcardsDashboard.importFailed"));
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
        tags: manualContact.tags.split(/[|,;]/).map((s) => s.trim()).filter(Boolean),
      });
      toast.success((t as any)("postcardsDashboard.manualSaved"));
      setManualContact({ fullName: "", addressLine1: "", addressLine2: "", city: "", state: "", postalCode: "", tags: "" });
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : (t as any)("postcardsDashboard.manualFailed"));
    }
  };

  const handleGenerateCopy = async () => {
    const activeTemplate = workspaceQuery.data?.templates.find((t) => t.id === activeSelectedTemplateId);
    if (!activeTemplate) { toast.error((t as any)("postcardsDashboard.chooseTemplate")); return; }
    try {
      await copyMutation.mutateAsync({ prompt: copyPrompt, templateName: activeTemplate.name, language: "en" });
      toast.success((t as any)("postcardsDashboard.copyGenerated"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : (t as any)("postcardsDashboard.copyFailed"));
    }
  };

  const handleCreateCampaign = async () => {
    if (!activeSelectedTemplateId) { toast.error((t as any)("postcardsDashboard.chooseTemplateShort")); return; }
    try {
      await createCampaignMutation.mutateAsync({
        name: campaignName,
        templateId: activeSelectedTemplateId,
        contactIds: activeSelectedContactIds,
      });
      toast.success((t as any)("postcardsDashboard.draftCreated"));
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : (t as any)("postcardsDashboard.createFailed"));
    }
  };

  const handleLaunchCampaign = async (campaignId: number) => {
    try {
      await launchCampaignMutation.mutateAsync({
        campaignId,
        sendStrategy,
        scheduledAt: sendStrategy === "scheduled" && scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
      });
      toast.success(sendStrategy === "scheduled" ? (t as any)("postcardsDashboard.campaignScheduled") : (t as any)("postcardsDashboard.campaignLaunched"));
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : (t as any)("postcardsDashboard.launchFailed"));
    }
  };

  const handleScanZipcode = async () => {
    const zips = zipInput.split(/[,;\s]+/).map((s) => s.trim()).filter((s) => /^\d{5}$/.test(s));
    if (zips.length === 0) { toast.error("Enter at least one valid 5-digit ZIP code."); return; }
    try {
      const result = await scanZipcodeMutation.mutateAsync({
        name: audienceName.trim() || `ZIP ${zips.join(", ")} — ${audienceStatus}`,
        zipCodes: zips,
        listingStatus: audienceStatus || undefined,
        minPrice: audienceMinPrice ? Number(audienceMinPrice) : undefined,
        maxPrice: audienceMaxPrice ? Number(audienceMaxPrice) : undefined,
      });
      toast.success(`Found ${result.totalFound} properties, imported ${result.imported} new contacts (${result.duplicatesSkipped} duplicates skipped).`);
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Zipcode scan failed.");
    }
  };

  const handleCreateAutomation = async () => {
    try {
      await createAutomationMutation.mutateAsync({
        name: autoName.trim() || "Untitled Automation",
        triggerType: autoTrigger,
      });
      toast.success("Automation created successfully.");
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create automation.");
    }
  };

  const handleToggleAutomation = async (automationId: number, currentStatus: string) => {
    const newStatus = currentStatus === "active" ? "paused" : "active";
    try {
      await updateAutomationMutation.mutateAsync({ automationId, status: newStatus as "active" | "paused" });
      toast.success(`Automation ${newStatus === "active" ? "resumed" : "paused"}.`);
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update automation.");
    }
  };

  if (workspaceQuery.isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {(t as any)("postcardsDashboard.loading")}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      {/* ─── Hero ──────────────────────────────────── */}
      <div className="rounded-3xl border border-primary/10 bg-gradient-to-br from-amber-50/80 via-orange-50/40 to-transparent p-6 text-foreground shadow-sm md:p-8">
        <div className="flex items-center gap-2 text-sm text-amber-700">
          <Mailbox className="h-4 w-4" />
          Direct Mail
        </div>
        <h1 className="mt-2 text-3xl font-serif tracking-tight md:text-4xl">
          Direct Mail Command Center
        </h1>
        <p className="mt-3 max-w-3xl text-sm text-muted-foreground md:text-base">
          Send postcards & letters via Lob API. Target homeowners by zipcode from MLS data, automate lifecycle drips for closed deals, and send personalized CMA letters.
        </p>
      </div>

      {/* ─── Stats ──────────────────────────────────── */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="rounded-2xl bg-amber-100 p-3 text-amber-700"><Mailbox className="h-5 w-5" /></div>
            <div>
              <div className="text-xs text-muted-foreground">Total Contacts</div>
              <div className="text-2xl font-semibold">{workspaceQuery.data?.stats.totalContacts ?? 0}</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="rounded-2xl bg-emerald-100 p-3 text-emerald-700"><Upload className="h-5 w-5" /></div>
            <div>
              <div className="text-xs text-muted-foreground">Verified</div>
              <div className="text-2xl font-semibold">{workspaceQuery.data?.stats.verifiedContacts ?? 0}</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="rounded-2xl bg-violet-100 p-3 text-violet-700"><Send className="h-5 w-5" /></div>
            <div>
              <div className="text-xs text-muted-foreground">Deliverability</div>
              <div className="text-2xl font-semibold">{workspaceQuery.data?.stats.deliverabilityRate ?? 0}%</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="rounded-2xl bg-blue-100 p-3 text-blue-700"><Zap className="h-5 w-5" /></div>
            <div>
              <div className="text-xs text-muted-foreground">Active Automations</div>
              <div className="text-2xl font-semibold">
                {workspaceQuery.data?.automations.filter((a) => a.status === "active").length ?? 0}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ─── Tab Bar ────────────────────────────────── */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {TABS.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all whitespace-nowrap ${
                active
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {tab.icon}
              {tab.id === "campaigns" ? "Campaigns & Templates" : tab.id === "audience" ? "Audience Builder" : "Automations"}
            </button>
          );
        })}
      </div>

      {/* ═══════ CAMPAIGNS TAB ═══════ */}
      {activeTab === "campaigns" && (
        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          {/* Left column: Contacts */}
          <div className="space-y-6">
            {/* Contact sources */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Contacts</span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => { setShowImport(!showImport); setShowManual(false); }}>
                      <Upload className="mr-1.5 h-3.5 w-3.5" />CSV
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => { setShowManual(!showManual); setShowImport(false); }}>
                      <Plus className="mr-1.5 h-3.5 w-3.5" />Manual
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* CSV Import (collapsible) */}
                {showImport && (
                  <div className="rounded-xl border border-dashed p-4 space-y-3">
                    <Textarea rows={6} value={csvText} onChange={(e) => setCsvText(e.target.value)} className="font-mono text-xs" />
                    <p className="text-xs text-muted-foreground">Addresses will be automatically verified and standardized via USPS/Lob on import.</p>
                    <Button size="sm" disabled={importMutation.isPending} onClick={() => void handleImport()}>
                      {importMutation.isPending ? "Importing..." : "Import CSV"}
                    </Button>
                  </div>
                )}

                {/* Manual contact (collapsible) */}
                {showManual && (
                  <div className="rounded-xl border border-dashed p-4 grid gap-3">
                    <Input placeholder="Full name" value={manualContact.fullName} onChange={(e) => setManualContact((p) => ({ ...p, fullName: e.target.value }))} />
                    <AddressAutocomplete
                      placeholder="Address line 1"
                      value={manualContact.addressLine1}
                      onChange={(v) => setManualContact((p) => ({ ...p, addressLine1: v }))}
                      onSelect={(formatted) => {
                        // Parse "123 Main St, City, ST 12345, USA" into components
                        const parts = formatted.split(",").map((s) => s.trim());
                        if (parts.length >= 3) {
                          const stateZip = parts[parts.length - 2] ?? "";
                          const m = stateZip.match(/^([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/);
                          setManualContact((p) => ({
                            ...p,
                            addressLine1: parts[0] ?? p.addressLine1,
                            city: parts.length >= 4 ? (parts[1] ?? p.city) : p.city,
                            state: m?.[1] ?? p.state,
                            postalCode: m?.[2] ?? p.postalCode,
                          }));
                        }
                      }}
                    />
                    <div className="grid gap-3 grid-cols-3">
                      <Input placeholder="City" value={manualContact.city} onChange={(e) => setManualContact((p) => ({ ...p, city: e.target.value }))} />
                      <Input placeholder="State" value={manualContact.state} onChange={(e) => setManualContact((p) => ({ ...p, state: e.target.value.toUpperCase() }))} />
                      <Input placeholder="ZIP" value={manualContact.postalCode} onChange={(e) => setManualContact((p) => ({ ...p, postalCode: e.target.value }))} />
                    </div>
                    <Input placeholder="Tags (comma separated)" value={manualContact.tags} onChange={(e) => setManualContact((p) => ({ ...p, tags: e.target.value }))} />
                    <Button size="sm" disabled={manualMutation.isPending} onClick={() => void handleManualCreate()}>
                      {manualMutation.isPending ? "Saving..." : "Save Contact"}
                    </Button>
                  </div>
                )}

                {/* Contact list */}
                <div className="max-h-[360px] space-y-2 overflow-y-auto">
                  {verifiedContacts.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">No verified contacts yet. Import CSV, add manually, or scan zipcodes in the Audience tab.</p>
                  ) : verifiedContacts.map((contact) => (
                    <label className="flex items-start gap-3 rounded-lg border p-3 hover:bg-muted/30 transition-colors" key={contact.id}>
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
                        className="mt-1"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate">{contact.name || "Current Resident"}</span>
                          {contact.source === "zipcode_scan" && (
                            <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 shrink-0">MLS</Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {contact.addressLine1}, {contact.city}, {contact.state} {contact.postalCode}
                        </div>
                        {((contact.tags as string[]) ?? []).length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {((contact.tags as string[]) ?? []).slice(0, 3).map((tag) => (
                              <Badge key={tag} variant="secondary" className="text-[9px] px-1.5 py-0 h-4">{tag}</Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
                <div className="text-xs text-muted-foreground">
                  {activeSelectedContactIds.length} of {verifiedContacts.length} selected
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right column: Templates + Campaign */}
          <div className="space-y-6">
            {/* Templates */}
            <Card>
              <CardHeader>
                <CardTitle>Templates & Copy</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2">
                  {workspaceQuery.data?.templates.map((template) => (
                    <button
                      className={`rounded-2xl border p-4 text-left transition ${
                        activeSelectedTemplateId === template.id
                          ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                          : "border-border bg-background hover:border-primary/30"
                      }`}
                      key={template.id}
                      onClick={() => setSelectedTemplateId(template.id)}
                      type="button"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-medium text-sm">{template.name}</div>
                        <Badge variant="secondary" className="text-xs">{template.sizeCode}</Badge>
                      </div>
                      <div className="mt-1.5 text-xs text-muted-foreground line-clamp-2">{template.note}</div>
                    </button>
                  ))}
                </div>

                {/* AI copy */}
                <div className="rounded-xl border bg-muted/20 p-4 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Sparkles className="h-4 w-4" />AI Postcard Copy
                  </div>
                  <Input
                    placeholder="e.g. seller valuation postcard for nearby homeowners"
                    value={copyPrompt}
                    onChange={(e) => setCopyPrompt(e.target.value)}
                  />
                  <Button size="sm" disabled={copyMutation.isPending} onClick={() => void handleGenerateCopy()}>
                    {copyMutation.isPending ? "Generating..." : "Generate Copy"}
                  </Button>
                  {copyMutation.data && (
                    <div className="rounded-lg bg-background p-3 text-sm space-y-1">
                      <div className="font-medium">{copyMutation.data.headline}</div>
                      <div className="text-muted-foreground text-xs">{copyMutation.data.body}</div>
                      <div className="font-medium text-xs text-primary">{copyMutation.data.callout}</div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Create campaign */}
            <Card>
              <CardHeader>
                <CardTitle>Create Campaign</CardTitle>
                <CardDescription>
                  Select contacts + template, then create a draft. Review before launching.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input placeholder="Campaign name" value={campaignName} onChange={(e) => setCampaignName(e.target.value)} />
                <div className="grid gap-4 md:grid-cols-[200px_1fr]">
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground">Send mode</span>
                    <select
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs"
                      value={sendStrategy}
                      onChange={(e) => setSendStrategy(e.target.value as "send_now" | "scheduled")}
                    >
                      <option value="send_now">Send now</option>
                      <option value="scheduled">Schedule</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground">Scheduled time</span>
                    <Input
                      disabled={sendStrategy !== "scheduled"}
                      type="datetime-local"
                      value={scheduledAt}
                      onChange={(e) => setScheduledAt(e.target.value)}
                    />
                  </div>
                </div>

                {/* Cost estimate */}
                {activeSelectedTemplateId && activeSelectedContactIds.length > 0 && (
                  <div className="rounded-lg border bg-muted/10 p-3 flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      {activeSelectedContactIds.length} recipients × template
                    </span>
                    <span className="text-sm font-semibold">
                      Est. ${((activeSelectedContactIds.length * 144) / 100).toFixed(2)}
                    </span>
                  </div>
                )}

                <Button disabled={createCampaignMutation.isPending} onClick={() => void handleCreateCampaign()} className="w-full">
                  {createCampaignMutation.isPending ? "Creating..." : "Create Draft Campaign"}
                </Button>
              </CardContent>
            </Card>

            {/* Campaign board */}
            <Card>
              <CardHeader>
                <CardTitle>Campaign Board</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {workspaceQuery.data?.campaigns.length ? (
                  workspaceQuery.data.campaigns.map((campaign) => (
                    <div className="rounded-xl border p-4" key={campaign.id}>
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-medium text-sm truncate">{campaign.name}</div>
                          <div className="mt-0.5 text-xs text-muted-foreground">
                            {campaign.templateName} · {campaign.recipientCount} recipients
                          </div>
                        </div>
                        <Badge
                          variant={campaign.status === "completed" ? "default" : campaign.status === "failed" ? "destructive" : "secondary"}
                        >
                          {campaign.status}
                        </Badge>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                        <span>Total: ${(campaign.totalCents / 100).toFixed(2)}</span>
                        <span>Submitted: {campaign.submittedCount}</span>
                        <span>Delivered: {campaign.deliveredCount}</span>
                        {campaign.failedCount > 0 && <span className="text-destructive">Failed: {campaign.failedCount}</span>}
                      </div>
                      {(campaign.status === "draft" || campaign.status === "failed") && (
                        <Button
                          className="mt-3"
                          size="sm"
                          disabled={launchCampaignMutation.isPending}
                          onClick={() => void handleLaunchCampaign(campaign.id)}
                        >
                          <Send className="mr-1.5 h-3.5 w-3.5" />
                          {launchCampaignMutation.isPending ? "Launching..." : sendStrategy === "scheduled" ? "Schedule" : "Launch"}
                        </Button>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                    No campaigns yet. Create your first one above.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ═══════ AUDIENCE TAB ═══════ */}
      {activeTab === "audience" && (
        <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          {/* Zipcode scanner */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Zipcode Audience Scanner
              </CardTitle>
              <CardDescription>
                Scan MLS data by zipcode to find homeowner addresses. Uses your BBO listing data — sold, expired, or active properties.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm font-medium">ZIP Codes</p>
                <Input
                  value={zipInput}
                  onChange={(e) => setZipInput(e.target.value)}
                  placeholder="e.g. 91006, 91007, 91108"
                />
                <p className="text-xs text-muted-foreground">Comma-separated, up to 20 ZIP codes per scan.</p>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Audience Name</p>
                <Input
                  value={audienceName}
                  onChange={(e) => setAudienceName(e.target.value)}
                  placeholder="e.g. Arcadia Expired Q1 2026"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">Listing Status</span>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs"
                    value={audienceStatus}
                    onChange={(e) => setAudienceStatus(e.target.value)}
                  >
                    <option value="Sold">Sold</option>
                    <option value="Expired">Expired</option>
                    <option value="Active">Active</option>
                    <option value="Withdrawn">Withdrawn</option>
                    <option value="">All</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">Min Price</span>
                  <Input type="number" value={audienceMinPrice} onChange={(e) => setAudienceMinPrice(e.target.value)} placeholder="0" />
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">Max Price</span>
                  <Input type="number" value={audienceMaxPrice} onChange={(e) => setAudienceMaxPrice(e.target.value)} placeholder="Any" />
                </div>
              </div>

              <Button className="w-full gap-2" disabled={scanZipcodeMutation.isPending} onClick={() => void handleScanZipcode()}>
                {scanZipcodeMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 animate-spin" />Scanning MLS data...</>
                ) : (
                  <><Search className="h-4 w-4" />Scan & Import Contacts</>
                )}
              </Button>

              {scanZipcodeMutation.data && (
                <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-sm">
                  <p className="font-medium text-emerald-800">Scan Complete</p>
                  <p className="text-emerald-700 mt-1">
                    Found {scanZipcodeMutation.data.totalFound} properties · Imported {scanZipcodeMutation.data.imported} new contacts · {scanZipcodeMutation.data.duplicatesSkipped} duplicates skipped
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Audience lists + future integrations */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Saved Audience Lists</CardTitle>
                <CardDescription>
                  Previously scanned audiences. Contacts from these lists appear in your campaign contact pool.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {(workspaceQuery.data?.audienceLists ?? []).length === 0 ? (
                  <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                    No audience lists yet. Run a zipcode scan to create one.
                  </div>
                ) : (
                  (workspaceQuery.data?.audienceLists ?? []).map((list) => (
                    <div key={list.id} className="rounded-xl border p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="font-medium text-sm">{list.name}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {list.sourceType === "zipcode_scan" ? "MLS Zipcode Scan" : list.sourceType} · {list.contactCount} contacts
                          </div>
                        </div>
                        <Badge variant={list.status === "active" ? "default" : "secondary"}>{list.status}</Badge>
                      </div>
                      {list.description && (
                        <p className="text-xs text-muted-foreground mt-2">{list.description}</p>
                      )}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Future data sources */}
            <Card className="border-dashed">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  Additional Data Sources
                </CardTitle>
                <CardDescription>
                  Connect external homeowner databases for richer targeting.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { name: "PropertyRadar", desc: "Pre-foreclosure, absentee owners, equity-rich homeowners", status: "Coming Soon" },
                  { name: "ATTOM Data", desc: "Property characteristics, owner demographics, AVM", status: "Coming Soon" },
                  { name: "CoreLogic", desc: "Ownership records, transaction history", status: "Coming Soon" },
                  { name: "Custom Mail List", desc: "Upload any mailing list CSV with addresses", status: "Available" },
                ].map((source) => (
                  <div key={source.name} className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <div className="text-sm font-medium">{source.name}</div>
                      <div className="text-xs text-muted-foreground">{source.desc}</div>
                    </div>
                    <Badge variant={source.status === "Available" ? "default" : "outline"} className="shrink-0">
                      {source.status}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ═══════ AUTOMATIONS TAB ═══════ */}
      {activeTab === "automations" && (
        <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          {/* Create automation */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Create Automation
              </CardTitle>
              <CardDescription>
                Set up lifecycle drip campaigns that auto-send postcards or letters based on triggers.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm font-medium">Automation Name</p>
                <Input value={autoName} onChange={(e) => setAutoName(e.target.value)} placeholder="e.g. Closed Deal Lifecycle" />
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Trigger Type</p>
                <div className="grid gap-2">
                  {([
                    {
                      id: "closed_deal_milestone" as const,
                      title: "Closed Deal Milestones",
                      desc: "Auto-send at intervals after close: 7d Thank You → 30d Tips → 90d Update → 365d Anniversary CMA",
                      icon: <Calendar className="h-5 w-5 text-emerald-600" />,
                    },
                    {
                      id: "listing_event" as const,
                      title: "Listing Event (Just Sold)",
                      desc: "Auto-create Just Sold postcard campaign to neighbors when a listing closes",
                      icon: <Target className="h-5 w-5 text-blue-600" />,
                    },
                    {
                      id: "recurring_schedule" as const,
                      title: "Recurring Schedule",
                      desc: "Send market update mailers on a fixed cadence (monthly, quarterly)",
                      icon: <RefreshCw className="h-5 w-5 text-violet-600" />,
                    },
                  ]).map((trigger) => (
                    <button
                      key={trigger.id}
                      type="button"
                      onClick={() => setAutoTrigger(trigger.id)}
                      className={`flex items-start gap-3 rounded-xl border p-4 text-left transition-all ${
                        autoTrigger === trigger.id
                          ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                          : "hover:bg-muted/50"
                      }`}
                    >
                      <div className="mt-0.5 shrink-0">{trigger.icon}</div>
                      <div>
                        <div className="text-sm font-medium">{trigger.title}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{trigger.desc}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Milestone preview */}
              {autoTrigger === "closed_deal_milestone" && (
                <div className="rounded-xl border bg-muted/10 p-4 space-y-2">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Default Milestone Timeline</p>
                  {[
                    { days: 7, label: "Thank You Card", channel: "postcard" },
                    { days: 30, label: "Home Maintenance Tips", channel: "postcard" },
                    { days: 90, label: "Neighborhood Update", channel: "postcard" },
                    { days: 180, label: "6-Month Market Report", channel: "letter" },
                    { days: 365, label: "Happy Anniversary + CMA", channel: "letter" },
                    { days: 730, label: "2-Year Market Update + CMA", channel: "letter" },
                  ].map((m) => (
                    <div key={m.days} className="flex items-center gap-3 text-sm">
                      <span className="w-16 text-xs text-muted-foreground font-mono shrink-0">Day {m.days}</span>
                      <span className="flex-1">{m.label}</span>
                      <Badge variant="outline" className="text-[9px] shrink-0">
                        {m.channel === "letter" ? "📨 Letter" : "📮 Postcard"}
                      </Badge>
                    </div>
                  ))}
                  <p className="text-xs text-muted-foreground mt-2">
                    Tag contacts with <code className="bg-muted px-1 rounded">closed:2026-03-15</code> to enroll them.
                  </p>
                </div>
              )}

              <Button className="w-full gap-2" disabled={createAutomationMutation.isPending} onClick={() => void handleCreateAutomation()}>
                {createAutomationMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 animate-spin" />Creating...</>
                ) : (
                  <><Zap className="h-4 w-4" />Create Automation</>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Active automations */}
          <Card>
            <CardHeader>
              <CardTitle>Active Automations</CardTitle>
              <CardDescription>
                Manage your lifecycle drip sequences. The daily worker checks each automation and auto-creates campaigns.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {(workspaceQuery.data?.automations ?? []).length === 0 ? (
                <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                  No automations yet. Create one to start automated direct mail.
                </div>
              ) : (
                (workspaceQuery.data?.automations ?? []).map((auto) => {
                  const milestones = (auto.milestoneRules ?? []) as Array<{ daysAfterClose: number; label: string; channel?: string }>;
                  return (
                    <div key={auto.id} className="rounded-xl border p-4 space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="font-medium text-sm">{auto.name}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {auto.triggerType.replace(/_/g, " ")} · {auto.channel} · {milestones.length} touchpoints
                          </div>
                        </div>
                        <Badge variant={auto.status === "active" ? "default" : "secondary"}>
                          {auto.status}
                        </Badge>
                      </div>

                      {milestones.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {milestones.map((m) => (
                            <Badge key={m.daysAfterClose} variant="outline" className="text-[9px]">
                              D{m.daysAfterClose}: {m.label}
                            </Badge>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {auto.lastRunAt && <span>Last run: {new Date(auto.lastRunAt).toLocaleDateString()}</span>}
                        {auto.nextRunAt && <span>· Next: {new Date(auto.nextRunAt).toLocaleDateString()}</span>}
                      </div>

                      <Button
                        size="sm"
                        variant="outline"
                        disabled={updateAutomationMutation.isPending}
                        onClick={() => void handleToggleAutomation(auto.id, auto.status)}
                      >
                        {auto.status === "active" ? (
                          <><Pause className="mr-1.5 h-3.5 w-3.5" />Pause</>
                        ) : (
                          <><Play className="mr-1.5 h-3.5 w-3.5" />Resume</>
                        )}
                      </Button>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
