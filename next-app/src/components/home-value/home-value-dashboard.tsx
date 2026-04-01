"use client";

import Link from "next/link";
import { BarChart3, ExternalLink, FileSearch, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useT } from "@/i18n";
import { formatCurrency } from "@/lib/format";
import { trpc } from "@/lib/trpc";
import { CampaignLinksSection } from "./campaign-links-section";

export function HomeValueDashboard() {
  const { t, locale } = useT();
  const query = trpc.homeValue.getDashboard.useQuery();

  if (query.isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="text-sm text-muted-foreground">{t("homeValueDashboard.loading")}</div>
      </div>
    );
  }

  return (
    <div className="space-y-8 px-6 py-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.32em] text-muted-foreground">
            {t("homeValueDashboard.eyebrow")}
          </div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">{t("homeValueDashboard.heroTitle")}</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            {t("homeValueDashboard.heroDescription")}
          </p>
        </div>
        {query.data?.publicUrl ? (
          <Button asChild>
            <Link href={query.data.publicUrl} target="_blank">
              {t("homeValueDashboard.openPublicFunnel")}
              <ExternalLink className="h-4 w-4" />
            </Link>
          </Button>
        ) : (
          <Button asChild variant="outline">
            <Link href="/agent-site">{t("homeValueDashboard.configureFirst")}</Link>
          </Button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-2xl bg-cyan-100 p-3 text-cyan-700">
              <FileSearch className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm text-muted-foreground">{t("homeValueDashboard.valuationRequests30d")}</div>
              <div className="text-2xl font-semibold">
                {query.data?.stats.valuationRequests ?? 0}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-2xl bg-amber-100 p-3 text-amber-700">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm text-muted-foreground">{t("homeValueDashboard.capturedSellerLeads30d")}</div>
              <div className="text-2xl font-semibold">{query.data?.stats.capturedLeads ?? 0}</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-2xl bg-violet-100 p-3 text-violet-700">
              <BarChart3 className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm text-muted-foreground">{t("homeValueDashboard.primaryRoute")}</div>
              <div className="text-sm font-medium">
                {query.data?.publicUrl ?? t("homeValueDashboard.setupFirst")}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <CampaignLinksSection />

      <div className="grid gap-8 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>{t("homeValueDashboard.recentValuationRequests")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {query.data?.recentRuns.length ? (
              query.data.recentRuns.map((run) => (
                <div className="rounded-xl border p-4" key={run.id}>
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="font-medium">{run.address}</div>
                      <div className="mt-1 text-sm text-muted-foreground">{run.summary}</div>
                    </div>
                    <Badge variant="secondary">
                      {run.estimatedValue ? formatCurrency(run.estimatedValue, locale) : t("homeValueDashboard.estimateReady")}
                    </Badge>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
                {t("homeValueDashboard.noValuationRequests")}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t("homeValueDashboard.recentSellerLeads")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {query.data?.recentSellerLeads.length ? (
                query.data.recentSellerLeads.map((lead) => (
                  <div className="rounded-xl border p-4" key={lead.id}>
                    <div className="font-medium">{lead.name || t("homeValueDashboard.unnamedSellerLead")}</div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {lead.email || lead.phone || t("homeValueDashboard.noDirectContact")}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span>{lead.area || lead.addressLine1 || t("homeValueDashboard.areaPending")}</span>
                      <span>{t("homeValueDashboard.score")}: {lead.score}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
                  {t("homeValueDashboard.noSellerLeads")}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("homeValueDashboard.operatingNotes")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm leading-7 text-muted-foreground">
              <p>{t("homeValueDashboard.operatingNote1")}</p>
              <p>{t("homeValueDashboard.operatingNote2")}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
