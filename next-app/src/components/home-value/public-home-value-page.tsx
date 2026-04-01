"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  Building2,
  CheckCircle2,
  Copy,
  Globe2,
  GraduationCap,
  Home,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Share2,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";

import { AddressAutocomplete } from "@/components/ui/address-autocomplete";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createTranslator } from "@/i18n";
import type { ValuationResult } from "@/lib/db/schema";
import { trpc } from "@/lib/trpc";

type Locale = "en" | "zh";
type Stage = "input" | "loading" | "gate" | "report";
type ValuationResponse = {
  valuationRunId: number;
  result: ValuationResult;
  summary: string;
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function PublicHomeValuePage({ slug, linkToken }: { slug: string; linkToken?: string }) {
  const [locale, setLocale] = useState<Locale>("en");
  const [stage, setStage] = useState<Stage>("input");
  const [address, setAddress] = useState("");
  const [valuationRunId, setValuationRunId] = useState<number | null>(null);
  const [valuation, setValuation] = useState<ValuationResponse | null>(null);
  const [leadForm, setLeadForm] = useState({
    name: "",
    email: "",
    phone: "",
    timeline: "",
    notes: "",
  });

  const contextQuery = trpc.homeValue.getPublicContext.useQuery({ slug });
  const runValuation = trpc.homeValue.runValuation.useMutation();
  const captureLead = trpc.homeValue.captureLead.useMutation();
  const trackView = trpc.homeValue.trackView.useMutation();

  useEffect(() => {
    if (!contextQuery.data?.slug) return;
    const storageKey = `kevv-home-value-view:${contextQuery.data.slug}`;
    try {
      if (window.sessionStorage.getItem(storageKey)) return;
      window.sessionStorage.setItem(storageKey, "1");
    } catch {}
    void trackView.mutateAsync({ slug: contextQuery.data.slug });
  }, [contextQuery.data?.slug, trackView]);

  const t = createTranslator(locale);
  const c = {
    badge: t("homeValue.public.badge"),
    title: t("homeValue.public.title"),
    subtitle: t("homeValue.public.subtitle"),
    inputLabel: t("homeValue.public.inputLabel"),
    inputPlaceholder: t("homeValue.public.inputPlaceholder"),
    inputButton: t("homeValue.public.inputButton"),
    gateTitle: t("homeValue.public.gateTitle"),
    gateSubtitle: t("homeValue.public.gateSubtitle"),
    reportTitle: t("homeValue.public.reportTitle"),
    reportSubtitle: t("homeValue.public.reportSubtitle"),
    share: t("homeValue.public.share"),
    copy: t("homeValue.public.copy"),
    copied: t("homeValue.public.copied"),
    loading: t("homeValue.public.loading"),
    notFoundTitle: t("homeValue.public.notFoundTitle"),
    notFoundDescription: t("homeValue.public.notFoundDescription"),
    viewTags: {
      marketRead: t("homeValue.public.viewTags.marketRead"),
      comps: t("homeValue.public.viewTags.comps"),
      neighborhood: t("homeValue.public.viewTags.neighborhood"),
    },
    errors: {
      addressRequired: t("homeValue.public.errors.addressRequired"),
      generateFailed: t("homeValue.public.errors.generateFailed"),
      unlockSuccess: t("homeValue.public.errors.unlockSuccess"),
      unlockFailed: t("homeValue.public.errors.unlockFailed"),
      copyFailed: t("homeValue.public.errors.copyFailed"),
    },
    placeholders: {
      name: t("homeValue.public.placeholders.name"),
      email: t("homeValue.public.placeholders.email"),
      phone: t("homeValue.public.placeholders.phone"),
      timeline: t("homeValue.public.placeholders.timeline"),
      notes: t("homeValue.public.placeholders.notes"),
    },
    actions: {
      generating: t("homeValue.public.actions.generating"),
      unlocking: t("homeValue.public.actions.unlocking"),
      unlockReport: t("homeValue.public.actions.unlockReport"),
      explainer: t("homeValue.public.actions.explainer"),
      openAgentProfile: t("homeValue.public.actions.openAgentProfile"),
      bookCall: t("homeValue.public.actions.bookCall"),
    },
    stats: {
      range: t("homeValue.public.stats.range"),
      layout: t("homeValue.public.stats.layout"),
      sqft: t("homeValue.public.stats.sqft"),
      schoolScore: t("homeValue.public.stats.schoolScore"),
    },
    sections: {
      estimatedRange: t("homeValue.public.sections.estimatedRange"),
      agentFollowUp: t("homeValue.public.sections.agentFollowUp"),
      comparableSales: t("homeValue.public.sections.comparableSales"),
      price: t("homeValue.public.sections.price"),
      marketNotes: t("homeValue.public.sections.marketNotes"),
      shareHelp: t("homeValue.public.sections.shareHelp"),
    },
    shareSummary: (low: string, high: string) =>
      t("homeValue.public.shareSummary", { low, high }),
  } as const;
  const shareUrl = typeof window !== "undefined" ? window.location.href : "";

  const shareText = valuation?.result
    ? c.shareSummary(
        formatMoney(valuation.result.estimatedValueLow),
        formatMoney(valuation.result.estimatedValueHigh),
      )
    : "";

  const handleGenerate = async () => {
    if (address.trim().length < 5) {
      toast.error(c.errors.addressRequired);
      return;
    }

    setStage("loading");

    try {
      const result = await runValuation.mutateAsync({
        slug,
        address: address.trim(),
        locale,
        ...(linkToken ? { ref: linkToken } : {}),
      });
      setValuation(result);
      setValuationRunId(result.valuationRunId);
      setStage("gate");
    } catch (error) {
      setStage("input");
      toast.error(error instanceof Error ? error.message : c.errors.generateFailed);
    }
  };

  const handleGateSubmit = async () => {
    if (!valuationRunId) return;

    try {
      await captureLead.mutateAsync({
        slug,
        valuationRunId,
        ...leadForm,
        ...(linkToken ? { ref: linkToken } : {}),
      });
      setStage("report");
      toast.success(c.errors.unlockSuccess);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : c.errors.unlockFailed);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
      toast.success(c.copied);
    } catch {
      toast.error(c.errors.copyFailed);
    }
  };

  if (contextQuery.isLoading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[#08131d] text-white">
        <div className="text-xs uppercase tracking-[0.36em] text-white/55">{c.loading}</div>
      </div>
    );
  }

  if (!contextQuery.data) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-[#08131d] px-6 text-center text-white">
        <h1 className="text-4xl font-semibold tracking-tight">{c.notFoundTitle}</h1>
        <p className="max-w-xl text-white/65">
          {c.notFoundDescription}
        </p>
      </div>
    );
  }

  const profile = contextQuery.data;

  return (
    <div className="min-h-[100dvh] bg-[#f3f6f8] text-slate-900">
      <div className="relative overflow-hidden bg-[#08131d] text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(44,205,197,0.24),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.08),transparent_22%)]" />
        <div className="relative mx-auto max-w-6xl px-6 py-8 lg:px-10">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-[0.34em] text-white/45">
                {profile.brokerage || profile.name}
              </div>
              <div className="mt-2 text-xl font-semibold">{profile.name}</div>
            </div>
            <div className="flex items-center gap-2">
              {[
                { value: "en" as const, label: "EN" },
                { value: "zh" as const, label: "中文" },
              ].map((option) => (
                <Button
                  key={option.value}
                  onClick={() => setLocale(option.value)}
                  size="sm"
                  variant={locale === option.value ? "secondary" : "ghost"}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="mt-14 grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="space-y-6">
              <Badge className="bg-white/10 text-white">{c.badge}</Badge>
              <h1 className="max-w-4xl text-5xl font-semibold tracking-tight sm:text-6xl">
                {c.title}
              </h1>
              <p className="max-w-3xl text-lg leading-8 text-white/70">{c.subtitle}</p>

              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  { icon: BarChart3, label: c.viewTags.marketRead },
                  { icon: Building2, label: c.viewTags.comps },
                  { icon: GraduationCap, label: c.viewTags.neighborhood },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-[22px] border border-white/10 bg-white/5 p-4"
                  >
                    <item.icon className="h-5 w-5 text-cyan-300" />
                    <div className="mt-3 text-sm text-white/75">{item.label}</div>
                  </div>
                ))}
              </div>
            </div>

            <Card className="overflow-hidden border-white/10 bg-white/6 text-white backdrop-blur">
              <CardContent className="p-6">
                <div className="text-xs uppercase tracking-[0.32em] text-white/45">
                  {c.inputLabel}
                </div>
                <div className="mt-5 space-y-4">
                  <AddressAutocomplete
                    inputClassName="h-12 border-white/10 bg-white/10 text-white placeholder:text-white/35"
                    placeholder={c.inputPlaceholder}
                    value={address}
                    onChange={setAddress}
                    onSelect={(standardized) => {
                      setAddress(standardized);
                    }}
                  />
                  <Button
                    className="h-12 w-full bg-cyan-300 text-[#08131d] hover:bg-cyan-200"
                    disabled={runValuation.isPending}
                    onClick={() => void handleGenerate()}
                  >
                    {runValuation.isPending || stage === "loading" ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {c.actions.generating}
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        {c.inputButton}
                      </>
                    )}
                  </Button>
                </div>
                <div className="mt-6 text-sm text-white/55">
                  {c.actions.explainer}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-6 py-10 lg:px-10">
        {stage === "gate" && valuation?.result ? (
          <div className="grid gap-8 lg:grid-cols-[0.92fr_1.08fr]">
            <Card className="border-none bg-white shadow-sm">
              <CardContent className="space-y-5 p-8">
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.32em] text-slate-500">
                  <Home className="h-4 w-4 text-teal-600" />
                  {c.sections.estimatedRange}
                </div>
                <div className="space-y-2">
                  <div className="text-4xl font-semibold blur-[10px]">
                    {formatMoney(valuation.result.estimatedValueLow)} -{" "}
                    {formatMoney(valuation.result.estimatedValueHigh)}
                  </div>
                  <div className="text-sm text-slate-400 blur-[7px]">
                    {formatMoney(valuation.result.estimatedValue)}
                  </div>
                </div>
                <div className="rounded-[24px] bg-slate-50 p-5 text-sm leading-7 text-slate-500">
                  {c.gateSubtitle}
                </div>
              </CardContent>
            </Card>

            <Card className="border-none bg-white shadow-sm">
              <CardContent className="space-y-5 p-8">
                <div>
                  <div className="text-xs uppercase tracking-[0.32em] text-slate-500">
                    {c.gateTitle}
                  </div>
                  <h2 className="mt-2 text-3xl font-semibold tracking-tight">
                    {address}
                  </h2>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <Input
                    placeholder={c.placeholders.name}
                    value={leadForm.name}
                    onChange={(event) =>
                      setLeadForm((current) => ({ ...current, name: event.target.value }))
                    }
                  />
                  <Input
                    placeholder={c.placeholders.email}
                    type="email"
                    value={leadForm.email}
                    onChange={(event) =>
                      setLeadForm((current) => ({ ...current, email: event.target.value }))
                    }
                  />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <Input
                    placeholder={c.placeholders.phone}
                    value={leadForm.phone}
                    onChange={(event) =>
                      setLeadForm((current) => ({ ...current, phone: event.target.value }))
                    }
                  />
                  <Input
                    placeholder={c.placeholders.timeline}
                    value={leadForm.timeline}
                    onChange={(event) =>
                      setLeadForm((current) => ({ ...current, timeline: event.target.value }))
                    }
                  />
                </div>
                <Textarea
                  rows={4}
                  placeholder={c.placeholders.notes}
                  value={leadForm.notes}
                  onChange={(event) =>
                    setLeadForm((current) => ({ ...current, notes: event.target.value }))
                  }
                />
                <Button
                  className="h-12 w-full bg-[#08131d] text-white hover:bg-slate-900"
                  disabled={captureLead.isPending}
                  onClick={() => void handleGateSubmit()}
                >
                  {captureLead.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {c.actions.unlocking}
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      {c.actions.unlockReport}
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        ) : null}

        {stage === "report" && valuation?.result ? (
          <div className="space-y-8">
            <div className="grid gap-6 lg:grid-cols-[1.08fr_0.92fr]">
              <Card className="border-none bg-white shadow-sm">
                <CardContent className="space-y-6 p-8">
                  <div>
                    <div className="text-xs uppercase tracking-[0.32em] text-slate-500">
                      {c.reportTitle}
                    </div>
                    <h2 className="mt-2 text-4xl font-semibold tracking-tight">
                      {formatMoney(valuation.result.estimatedValue)}
                    </h2>
                    <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-500">
                      {valuation.summary}
                    </p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-4">
                    {[
                      {
                        icon: TrendingUp,
                        label: c.stats.range,
                        value: `${formatMoney(valuation.result.estimatedValueLow)} - ${formatMoney(valuation.result.estimatedValueHigh)}`,
                      },
                      {
                        icon: Home,
                        label: c.stats.layout,
                        value: `${valuation.result.propertyDetails.beds} bd / ${valuation.result.propertyDetails.baths} ba`,
                      },
                      {
                        icon: MapPin,
                        label: c.stats.sqft,
                        value: `${valuation.result.propertyDetails.sqft.toLocaleString()} sqft`,
                      },
                      {
                        icon: GraduationCap,
                        label: c.stats.schoolScore,
                        value: `${valuation.result.schoolRating}/10`,
                      },
                    ].map((item) => (
                      <div key={item.label} className="rounded-[24px] bg-slate-50 p-5">
                        <item.icon className="h-5 w-5 text-teal-600" />
                        <div className="mt-3 text-xs uppercase tracking-[0.28em] text-slate-400">
                          {item.label}
                        </div>
                        <div className="mt-2 text-lg font-semibold leading-6">{item.value}</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-none bg-[#08131d] text-white shadow-sm">
                <CardContent className="space-y-6 p-8">
                  <div className="text-xs uppercase tracking-[0.32em] text-white/45">
                    {c.sections.agentFollowUp}
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="h-16 w-16 overflow-hidden rounded-2xl bg-white/10">
                      {profile.photoUrl ? (
                        <img alt={profile.name} className="h-full w-full object-cover" src={profile.photoUrl} />
                      ) : (
                        <div className="flex h-full items-center justify-center text-lg font-semibold">
                          {profile.name
                            .split(" ")
                            .slice(0, 2)
                            .map((part) => part[0])
                            .join("")}
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="text-xl font-semibold">{profile.name}</div>
                      <div className="text-sm text-white/65">{profile.title}</div>
                    </div>
                  </div>
                  <div className="space-y-3 text-sm text-white/70">
                    {profile.phone ? (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4" />
                        {profile.phone}
                      </div>
                    ) : null}
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      {profile.email}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <Button asChild className="bg-cyan-300 text-[#08131d] hover:bg-cyan-200">
                      <Link href={`/agents/${slug}`}>{c.actions.openAgentProfile}</Link>
                    </Button>
                    {profile.bookingUrl ? (
                      <Button asChild variant="outline" className="border-white/20 bg-transparent text-white hover:bg-white/10">
                        <a href={profile.bookingUrl} rel="noreferrer" target="_blank">
                          {c.actions.bookCall}
                        </a>
                      </Button>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
              <Card className="border-none bg-white shadow-sm">
                <CardContent className="space-y-5 p-8">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-[0.32em] text-slate-500">
                    <Building2 className="h-4 w-4 text-teal-600" />
                    {c.sections.comparableSales}
                  </div>
                  <div className="space-y-4">
                    {valuation.result.comparableSales.map((comp: ValuationResult["comparableSales"][number]) => (
                      <div
                        className="grid gap-3 rounded-[24px] bg-slate-50 p-5 md:grid-cols-[1.4fr_0.8fr_0.8fr_0.8fr]"
                        key={`${comp.address}-${comp.date}`}
                      >
                        <div>
                          <div className="font-semibold">{comp.address}</div>
                          <div className="mt-1 text-sm text-slate-500">{comp.date}</div>
                        </div>
                        <div>
                          <div className="text-xs uppercase tracking-[0.24em] text-slate-400">{c.sections.price}</div>
                          <div className="mt-2 font-medium">{formatMoney(comp.price)}</div>
                        </div>
                        <div>
                          <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Layout</div>
                          <div className="mt-2 font-medium">{comp.beds} / {comp.baths}</div>
                        </div>
                        <div>
                          <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Sqft</div>
                          <div className="mt-2 font-medium">{comp.sqft.toLocaleString()}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-6">
                <Card className="border-none bg-white shadow-sm">
                  <CardContent className="space-y-4 p-8">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-[0.32em] text-slate-500">
                      <Share2 className="h-4 w-4 text-teal-600" />
                      {c.share}
                    </div>
                    <p className="text-sm leading-7 text-slate-500">
                      {c.sections.shareHelp}
                    </p>
                    <div className="flex flex-wrap gap-3">
                      <Button onClick={() => void handleCopy()} variant="outline">
                        <Copy className="h-4 w-4" />
                        {c.copy}
                      </Button>
                      <Button asChild>
                        <a
                          href={`https://wa.me/?text=${encodeURIComponent(`${shareText}\n${shareUrl}`)}`}
                          rel="noreferrer"
                          target="_blank"
                        >
                          WhatsApp
                          <ArrowRight className="h-4 w-4" />
                        </a>
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-none bg-white shadow-sm">
                  <CardContent className="space-y-4 p-8">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-[0.32em] text-slate-500">
                      <Globe2 className="h-4 w-4 text-teal-600" />
                      {c.sections.marketNotes}
                    </div>
                    <p className="text-sm leading-7 text-slate-500">
                      {valuation.result.marketSummary}
                    </p>
                    <div className="rounded-[22px] bg-slate-50 p-5 text-sm leading-7 text-slate-600">
                      {valuation.result.neighborhoodTrend}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
