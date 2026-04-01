"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useT } from "@/i18n";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Copy,
  Lightbulb,
  Mail,
  Mailbox,
  MessageSquare,
  Phone,
  Shield,
  Target,
} from "lucide-react";
import { toast } from "sonner";
import type { ProspectBrief } from "@/lib/db/schema";

type PitchAngle = {
  id: string;
  name: string;
  confidence: number;
  script: string;
};

type OutreachScripts = {
  call: string;
  sms: string;
  email: string;
  postcard: string;
};

type ObjectionHandler = {
  objection: string;
  rebuttal: string;
};

type Diagnosis = {
  summary?: string;
  reasons?: string[];
  evidence?: string[];
};

type BriefData = ProspectBrief & {
  feedback?: unknown;
};

function copyToClipboard(text: string, label: string) {
  navigator.clipboard.writeText(text);
  toast.success(`${label} copied`);
}

function confidenceColor(confidence: number): string {
  if (confidence >= 80) return "bg-emerald-100 text-emerald-800 border-emerald-200";
  if (confidence >= 60) return "bg-amber-100 text-amber-800 border-amber-200";
  return "bg-stone-100 text-stone-700 border-stone-200";
}

export function BriefDisplay({ brief }: { brief: BriefData }) {
  const { t } = useT();
  const listingData = brief.listingData as Record<string, unknown> | null;
  const diagnosis = brief.diagnosis as Diagnosis | null;
  const pitchAngles = (brief.pitchAngles ?? []) as PitchAngle[];
  const outreach = brief.outreachScripts as OutreachScripts | null;
  const objections = (brief.objectionHandlers ?? []) as ObjectionHandler[];

  return (
    <div className="flex flex-col gap-4">
      {/* Listing Header */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-lg">{brief.address ?? brief.listingId}</CardTitle>
              <CardDescription className="flex flex-wrap gap-2 mt-1">
                {listingData?.standardStatus ? (
                  <Badge variant="outline">{String(listingData.standardStatus)}</Badge>
                ) : null}
                {listingData?.listPrice ? (
                  <span>${Number(listingData.listPrice).toLocaleString()}</span>
                ) : null}
                {listingData?.daysOnMarket != null ? (
                  <span>{String(listingData.daysOnMarket)} DOM</span>
                ) : null}
                {listingData?.propertyType ? (
                  <span>{String(listingData.propertyType)}</span>
                ) : null}
                {listingData?.bedroomsTotal != null && listingData?.bathroomsTotalInteger != null ? (
                  <span>
                    {String(listingData.bedroomsTotal)}bd/{String(listingData.bathroomsTotalInteger)}ba
                  </span>
                ) : null}
                {listingData?.livingArea ? (
                  <span>{String(listingData.livingArea)} sqft</span>
                ) : null}
              </CardDescription>
            </div>
            <Badge variant="secondary" className="capitalize">
              {brief.tone}
            </Badge>
          </div>
        </CardHeader>
      </Card>

      {/* Diagnosis */}
      {diagnosis && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              {t("prospecting.diagnosis")}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {diagnosis.summary && (
              <p className="text-sm font-medium">{diagnosis.summary}</p>
            )}
            {diagnosis.reasons && diagnosis.reasons.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1.5">
                  {t("prospecting.reasons")}
                </p>
                <ul className="space-y-1">
                  {diagnosis.reasons.map((reason, i) => (
                    <li key={i} className="text-sm flex gap-2">
                      <span className="text-amber-500 mt-0.5">&#x2022;</span>
                      {reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {diagnosis.evidence && diagnosis.evidence.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1.5">
                  {t("prospecting.evidence")}
                </p>
                <ul className="space-y-1">
                  {diagnosis.evidence.map((ev, i) => (
                    <li key={i} className="text-sm flex gap-2 text-muted-foreground">
                      <BarChart3 className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                      {ev}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Pitch Angles */}
      {pitchAngles.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-primary" />
              {t("prospecting.pitchAngles")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              {pitchAngles.map((angle, i) => (
                <div
                  key={angle.id}
                  className="p-3 rounded-lg border bg-card"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {i === 0 && (
                        <Badge className="bg-primary text-xs">
                          {t("prospecting.bestFit")}
                        </Badge>
                      )}
                      <span className="font-medium text-sm">{angle.name}</span>
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-xs ${confidenceColor(angle.confidence)}`}
                    >
                      {angle.confidence}%
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{angle.script}</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2 h-7 text-xs"
                    onClick={() => copyToClipboard(angle.script, "Script")}
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    {t("prospecting.copyScript")}
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Outreach Scripts */}
      {outreach && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Phone className="h-4 w-4 text-primary" />
              {t("prospecting.outreachScripts")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="call" className="w-full">
              <TabsList className="grid w-full grid-cols-4 h-8">
                <TabsTrigger value="call" className="text-xs gap-1">
                  <Phone className="h-3 w-3" />
                  {t("prospecting.call")}
                </TabsTrigger>
                <TabsTrigger value="sms" className="text-xs gap-1">
                  <MessageSquare className="h-3 w-3" />
                  SMS
                </TabsTrigger>
                <TabsTrigger value="email" className="text-xs gap-1">
                  <Mail className="h-3 w-3" />
                  Email
                </TabsTrigger>
                <TabsTrigger value="postcard" className="text-xs gap-1">
                  <Mailbox className="h-3 w-3" />
                  {t("prospecting.postcard")}
                </TabsTrigger>
              </TabsList>
              {(["call", "sms", "email", "postcard"] as const).map((channel) => (
                <TabsContent key={channel} value={channel}>
                  <div className="relative p-3 rounded-lg border bg-muted/30 mt-2">
                    <p className="text-sm whitespace-pre-wrap pr-8">
                      {outreach[channel]}
                    </p>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-2 right-2 h-7 w-7"
                      onClick={() =>
                        copyToClipboard(outreach[channel], channel)
                      }
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>
      )}

      {/* Objection Handlers */}
      {objections.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              {t("prospecting.objectionHandlers")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              {objections.map((handler, i) => (
                <div key={i} className="p-3 rounded-lg border bg-card">
                  <p className="text-sm font-medium text-destructive/80 mb-1.5">
                    &ldquo;{handler.objection}&rdquo;
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {handler.rebuttal}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
