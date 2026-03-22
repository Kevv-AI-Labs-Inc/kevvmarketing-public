import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Locale } from "@/i18n";
import {
  getCapabilitiesByCategory,
  getCapabilityAlignmentLabel,
  getCapabilityStatusLabel,
  getLocalizedText,
  marketingCapabilityCategories,
  marketingExtensions,
  type MarketingCapabilityAlignment,
  type MarketingCapabilityStatus,
} from "@/lib/marketing-capabilities";
import { cn } from "@/lib/utils";

function statusClassName(status: MarketingCapabilityStatus) {
  switch (status) {
    case "ready":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "partial":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "planned":
      return "border-slate-200 bg-slate-100 text-slate-600";
  }
}

function alignmentClassName(alignment: MarketingCapabilityAlignment) {
  switch (alignment) {
    case "matched":
      return "border-emerald-200 bg-emerald-50/70 text-emerald-700";
    case "adapted":
      return "border-sky-200 bg-sky-50 text-sky-700";
    case "gap":
      return "border-rose-200 bg-rose-50 text-rose-700";
  }
}

export function MarketingCapabilityBoard({ locale }: { locale: Locale }) {
  return (
    <div className="space-y-6">
      {marketingCapabilityCategories.map((category) => {
        const items = getCapabilitiesByCategory(category.id);
        return (
          <div key={category.id} className="space-y-3">
            <div className="flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
              <div>
                <h3 className="text-lg font-semibold">
                  {getLocalizedText(locale, category.label)}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {getLocalizedText(locale, category.description)}
                </p>
              </div>
              <Badge variant="outline" className="w-fit">
                {items.length} {locale === "zh" ? "项能力" : "capabilities"}
              </Badge>
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              {items.map((item) => (
                <Card
                  key={item.id}
                  className="border-border/70 bg-card/90 shadow-sm transition-shadow hover:shadow-md"
                >
                  <CardHeader className="gap-3 pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/8 text-primary">
                          <item.icon className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                            {locale === "zh" ? `功能 ${item.order}` : `Function ${item.order}`}
                          </p>
                          <CardTitle className="mt-1 text-lg">
                            {getLocalizedText(locale, item.label)}
                          </CardTitle>
                        </div>
                      </div>
                      <div className="flex flex-wrap justify-end gap-2">
                        <Badge
                          variant="outline"
                          className={cn("border", statusClassName(item.status))}
                        >
                          {getCapabilityStatusLabel(locale, item.status)}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={cn("border", alignmentClassName(item.alignment))}
                        >
                          {getCapabilityAlignmentLabel(locale, item.alignment)}
                        </Badge>
                      </div>
                    </div>
                    <CardDescription className="text-sm leading-6">
                      {getLocalizedText(locale, item.description)}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="rounded-xl border border-border/60 bg-muted/35 p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                        {locale === "zh" ? "当前承载模块" : "Current Module"}
                      </p>
                      <p className="mt-2 text-sm font-medium text-foreground">
                        {getLocalizedText(locale, item.currentModule)}
                      </p>
                    </div>
                    <p className="text-sm leading-6 text-muted-foreground">
                      {getLocalizedText(locale, item.compareNote)}
                    </p>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs text-muted-foreground">
                        {item.route
                          ? locale === "zh"
                            ? "点击进入现有模块"
                            : "Open the mapped module"
                          : locale === "zh"
                            ? "当前没有可直接打开的模块"
                            : "No routed module yet"}
                      </span>
                      {item.route ? (
                        <Button asChild variant="outline" size="sm">
                          <Link href={item.route}>
                            {item.routeLabel
                              ? getLocalizedText(locale, item.routeLabel)
                              : locale === "zh"
                                ? "打开模块"
                                : "Open module"}
                            <ArrowRight className="h-4 w-4" />
                          </Link>
                        </Button>
                      ) : (
                        <Badge variant="outline">
                          {locale === "zh" ? "规划中" : "Planned"}
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function MarketingExtensionGrid({ locale }: { locale: Locale }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {marketingExtensions.map((module) => (
        <Card key={module.id} className="border-border/70 bg-card/90 shadow-sm">
          <CardContent className="flex h-full flex-col gap-4 p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/8 text-primary">
                <module.icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="font-medium text-foreground">
                  {getLocalizedText(locale, module.label)}
                </p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  {getLocalizedText(locale, module.description)}
                </p>
              </div>
            </div>
            <div className="mt-auto flex justify-end">
              <Button asChild variant="ghost" size="sm">
                <Link href={module.path}>
                  {locale === "zh" ? "进入模块" : "Open module"}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
