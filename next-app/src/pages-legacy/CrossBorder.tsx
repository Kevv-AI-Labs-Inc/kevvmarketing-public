// legacy page — incrementally migrated
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useT } from "@/i18n";
import type { MessageKey } from "@/i18n";
import {
  ArrowLeftRight,
  Banknote,
  Building2,
  Calculator,
  ClipboardCheck,
  CreditCard,
  FileText,
  Landmark,
  Plane,
  Receipt,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { useState } from "react";

const DEFAULT_RATE = 7.0;

function formatCurrency(amount: number, currency: "USD" | "CNY"): string {
  return new Intl.NumberFormat(currency === "USD" ? "en-US" : "zh-CN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

type ComplianceCard = {
  id: string;
  icon: typeof Plane;
  color: string;
};

const COMPLIANCE_CARDS: ComplianceCard[] = [
  { id: "itin", icon: CreditCard, color: "border-blue-200 bg-blue-50" },
  { id: "wireTransfer", icon: Landmark, color: "border-amber-200 bg-amber-50" },
  { id: "firpta", icon: Receipt, color: "border-red-200 bg-red-50" },
  { id: "mortgage", icon: Building2, color: "border-emerald-200 bg-emerald-50" },
];

type ProcessStep = {
  id: string;
  icon: typeof Plane;
};

const PROCESS_STEPS: ProcessStep[] = [
  { id: "step1", icon: ClipboardCheck },
  { id: "step2", icon: ShieldCheck },
  { id: "step3", icon: Landmark },
  { id: "step4", icon: FileText },
  { id: "step5", icon: Banknote },
];

export default function CrossBorder() {
  const { t, locale } = useT();

  // Currency converter
  const [usdAmount, setUsdAmount] = useState("1000000");
  const [rate] = useState(DEFAULT_RATE);
  const [direction, setDirection] = useState<"usd-to-cny" | "cny-to-usd">("usd-to-cny");

  const parsedAmount = Number(usdAmount.replace(/,/g, "")) || 0;
  const converted = direction === "usd-to-cny"
    ? parsedAmount * rate
    : parsedAmount / rate;

  const fromCurrency = direction === "usd-to-cny" ? "USD" : "CNY";
  const toCurrency = direction === "usd-to-cny" ? "CNY" : "USD";

  const toggleDirection = () => {
    setDirection((d) => (d === "usd-to-cny" ? "cny-to-usd" : "usd-to-cny"));
  };

  // Sample RMB listings
  const sampleListings = [
    {
      id: "1",
      address: locale === "zh" ? "法拉盛 · 39大道 公寓" : "Flushing · 39th Ave Condo",
      usd: 580000,
      beds: 2,
      baths: 1,
      sqft: 850,
    },
    {
      id: "2",
      address: locale === "zh" ? "曼哈顿下东区 · 1BR" : "Manhattan LES · 1BR",
      usd: 920000,
      beds: 1,
      baths: 1,
      sqft: 650,
    },
    {
      id: "3",
      address: locale === "zh" ? "布鲁克林 Sunset Park · 3BR" : "Brooklyn Sunset Park · 3BR",
      usd: 1250000,
      beds: 3,
      baths: 2,
      sqft: 1400,
    },
    {
      id: "4",
      address: locale === "zh" ? "尔湾 · 学区房 4BR" : "Irvine · School District 4BR",
      usd: 1680000,
      beds: 4,
      baths: 3,
      sqft: 2200,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-serif tracking-tight flex items-center gap-2">
          <Plane className="h-6 w-6 text-primary" />
          {t("crossBorder.title")}
        </h1>
        <p className="text-muted-foreground mt-1">
          {t("crossBorder.subtitle")}
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* ─── Currency Converter ─── */}
        <div className="xl:col-span-1 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Calculator className="h-4 w-4" />
                {t("crossBorder.converterTitle")}
              </CardTitle>
              <CardDescription>
                {t("crossBorder.converterDescription")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-xs text-muted-foreground">{fromCurrency}</label>
                <Input
                  type="text"
                  value={usdAmount}
                  onChange={(e) => setUsdAmount(e.target.value)}
                  className="text-lg font-semibold tabular-nums"
                />
              </div>

              <div className="flex items-center justify-center">
                <Button variant="ghost" size="icon" onClick={toggleDirection} className="rounded-full">
                  <ArrowLeftRight className="h-4 w-4" />
                </Button>
              </div>

              <div className="rounded-xl bg-primary/5 border border-primary/20 p-4 text-center">
                <p className="text-xs text-muted-foreground mb-1">{toCurrency}</p>
                <p className="text-2xl font-bold tracking-tight text-primary tabular-nums">
                  {formatCurrency(converted, toCurrency as "USD" | "CNY")}
                </p>
              </div>

              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <RefreshCw className="h-3 w-3" />
                  {t("crossBorder.rateLabel")}: 1 USD = {rate} CNY
                </span>
                <Badge variant="secondary" className="text-[10px]">
                  {t("crossBorder.rateNote")}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* ─── Purchase Process ─── */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t("crossBorder.processTitle")}</CardTitle>
              <CardDescription>{t("crossBorder.processDescription")}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {PROCESS_STEPS.map((step, idx) => (
                  <div key={step.id} className="flex items-start gap-3">
                    <div className="flex flex-col items-center">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                        {idx + 1}
                      </div>
                      {idx < PROCESS_STEPS.length - 1 && (
                        <div className="w-px h-4 bg-border mt-1" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{t(`crossBorder.process.${step.id}.title` as MessageKey)}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{t(`crossBorder.process.${step.id}.desc` as MessageKey)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ─── RMB Listings + Compliance ─── */}
        <div className="xl:col-span-2 space-y-4">
          {/* RMB Listings */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Banknote className="h-4 w-4" />
                {t("crossBorder.rmbListingsTitle")}
              </CardTitle>
              <CardDescription>{t("crossBorder.rmbListingsDescription")}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {sampleListings.map((listing) => (
                  <div key={listing.id} className="rounded-xl border p-4 space-y-2 hover:border-primary/30 transition-colors">
                    <p className="font-medium text-sm">{listing.address}</p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-lg font-bold text-primary tabular-nums">
                        {formatCurrency(listing.usd, "USD")}
                      </span>
                      <span className="text-sm text-muted-foreground tabular-nums">
                        ≈ ¥{(listing.usd * rate / 10000).toFixed(0)}{locale === "zh" ? "万" : "0k"}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{listing.beds} {t("crossBorder.beds")}</span>
                      <span>{listing.baths} {t("crossBorder.baths")}</span>
                      <span>{listing.sqft.toLocaleString()} sqft</span>
                    </div>
                    <Button variant="outline" size="sm" className="w-full mt-1 text-xs">
                      {t("crossBorder.viewDetail")}
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Compliance Cards */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" />
                {t("crossBorder.complianceTitle")}
              </CardTitle>
              <CardDescription>{t("crossBorder.complianceDescription")}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {COMPLIANCE_CARDS.map((card) => {
                  const Icon = card.icon;
                  return (
                    <div key={card.id} className={`rounded-xl border p-4 ${card.color}`}>
                      <div className="flex items-center gap-2 mb-2">
                        <Icon className="h-4 w-4" />
                        <span className="font-semibold text-sm">{t(`crossBorder.compliance.${card.id}.title` as MessageKey)}</span>
                      </div>
                      <p className="text-xs leading-relaxed opacity-80">{t(`crossBorder.compliance.${card.id}.desc` as MessageKey)}</p>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
