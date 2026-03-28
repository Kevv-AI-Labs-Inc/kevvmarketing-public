"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ExternalLink, Globe, MessagesSquare, Users } from "lucide-react";
import { toast } from "sonner";

import { AgentSiteShell } from "@/components/agent-site/agent-site-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  agentSiteTemplateOptions,
  buildAgentSlug,
  parseTestimonialsText,
  parseTransactionsText,
  sanitizeSocialLinks,
  serializeTestimonials,
  serializeTransactions,
  splitAndCleanList,
} from "@/lib/agent-site";
import type { AgentProfile } from "@/lib/db/schema";
import { trpc } from "@/lib/trpc";

type FormState = {
  slug: string;
  name: string;
  email: string;
  phone: string;
  title: string;
  brokerage: string;
  licenseState: string;
  officeAddress: string;
  bookingUrl: string;
  photoUrl: string;
  heroImageUrl: string;
  bio: string;
  serviceAreasText: string;
  specialtiesText: string;
  languagesText: string;
  awardsText: string;
  testimonialsText: string;
  transactionsText: string;
  yearsExperience: string;
  templateId: string;
  colorScheme: string;
  instagramUrl: string;
  linkedinUrl: string;
  websiteUrl: string;
  wechatUrl: string;
  showPhone: boolean;
  showEmail: boolean;
  showTransactions: boolean;
  showAwards: boolean;
  showTestimonials: boolean;
  showAddress: boolean;
};

function buildFormState(profile: AgentProfile): FormState {
  return {
    slug: profile.slug,
    name: profile.name,
    email: profile.email,
    phone: profile.phone ?? "",
    title: profile.title ?? "",
    brokerage: profile.brokerage ?? "",
    licenseState: profile.licenseState ?? "",
    officeAddress: profile.officeAddress ?? "",
    bookingUrl: profile.bookingUrl ?? "",
    photoUrl: profile.photoUrl ?? "",
    heroImageUrl: profile.heroImageUrl ?? "",
    bio: profile.bio ?? "",
    serviceAreasText: (profile.serviceAreas ?? []).join(", "),
    specialtiesText: (profile.specialties ?? []).join(", "),
    languagesText: (profile.languages ?? []).join(", "),
    awardsText: (profile.awards ?? []).join(", "),
    testimonialsText: serializeTestimonials(profile.testimonials),
    transactionsText: serializeTransactions(profile.transactions),
    yearsExperience: String(profile.yearsExperience ?? 0),
    templateId: profile.templateId ?? "classic",
    colorScheme: profile.colorScheme ?? "gold",
    instagramUrl: profile.socialLinks?.instagram ?? "",
    linkedinUrl: profile.socialLinks?.linkedin ?? "",
    websiteUrl: profile.socialLinks?.website ?? "",
    wechatUrl: profile.socialLinks?.wechat ?? "",
    showPhone: profile.visibilitySettings?.showPhone ?? true,
    showEmail: profile.visibilitySettings?.showEmail ?? true,
    showTransactions: profile.visibilitySettings?.showTransactions ?? true,
    showAwards: profile.visibilitySettings?.showAwards ?? true,
    showTestimonials: profile.visibilitySettings?.showTestimonials ?? true,
    showAddress: profile.visibilitySettings?.showAddress ?? true,
  };
}

function createEmptyFormState(): FormState {
  return {
    slug: "agent-profile",
    name: "",
    email: "",
    phone: "",
    title: "",
    brokerage: "",
    licenseState: "",
    officeAddress: "",
    bookingUrl: "",
    photoUrl: "",
    heroImageUrl: "",
    bio: "",
    serviceAreasText: "",
    specialtiesText: "",
    languagesText: "",
    awardsText: "",
    testimonialsText: "",
    transactionsText: "",
    yearsExperience: "0",
    templateId: "classic",
    colorScheme: "gold",
    instagramUrl: "",
    linkedinUrl: "",
    websiteUrl: "",
    wechatUrl: "",
    showPhone: true,
    showEmail: true,
    showTransactions: true,
    showAwards: true,
    showTestimonials: true,
    showAddress: true,
  };
}

export function AgentSiteDashboard() {
  const query = trpc.profile.getMine.useQuery();
  const saveMutation = trpc.profile.upsertMine.useMutation();
  const utils = trpc.useUtils();
  const [form, setForm] = useState<FormState>(createEmptyFormState());

  useEffect(() => {
    if (query.data?.profile) {
      setForm(buildFormState(query.data.profile));
    }
  }, [query.data]);

  const handleSave = async () => {
    try {
      await saveMutation.mutateAsync({
        slug: form.slug,
        name: form.name,
        email: form.email,
        phone: form.phone,
        title: form.title,
        brokerage: form.brokerage,
        licenseState: form.licenseState,
        officeAddress: form.officeAddress,
        bookingUrl: form.bookingUrl,
        photoUrl: form.photoUrl,
        heroImageUrl: form.heroImageUrl,
        bio: form.bio,
        serviceAreas: splitAndCleanList(form.serviceAreasText),
        specialties: splitAndCleanList(form.specialtiesText),
        languages: splitAndCleanList(form.languagesText),
        awards: splitAndCleanList(form.awardsText),
        testimonials: parseTestimonialsText(form.testimonialsText),
        transactions: parseTransactionsText(form.transactionsText),
        socialLinks: sanitizeSocialLinks({
          instagram: form.instagramUrl,
          linkedin: form.linkedinUrl,
          website: form.websiteUrl,
          wechat: form.wechatUrl,
        }),
        visibilitySettings: {
          showPhone: form.showPhone,
          showEmail: form.showEmail,
          showTransactions: form.showTransactions,
          showAwards: form.showAwards,
          showTestimonials: form.showTestimonials,
          showAddress: form.showAddress,
        },
        yearsExperience: Number(form.yearsExperience) || 0,
        templateId: (form.templateId || "classic") as
          | "classic"
          | "modern"
          | "bold"
          | "elegant"
          | "minimal"
          | "urban"
          | "luxury",
        colorScheme: form.colorScheme,
        status: "active",
        tier: "pro",
      });

      await utils.profile.getMine.invalidate();
      toast.success("Agent site updated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save profile.");
    }
  };

  const profile = query.data?.profile;
  const previewProfile =
    profile && !query.isLoading
      ? {
          ...profile,
          slug: form.slug || profile.slug,
          name: form.name || profile.name,
          email: form.email || profile.email,
          phone: form.phone,
          title: form.title,
          brokerage: form.brokerage,
          licenseState: form.licenseState,
          officeAddress: form.officeAddress,
          bookingUrl: form.bookingUrl,
          photoUrl: form.photoUrl,
          heroImageUrl: form.heroImageUrl,
          bio: form.bio,
          serviceAreas: splitAndCleanList(form.serviceAreasText),
          specialties: splitAndCleanList(form.specialtiesText),
          languages: splitAndCleanList(form.languagesText),
          awards: splitAndCleanList(form.awardsText),
          testimonials: parseTestimonialsText(form.testimonialsText),
          transactions: parseTransactionsText(form.transactionsText),
          socialLinks: sanitizeSocialLinks({
            instagram: form.instagramUrl,
            linkedin: form.linkedinUrl,
            website: form.websiteUrl,
            wechat: form.wechatUrl,
          }),
          visibilitySettings: {
            showPhone: form.showPhone,
            showEmail: form.showEmail,
            showTransactions: form.showTransactions,
            showAwards: form.showAwards,
            showTestimonials: form.showTestimonials,
            showAddress: form.showAddress,
          },
          yearsExperience: Number(form.yearsExperience) || 0,
          templateId: form.templateId,
          colorScheme: form.colorScheme,
        }
      : null;

  return (
    <div className="space-y-8 px-6 py-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.32em] text-muted-foreground">
            Agent Site
          </div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Public profile + AI chat</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            This module owns the public agent page, contact form, page analytics, and chat-driven
            lead capture.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          {query.data?.publicUrl ? (
            <Button asChild variant="outline">
              <Link href={query.data.publicUrl} target="_blank">
                Open public page
                <ExternalLink className="h-4 w-4" />
              </Link>
            </Button>
          ) : null}
          <Button disabled={saveMutation.isPending || query.isLoading} onClick={() => void handleSave()}>
            {saveMutation.isPending ? "Saving..." : "Save & publish"}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-2xl bg-sky-100 p-3 text-sky-700">
              <Globe className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Profile views (30d)</div>
              <div className="text-2xl font-semibold">{query.data?.analytics.profileViews ?? 0}</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-2xl bg-violet-100 p-3 text-violet-700">
              <MessagesSquare className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Chat messages (30d)</div>
              <div className="text-2xl font-semibold">{query.data?.analytics.chatMessages ?? 0}</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-2xl bg-amber-100 p-3 text-amber-700">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Inquiries (30d)</div>
              <div className="text-2xl font-semibold">{query.data?.analytics.inquiries ?? 0}</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-8 xl:grid-cols-[1fr_1.12fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Core identity</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <Input
                placeholder="Public slug"
                value={form.slug}
                onChange={(event) =>
                  setForm((current) => ({ ...current, slug: buildAgentSlug(event.target.value) }))
                }
              />
              <div className="grid gap-4 md:grid-cols-2">
                <Input
                  placeholder="Name"
                  value={form.name}
                  onChange={(event) =>
                    setForm((current) => {
                      const name = event.target.value;
                      return {
                        ...current,
                        name,
                        slug:
                          current.slug === "agent-profile" || current.slug.length === 0
                            ? buildAgentSlug(name)
                            : current.slug,
                      };
                    })
                  }
                />
                <Input
                  placeholder="Email"
                  type="email"
                  value={form.email}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, email: event.target.value }))
                  }
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Input
                  placeholder="Phone"
                  value={form.phone}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, phone: event.target.value }))
                  }
                />
                <Input
                  placeholder="Title"
                  value={form.title}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, title: event.target.value }))
                  }
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Input
                  placeholder="Brokerage"
                  value={form.brokerage}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, brokerage: event.target.value }))
                  }
                />
                <Input
                  placeholder="License state"
                  value={form.licenseState}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, licenseState: event.target.value }))
                  }
                />
              </div>
              <Input
                placeholder="Office address"
                value={form.officeAddress}
                onChange={(event) =>
                  setForm((current) => ({ ...current, officeAddress: event.target.value }))
                }
              />
              <Textarea
                placeholder="Brand story / market positioning"
                rows={5}
                value={form.bio}
                onChange={(event) =>
                  setForm((current) => ({ ...current, bio: event.target.value }))
                }
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Funnel links and visual setup</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Input
                  placeholder="Booking URL"
                  value={form.bookingUrl}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, bookingUrl: event.target.value }))
                  }
                />
                <Input
                  placeholder="Photo URL"
                  value={form.photoUrl}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, photoUrl: event.target.value }))
                  }
                />
              </div>
              <Input
                placeholder="Hero image URL"
                value={form.heroImageUrl}
                onChange={(event) =>
                  setForm((current) => ({ ...current, heroImageUrl: event.target.value }))
                }
              />
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2 text-sm">
                  <span className="text-muted-foreground">Template</span>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs"
                    value={form.templateId}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, templateId: event.target.value }))
                    }
                  >
                    {agentSiteTemplateOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <Input
                  placeholder="Color scheme label"
                  value={form.colorScheme}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, colorScheme: event.target.value }))
                  }
                />
              </div>
              <Input
                placeholder="Years of experience"
                value={form.yearsExperience}
                onChange={(event) =>
                  setForm((current) => ({ ...current, yearsExperience: event.target.value }))
                }
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Structured sections</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <Textarea
                placeholder="Service areas, comma separated"
                rows={3}
                value={form.serviceAreasText}
                onChange={(event) =>
                  setForm((current) => ({ ...current, serviceAreasText: event.target.value }))
                }
              />
              <Textarea
                placeholder="Specialties, comma separated"
                rows={3}
                value={form.specialtiesText}
                onChange={(event) =>
                  setForm((current) => ({ ...current, specialtiesText: event.target.value }))
                }
              />
              <Textarea
                placeholder="Languages, comma separated"
                rows={2}
                value={form.languagesText}
                onChange={(event) =>
                  setForm((current) => ({ ...current, languagesText: event.target.value }))
                }
              />
              <Textarea
                placeholder="Awards, comma separated"
                rows={2}
                value={form.awardsText}
                onChange={(event) =>
                  setForm((current) => ({ ...current, awardsText: event.target.value }))
                }
              />
              <Textarea
                placeholder="Testimonials. One per line: Name | Quote | Rating"
                rows={4}
                value={form.testimonialsText}
                onChange={(event) =>
                  setForm((current) => ({ ...current, testimonialsText: event.target.value }))
                }
              />
              <Textarea
                placeholder="Transactions. One per line: Address | City | Price | Type"
                rows={4}
                value={form.transactionsText}
                onChange={(event) =>
                  setForm((current) => ({ ...current, transactionsText: event.target.value }))
                }
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Socials and visibility</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Input
                  placeholder="Instagram URL"
                  value={form.instagramUrl}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, instagramUrl: event.target.value }))
                  }
                />
                <Input
                  placeholder="LinkedIn URL"
                  value={form.linkedinUrl}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, linkedinUrl: event.target.value }))
                  }
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Input
                  placeholder="Website URL"
                  value={form.websiteUrl}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, websiteUrl: event.target.value }))
                  }
                />
                <Input
                  placeholder="WeChat"
                  value={form.wechatUrl}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, wechatUrl: event.target.value }))
                  }
                />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {[
                  ["showPhone", "Show phone"],
                  ["showEmail", "Show email"],
                  ["showTransactions", "Show transactions"],
                  ["showAwards", "Show awards"],
                  ["showTestimonials", "Show testimonials"],
                  ["showAddress", "Show address"],
                ].map(([field, label]) => (
                  <label className="flex items-center gap-3 rounded-xl border p-3" key={field}>
                    <input
                      checked={form[field as keyof FormState] as boolean}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          [field]: event.target.checked,
                        }))
                      }
                      type="checkbox"
                    />
                    <span className="text-sm">{label}</span>
                  </label>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Publish targets</span>
                <Badge variant="secondary">
                  {query.data?.isPersisted ? "Live profile" : "Draft profile"}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="rounded-xl border bg-muted/30 p-4">
                <div className="text-xs uppercase tracking-[0.28em] text-muted-foreground">
                  Public route
                </div>
                <div className="mt-2 font-medium">{query.data?.publicUrl ?? `/agents/${form.slug}`}</div>
              </div>
              <div className="rounded-xl border bg-muted/30 p-4">
                <div className="text-xs uppercase tracking-[0.28em] text-muted-foreground">
                  Home Value route
                </div>
                <div className="mt-2 font-medium">
                  {query.data?.homeValueUrl ?? `/agents/${form.slug}/home-value`}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent captured leads</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {query.data?.recentLeads.length ? (
                query.data.recentLeads.map((lead) => (
                  <div className="rounded-xl border p-4" key={lead.id}>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-medium">{lead.name || "Anonymous lead"}</div>
                        <div className="text-sm text-muted-foreground">
                          {lead.email || lead.phone || "No direct contact stored"}
                        </div>
                      </div>
                      <Badge variant="secondary">{lead.source}</Badge>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span>score: {lead.score}</span>
                      <span>intent: {lead.intent || "n/a"}</span>
                      <span>area: {lead.area || "n/a"}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
                  No agent-site leads yet. Once the public page is live, chat and form leads will
                  appear here.
                </div>
              )}
            </CardContent>
          </Card>

          {previewProfile ? (
            <div className="overflow-hidden rounded-[32px] border bg-background shadow-sm">
              <AgentSiteShell interactive={false} preview profile={previewProfile} />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
