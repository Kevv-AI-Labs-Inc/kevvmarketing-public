"use client";

import Link from "next/link";
import { ArrowRight, Building2, CalendarClock, Globe2, Mail, MapPin, Phone, Sparkles, Star } from "lucide-react";

import { AgentSiteContactForm } from "@/components/agent-site/agent-site-contact-form";
import { AgentSiteChatWidget } from "@/components/agent-site/agent-site-chat-widget";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n";
import type { AgentProfile } from "@/lib/db/schema";

type AgentSiteShellProps = {
  profile: AgentProfile;
  preview?: boolean;
  interactive?: boolean;
};

const templateTheme = {
  classic: {
    page: "bg-stone-950 text-stone-100",
    hero: "from-[#a37d52] via-[#20150d] to-[#090806]",
    panel: "border-white/10 bg-white/5",
    accent: "bg-amber-200 text-stone-950 hover:bg-amber-100",
    muted: "text-stone-300/80",
  },
  modern: {
    page: "bg-slate-950 text-slate-50",
    hero: "from-sky-600 via-slate-950 to-slate-900",
    panel: "border-white/10 bg-white/5",
    accent: "bg-sky-400 text-slate-950 hover:bg-sky-300",
    muted: "text-slate-300/80",
  },
  bold: {
    page: "bg-[#150f18] text-white",
    hero: "from-fuchsia-600 via-orange-500 to-yellow-300",
    panel: "border-white/10 bg-white/5",
    accent: "bg-white text-[#1d1020] hover:bg-white/90",
    muted: "text-white/75",
  },
  elegant: {
    page: "bg-[#140f14] text-rose-50",
    hero: "from-rose-300/70 via-fuchsia-800/40 to-[#140f14]",
    panel: "border-white/10 bg-white/6 backdrop-blur",
    accent: "bg-rose-200 text-[#24121f] hover:bg-white",
    muted: "text-rose-100/75",
  },
  minimal: {
    page: "bg-[#f3efe7] text-[#181410]",
    hero: "from-[#ede7de] via-[#ddd4c6] to-[#bda587]",
    panel: "border-black/8 bg-white/75",
    accent: "bg-[#181410] text-[#f7f2eb] hover:bg-black",
    muted: "text-black/65",
  },
  urban: {
    page: "bg-[#07111c] text-cyan-50",
    hero: "from-cyan-400 via-[#07111c] to-[#051520]",
    panel: "border-cyan-400/20 bg-cyan-400/5",
    accent: "bg-cyan-300 text-[#031018] hover:bg-cyan-200",
    muted: "text-cyan-100/75",
  },
  luxury: {
    page: "bg-black text-stone-100",
    hero: "from-[#7b5b3a] via-black to-[#1d1108]",
    panel: "border-white/10 bg-white/5",
    accent: "bg-[#d9bc88] text-black hover:bg-[#edd6ac]",
    muted: "text-stone-300/75",
  },
} as const;

export function AgentSiteShell({
  profile,
  preview = false,
  interactive = true,
}: AgentSiteShellProps) {
  const { t } = useT();
  const theme =
    templateTheme[(profile.templateId as keyof typeof templateTheme) ?? "classic"] ??
    templateTheme.classic;
  const serviceAreas = profile.serviceAreas ?? [];
  const specialties = profile.specialties ?? [];
  const languages = profile.languages ?? [];
  const transactions = profile.transactions ?? [];
  const testimonials = profile.testimonials ?? [];
  const awards = profile.awards ?? [];
  const visibility = profile.visibilitySettings ?? {
    showPhone: true,
    showEmail: true,
    showTransactions: true,
    showAwards: true,
    showTestimonials: true,
    showAddress: true,
  };

  return (
    <div className={cn("min-h-[100dvh] overflow-x-hidden", theme.page)}>
      <div className={cn("relative isolate overflow-hidden bg-gradient-to-br", theme.hero)}>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.15),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.08),transparent_24%)]" />
        <div className="relative mx-auto max-w-7xl px-6 py-8 lg:px-10">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-[0.36em] text-white/50">
                {profile.brokerage || "Kevv Marketing"}
              </div>
              <div className="mt-2 text-2xl font-semibold tracking-tight">{profile.name}</div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{profile.templateId ?? "classic"} {t("agentSiteShell.template")}</Badge>
              <Badge variant="secondary">{profile.tier}</Badge>
            </div>
          </div>

          <div className="mt-14 grid gap-8 lg:grid-cols-[1.3fr_0.9fr]">
            <div className="space-y-8">
              <div className="space-y-5">
                <div className="flex flex-wrap gap-2">
                  {serviceAreas.slice(0, 4).map((area) => (
                    <Badge className="bg-white/10 text-white" key={area}>
                      {area}
                    </Badge>
                  ))}
                </div>
                <h1 className="max-w-4xl text-5xl font-semibold tracking-tight sm:text-6xl">
                  {profile.title || t("agentSiteShell.aiFallbackTitle")}
                </h1>
                <p className={cn("max-w-3xl text-lg leading-8", theme.muted)}>
                  {profile.bio || t("agentSiteShell.aiFallbackBio")}
                </p>
                <div className="flex flex-wrap gap-3">
                  <Button asChild className={theme.accent}>
                    <Link href={`/agents/${profile.slug}/home-value`}>
                      {t("agentSiteShell.getMyHomeValue")}
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                  {profile.bookingUrl ? (
                    <Button asChild variant="outline" className="border-white/20 bg-transparent text-current hover:bg-white/10">
                      <a href={profile.bookingUrl} rel="noreferrer" target="_blank">
                        {t("agentSiteShell.bookStrategyCall")}
                      </a>
                    </Button>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <Card className={theme.panel}>
                  <CardContent className="space-y-2 p-5">
                    <div className="text-xs uppercase tracking-[0.28em] text-white/45">{t("agentSiteShell.experience")}</div>
                    <div className="text-2xl font-semibold">
                      {profile.yearsExperience ? `${profile.yearsExperience}+ ${t("agentSiteShell.yrs")}` : t("agentSiteShell.highTouch")}
                    </div>
                    <div className={theme.muted}>{t("agentSiteShell.experienceDescription")}</div>
                  </CardContent>
                </Card>
                <Card className={theme.panel}>
                  <CardContent className="space-y-2 p-5">
                    <div className="text-xs uppercase tracking-[0.28em] text-white/45">{t("agentSiteShell.languagesLabel")}</div>
                    <div className="text-2xl font-semibold">{languages.length || 1}</div>
                    <div className={theme.muted}>{languages.join(" / ") || "English"}</div>
                  </CardContent>
                </Card>
                <Card className={theme.panel}>
                  <CardContent className="space-y-2 p-5">
                    <div className="text-xs uppercase tracking-[0.28em] text-white/45">{t("agentSiteShell.liveCtas")}</div>
                    <div className="text-2xl font-semibold">3</div>
                    <div className={theme.muted}>{t("agentSiteShell.ctasDescription")}</div>
                  </CardContent>
                </Card>
              </div>
            </div>

            <Card className={cn("overflow-hidden", theme.panel)}>
              <CardContent className="p-0">
                <div className="relative aspect-[4/4.6] overflow-hidden">
                  {profile.photoUrl ? (
                    <img
                      alt={profile.name}
                      className="h-full w-full object-cover"
                      src={profile.photoUrl}
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center bg-white/10 text-6xl font-semibold">
                      {profile.name
                        .split(" ")
                        .slice(0, 2)
                        .map((part) => part[0])
                        .join("")}
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-6">
                    <div className="text-xs uppercase tracking-[0.28em] text-white/50">
                      {t("agentSiteShell.publicFunnel")}
                    </div>
                    <div className="mt-2 text-2xl font-semibold">{profile.name}</div>
                    <div className={cn("mt-1 flex flex-col gap-2 text-sm", theme.muted)}>
                      {visibility.showPhone && profile.phone ? (
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4" />
                          {profile.phone}
                        </div>
                      ) : null}
                      {visibility.showEmail ? (
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4" />
                          {profile.email}
                        </div>
                      ) : null}
                      {visibility.showAddress && profile.officeAddress ? (
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4" />
                          {profile.officeAddress}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-16 lg:px-10">
        <div className="grid gap-10 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-10">
            <section className="grid gap-6 md:grid-cols-2">
              <Card className={theme.panel}>
                <CardContent className="space-y-4 p-6">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-[0.28em] text-white/45">
                    <Building2 className="h-4 w-4" />
                    {t("agentSiteShell.positioning")}
                  </div>
                  <h2 className="text-2xl font-semibold">{t("agentSiteShell.whyClients")}</h2>
                  <p className={theme.muted}>
                    {t("agentSiteShell.whyClientsDescription")}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {specialties.slice(0, 6).map((specialty) => (
                      <Badge className="bg-white/10 text-current" key={specialty}>
                        {specialty}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
              <Card className={theme.panel}>
                <CardContent className="space-y-4 p-6">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-[0.28em] text-white/45">
                    <CalendarClock className="h-4 w-4" />
                    {t("agentSiteShell.conversionPath")}
                  </div>
                  <h2 className="text-2xl font-semibold">{t("agentSiteShell.threeEntryPoints")}</h2>
                  <div className={cn("space-y-3 text-sm", theme.muted)}>
                    <p>{t("agentSiteShell.step1")}</p>
                    <p>{t("agentSiteShell.step2")}</p>
                    <p>{t("agentSiteShell.step3")}</p>
                  </div>
                </CardContent>
              </Card>
            </section>

            {visibility.showTransactions && transactions.length > 0 ? (
              <section className="space-y-5">
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.28em] text-white/45">
                  <Sparkles className="h-4 w-4" />
                  {t("agentSiteShell.recentTransactions")}
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  {transactions.slice(0, 6).map((transaction, index) => (
                    <Card className={theme.panel} key={`${transaction.address}-${index}`}>
                      <CardContent className="space-y-2 p-6">
                        <div className="text-lg font-semibold">{transaction.address}</div>
                        <div className={theme.muted}>{transaction.city}</div>
                        <div className="flex items-center justify-between pt-3 text-sm">
                          <span className="rounded-full bg-white/10 px-3 py-1">{transaction.type}</span>
                          <span className="font-medium">{transaction.price}</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            ) : null}

            {visibility.showTestimonials && testimonials.length > 0 ? (
              <section className="space-y-5">
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.28em] text-white/45">
                  <Star className="h-4 w-4" />
                  {t("agentSiteShell.testimonialsLabel")}
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  {testimonials.slice(0, 4).map((testimonial, index) => (
                    <Card className={theme.panel} key={`${testimonial.name}-${index}`}>
                      <CardContent className="space-y-4 p-6">
                        <div className="flex text-amber-300">
                          {Array.from({ length: testimonial.rating ?? 5 }).map((_, starIndex) => (
                            <Star className="h-4 w-4 fill-current" key={starIndex} />
                          ))}
                        </div>
                        <p className="text-base leading-7">{testimonial.text}</p>
                        <div className={theme.muted}>{testimonial.name}</div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            ) : null}

            {visibility.showAwards && awards.length > 0 ? (
              <section className="space-y-5">
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.28em] text-white/45">
                  <Globe2 className="h-4 w-4" />
                  {t("agentSiteShell.recognition")}
                </div>
                <div className="flex flex-wrap gap-3">
                  {awards.map((award) => (
                    <Badge className="bg-white/10 px-4 py-2 text-sm text-current" key={award}>
                      {award}
                    </Badge>
                  ))}
                </div>
              </section>
            ) : null}
          </div>

          <div className="space-y-6">
            <Card className={theme.panel}>
              <CardContent className="space-y-5 p-6">
                <div className="text-xs uppercase tracking-[0.28em] text-white/45">
                  {t("agentSiteShell.sellerCta")}
                </div>
                <h2 className="text-2xl font-semibold">{t("agentSiteShell.sellerCtaTitle")}</h2>
                <p className={theme.muted}>
                  {t("agentSiteShell.sellerCtaDescription")}
                </p>
                <Button asChild className={theme.accent}>
                  <Link href={`/agents/${profile.slug}/home-value`}>{t("agentSiteShell.openHomeValueFunnel")}</Link>
                </Button>
              </CardContent>
            </Card>

            {interactive ? (
              <Card className={theme.panel}>
                <CardContent className="space-y-5 p-6">
                  <div className="text-xs uppercase tracking-[0.28em] text-white/45">
                    {t("agentSiteShell.directInquiry")}
                  </div>
                  <h2 className="text-2xl font-semibold">{t("agentSiteShell.contactAgent", { name: profile.name.split(" ")[0] })}</h2>
                  <p className={theme.muted}>
                    {t("agentSiteShell.inquiryDescription")}
                  </p>
                  <AgentSiteContactForm
                    accentClassName={theme.accent}
                    agentName={profile.name}
                    agentSlug={profile.slug}
                  />
                </CardContent>
              </Card>
            ) : (
              <Card className={theme.panel}>
                <CardContent className="space-y-4 p-6">
                  <div className="text-xs uppercase tracking-[0.28em] text-white/45">
                    {t("agentSiteShell.previewNotes")}
                  </div>
                  <p className={theme.muted}>
                    {t("agentSiteShell.previewDescription")}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {!preview && interactive ? (
        <AgentSiteChatWidget
          accentClassName={theme.accent}
          agentName={profile.name}
          agentSlug={profile.slug}
        />
      ) : null}
    </div>
  );
}
