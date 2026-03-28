"use client";

import Link from "next/link";
import { BarChart3, ExternalLink, FileSearch, Home, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function HomeValueDashboard() {
  const query = trpc.homeValue.getDashboard.useQuery();

  if (query.isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="text-sm text-muted-foreground">Loading Home Value dashboard...</div>
      </div>
    );
  }

  return (
    <div className="space-y-8 px-6 py-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.32em] text-muted-foreground">
            Home Value
          </div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Seller valuation funnel</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Public-facing valuation experience that routes homeowners into `valuation_runs`,
            unified `contacts`, agent insights, and drip enrollments.
          </p>
        </div>
        {query.data?.publicUrl ? (
          <Button asChild>
            <Link href={query.data.publicUrl} target="_blank">
              Open public funnel
              <ExternalLink className="h-4 w-4" />
            </Link>
          </Button>
        ) : (
          <Button asChild variant="outline">
            <Link href="/agent-site">Configure agent site first</Link>
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
              <div className="text-sm text-muted-foreground">Valuation requests (30d)</div>
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
              <div className="text-sm text-muted-foreground">Captured seller leads (30d)</div>
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
              <div className="text-sm text-muted-foreground">Primary route</div>
              <div className="text-sm font-medium">
                {query.data?.publicUrl ?? "Set up /agent-site first"}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-8 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Recent valuation requests</CardTitle>
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
                      {run.estimatedValue ? formatMoney(run.estimatedValue) : "Estimate ready"}
                    </Badge>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
                No valuation requests yet. Publish the funnel and drive traffic from the new agent
                site CTA.
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Recent seller leads</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {query.data?.recentSellerLeads.length ? (
                query.data.recentSellerLeads.map((lead) => (
                  <div className="rounded-xl border p-4" key={lead.id}>
                    <div className="font-medium">{lead.name || "Unnamed seller lead"}</div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {lead.email || lead.phone || "No direct contact method"}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span>{lead.area || lead.addressLine1 || "Area pending"}</span>
                      <span>score: {lead.score}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
                  No seller leads captured yet.
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Operating notes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm leading-7 text-muted-foreground">
              <p>
                `CMA Studio` remains your internal pricing workspace. `Home Value` is public and
                seller-acquisition oriented.
              </p>
              <p>
                Every successful gate submission writes to `contacts`, links the row back to
                `valuation_runs`, then creates an `agent_insight` and checks active `new_lead`
                drip campaigns.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
