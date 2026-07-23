import { invokeLLM, type InvokeResult } from "@/server/_core/llm";
import { ENV } from "@/server/_core/env";
import { searchListings } from "@/server/clients/listingDataClient";
import type {
  ListingData,
  SearchFilters,
} from "@/server/clients/types";

// ─── Public Types ──────────────────────────────────────────────

export type AreaMagnetScopeType = "zip" | "neighborhood" | "building";
export type AreaMagnetType =
  | "spring_market"
  | "school_move_up"
  | "off_market_brief"
  | "renovation_roi";
export type AreaMagnetAudience = "seller" | "buyer" | "investor" | "move_up";
export type AreaMagnetTone = "advisory" | "urgent" | "luxury";
export type AreaMagnetCaptureField = "email" | "phone";

export type GenerateAreaMagnetInput = {
  scopeType: AreaMagnetScopeType;
  query: string;
  magnetType: AreaMagnetType;
  audience: AreaMagnetAudience;
  captureFields: AreaMagnetCaptureField[];
  tone: AreaMagnetTone;
};

// ─── Internal Snapshot (enriched) ──────────────────────────────

type PriceRangeBucket = { label: string; count: number };

type MarketSnapshot = {
  scopeType: AreaMagnetScopeType;
  scopeQuery: string;
  scopeLabel: string;
  magnetType: AreaMagnetType;
  audience: AreaMagnetAudience;
  tone: AreaMagnetTone;
  activeCount: number;
  soldCount: number;
  activeMedianPrice: number | null;
  soldMedianPrice: number | null;
  averageDom: number | null;
  soldToListRatio: number | null;
  // P0-2: $/sqft metrics
  activePricePerSqft: number | null;
  soldPricePerSqft: number | null;
  // P0-2: price range distribution
  priceRangeDistribution: PriceRangeBucket[];
  propertyTypeMix: Array<{ label: string; count: number }>;
  featuredListings: Array<{
    listingKey: string;
    address: string;
    city: string | null;
    status: string | null;
    price: number | null;
    bedrooms: number | null;
    bathrooms: number | null;
    livingArea: number | null;
    pricePerSqft: number | null;
  }>;
  // P0-3: magnetType-specific extras
  magnetTypeExtras: Record<string, unknown>;
  rawMetrics: {
    activePrices: number[];
    soldPrices: number[];
    domValues: number[];
  };
};

type MagnetNarrative = {
  title: string;
  heroHook: string;
  summary: string;
  insightBullets: string[];
  reportSections: Array<{ title: string; body: string }>;
  shareKit: {
    facebookPost: string;
    instagramCaption: string;
    xhsNote: string;
    emailSubject: string;
    emailTeaser: string;
    hashtags: string[];
  };
  cta: {
    title: string;
    description: string;
    primaryLabel: string;
    followUpPrompt: string;
  };
};

export type AreaMagnetGenerationResult = {
  title: string;
  introMessage: string;
  strategyPoints: string[];
  listingKeys: string[];
  magnetScope: {
    scopeType: AreaMagnetScopeType;
    query: string;
    normalizedLabel: string;
  };
  magnetPayload: Record<string, unknown>;
  shareConfig: {
    strategyPoints: string[];
  };
  generatedBy: {
    provider: "openai";
    model: string;
    usedFallback: boolean;
    fallbackReason: string | null;
  };
};

// ─── Utility Helpers ───────────────────────────────────────────

function cleanText(value: string | null | undefined) {
  return value?.trim() ?? "";
}

function toNumber(value: string | number | null | undefined): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[$,]/g, "").trim());
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }
  return sorted[middle];
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function averageRatio(rows: ListingData[]): number | null {
  const ratios = rows
    .map((row) => {
      const close = toNumber(row.closePrice);
      const list = toNumber(row.listPrice);
      if (!close || !list) return null;
      return close / list;
    })
    .filter((value): value is number => value !== null && Number.isFinite(value));

  return average(ratios);
}

function formatCurrency(value: number | null) {
  if (!value || !Number.isFinite(value)) return "N/A";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function buildScopeLabel(scopeType: AreaMagnetScopeType, query: string) {
  const normalized = query.trim();
  if (scopeType === "zip") return normalized.toUpperCase();
  return normalized;
}

// ─── P0-2: Price Per Sqft ──────────────────────────────────────

function computePricePerSqft(
  rows: ListingData[],
  priceField: "listPrice" | "closePrice"
): number | null {
  const values = rows
    .map((row) => {
      const price = toNumber(row[priceField] ?? row.listPrice);
      const sqft = toNumber(row.livingArea);
      if (!price || !sqft || sqft <= 0) return null;
      return price / sqft;
    })
    .filter((v): v is number => v !== null && Number.isFinite(v));
  return median(values);
}

function rowPricePerSqft(row: ListingData): number | null {
  const price = toNumber(row.listPrice);
  const sqft = toNumber(row.livingArea);
  if (!price || !sqft || sqft <= 0) return null;
  return Math.round(price / sqft);
}

// ─── P0-2: Price Range Distribution ────────────────────────────

function buildPriceRangeDistribution(prices: number[]): PriceRangeBucket[] {
  if (prices.length === 0) return [];
  const buckets: PriceRangeBucket[] = [
    { label: "<$300K", count: 0 },
    { label: "$300K–500K", count: 0 },
    { label: "$500K–750K", count: 0 },
    { label: "$750K–1M", count: 0 },
    { label: "$1M–1.5M", count: 0 },
    { label: "$1.5M–2M", count: 0 },
    { label: "$2M+", count: 0 },
  ];
  const thresholds = [300_000, 500_000, 750_000, 1_000_000, 1_500_000, 2_000_000];
  for (const p of prices) {
    let placed = false;
    for (let i = 0; i < thresholds.length; i++) {
      if (p < thresholds[i]) {
        buckets[i].count++;
        placed = true;
        break;
      }
    }
    if (!placed) buckets[buckets.length - 1].count++;
  }
  return buckets.filter((b) => b.count > 0);
}

// ─── P0-3: MagnetType-Specific Filters ────────────────────────

function buildSearchFilters(input: GenerateAreaMagnetInput): SearchFilters {
  const base: SearchFilters = { perPage: 40, page: 1 };
  if (input.scopeType === "zip") {
    return { ...base, postalCode: input.query.trim() };
  }
  return { ...base, search: input.query.trim() };
}

/**
 * P0-3: Fetch magnetType-specific supplementary data.
 * Each magnetType focuses on different aspects of the market.
 */
async function fetchMagnetTypeExtras(
  input: GenerateAreaMagnetInput,
  activeListings: ListingData[],
  soldListings: ListingData[]
): Promise<Record<string, unknown>> {
  const extras: Record<string, unknown> = {};

  switch (input.magnetType) {
    case "school_move_up": {
      // Emphasize family-size homes (3+ bed).
      const familyHomes = activeListings.filter(
        (r) => (r.bedroomsTotal ?? 0) >= 3
      );
      extras.familyHomeCount = familyHomes.length;
      extras.familyHomeMedianPrice = median(
        familyHomes
          .map((r) => toNumber(r.listPrice))
          .filter((v): v is number => v !== null)
      );
      extras.totalActiveCount = activeListings.length;
      extras.familyHomeRatio =
        activeListings.length > 0
          ? Math.round((familyHomes.length / activeListings.length) * 100)
          : 0;
      break;
    }
    case "off_market_brief": {
      // Focus on withdrawn/expired signals + seller leverage
      const recentSold = soldListings.filter((r) => {
        if (!r.closeDate) return false;
        const d = new Date(r.closeDate);
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        return d >= sixMonthsAgo;
      });
      extras.recentSoldCount = recentSold.length;
      extras.totalSoldCount = soldListings.length;
      // Detect price reductions (originalListPrice vs listPrice)
      const reduced = activeListings.filter((r) => {
        const orig = toNumber(r.originalListPrice);
        const curr = toNumber(r.listPrice);
        return orig !== null && curr !== null && curr < orig;
      });
      extras.priceReducedCount = reduced.length;
      extras.priceReducedRatio =
        activeListings.length > 0
          ? Math.round((reduced.length / activeListings.length) * 100)
          : 0;
      // High DOM listings (potential off-market targets)
      const highDom = activeListings.filter(
        (r) => (r.daysOnMarket ?? 0) > 90
      );
      extras.highDomCount = highDom.length;
      break;
    }
    case "renovation_roi": {
      // Compare older vs newer construction premiums
      const withYear = [...activeListings, ...soldListings].filter(
        (r) => r.yearBuilt && r.yearBuilt > 0
      );
      const older = withYear.filter((r) => (r.yearBuilt ?? 2000) < 2000);
      const newer = withYear.filter((r) => (r.yearBuilt ?? 0) >= 2000);
      const olderPpsf = computePricePerSqft(
        older as ListingData[],
        "listPrice"
      );
      const newerPpsf = computePricePerSqft(
        newer as ListingData[],
        "listPrice"
      );
      extras.olderHomePricePerSqft = olderPpsf;
      extras.newerHomePricePerSqft = newerPpsf;
      extras.renovationPremiumPct =
        olderPpsf && newerPpsf && olderPpsf > 0
          ? Math.round(((newerPpsf - olderPpsf) / olderPpsf) * 100)
          : null;
      extras.olderHomeCount = older.length;
      extras.newerHomeCount = newer.length;
      extras.medianYearBuilt = median(
        withYear.map((r) => r.yearBuilt!).filter(Number.isFinite)
      );
      break;
    }
    case "spring_market": {
      // Focus on new listing pace + inventory momentum
      const recentActive = activeListings.filter((r) => {
        return (r.daysOnMarket ?? 999) <= 14;
      });
      extras.newListingCount = recentActive.length;
      extras.newListingRatio =
        activeListings.length > 0
          ? Math.round((recentActive.length / activeListings.length) * 100)
          : 0;
      // Absorption rate proxy: sold in last 3 months / months
      const recentSold = soldListings.filter((r) => {
        if (!r.closeDate) return false;
        const d = new Date(r.closeDate);
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
        return d >= threeMonthsAgo;
      });
      const monthlyAbsorption =
        recentSold.length > 0 ? Math.round(recentSold.length / 3) : null;
      extras.monthlyAbsorption = monthlyAbsorption;
      extras.monthsOfSupply =
        monthlyAbsorption && monthlyAbsorption > 0
          ? Math.round((activeListings.length / monthlyAbsorption) * 10) / 10
          : null;
      break;
    }
  }
  return extras;
}

// ─── Property Helpers ──────────────────────────────────────────

function collectPropertyMix(rows: ListingData[]) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const type = cleanText(row.propertyType) || "Other";
    counts.set(type, (counts.get(type) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 4);
}

function buildAddress(row: ListingData) {
  return (
    cleanText(row.unparsedAddress) ||
    [cleanText(row.city), cleanText(row.stateOrProvince), cleanText(row.postalCode)]
      .filter(Boolean)
      .join(", ") ||
    row.listingKey
  );
}

// ─── P0-1: Time Window Filtering ───────────────────────────────

function filterByTimeWindow(
  listings: ListingData[],
  monthsBack: number
): ListingData[] {
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - monthsBack);
  return listings.filter((row) => {
    if (!row.closeDate) return true; // keep active listings
    const d = new Date(row.closeDate);
    return !Number.isNaN(d.getTime()) && d >= cutoff;
  });
}

// ─── Inventory Fetch ────────────────────────────────────────────

async function fetchInventory(input: GenerateAreaMagnetInput) {
  const filters = buildSearchFilters(input);

  const [activeResponse, closedResponse, soldResponse] = await Promise.allSettled([
    searchListings({ ...filters, status: "Active" }),
    searchListings({ ...filters, status: "Closed" }),
    searchListings({ ...filters, status: "Sold" }),
  ]);

  const activeListings =
    activeResponse.status === "fulfilled"
      ? (activeResponse.value.data ?? [])
      : [];
  const closedListings =
    closedResponse.status === "fulfilled"
      ? (closedResponse.value.data ?? [])
      : [];
  const soldListings =
    soldResponse.status === "fulfilled"
      ? (soldResponse.value.data ?? [])
      : [];

  // P0-1: Apply 6-month time window to sold data
  const mergedSold = closedListings.length > 0 ? closedListings : soldListings;
  const filteredSold = filterByTimeWindow(mergedSold, 6);

  return { activeListings, soldListings: filteredSold };
}

// ─── Build Enriched Snapshot ───────────────────────────────────

async function buildSnapshot(
  input: GenerateAreaMagnetInput,
  activeListings: ListingData[],
  soldListings: ListingData[]
): Promise<MarketSnapshot> {
  const activePrices = activeListings
    .map((row) => toNumber(row.listPrice))
    .filter((value): value is number => value !== null);
  const soldPrices = soldListings
    .map((row) => toNumber(row.closePrice ?? row.listPrice))
    .filter((value): value is number => value !== null);
  const domValues = [...activeListings, ...soldListings]
    .map((row) => row.daysOnMarket)
    .filter(
      (value): value is number =>
        typeof value === "number" && Number.isFinite(value)
    );

  const featuredListings = activeListings
    .filter((row) => cleanText(row.listingKey).length > 0)
    .slice(0, 4)
    .map((row) => ({
      listingKey: cleanText(row.listingKey),
      address: buildAddress(row),
      city: cleanText(row.city) || null,
      status: cleanText(row.standardStatus) || null,
      price: toNumber(row.listPrice),
      bedrooms: row.bedroomsTotal ?? null,
      bathrooms: row.bathroomsTotalInteger ?? null,
      livingArea: toNumber(row.livingArea),
      pricePerSqft: rowPricePerSqft(row),
    }));

  // P0-3: fetch magnetType-specific extras
  const magnetTypeExtras = await fetchMagnetTypeExtras(
    input,
    activeListings,
    soldListings
  );

  return {
    scopeType: input.scopeType,
    scopeQuery: input.query.trim(),
    scopeLabel: buildScopeLabel(input.scopeType, input.query),
    magnetType: input.magnetType,
    audience: input.audience,
    tone: input.tone,
    activeCount: activeListings.length,
    soldCount: soldListings.length,
    activeMedianPrice: median(activePrices),
    soldMedianPrice: median(soldPrices),
    averageDom: average(domValues),
    soldToListRatio: averageRatio(soldListings),
    // P0-2
    activePricePerSqft: computePricePerSqft(activeListings, "listPrice"),
    soldPricePerSqft: computePricePerSqft(soldListings, "closePrice"),
    priceRangeDistribution: buildPriceRangeDistribution([
      ...activePrices,
      ...soldPrices,
    ]),
    propertyTypeMix: collectPropertyMix(
      activeListings.length > 0 ? activeListings : soldListings
    ),
    featuredListings,
    // P0-3
    magnetTypeExtras,
    rawMetrics: {
      activePrices,
      soldPrices,
      domValues,
    },
  };
}

// ─── P1-3: Bilingual Fallback Narrative ────────────────────────

type FallbackLocale = "en" | "zh";

function detectLocale(input: GenerateAreaMagnetInput): FallbackLocale {
  // Heuristic: if the query contains CJK characters, use Chinese
  const hasCJK = /[\u4e00-\u9fff\u3400-\u4dbf]/.test(input.query);
  return hasCJK ? "zh" : "en";
}

function defaultTitle(
  input: GenerateAreaMagnetInput,
  scopeLabel: string,
  locale: FallbackLocale
) {
  const map: Record<AreaMagnetType, Record<FallbackLocale, string>> = {
    spring_market: { zh: "春季市场分析", en: "Spring Market Report" },
    school_move_up: { zh: "学区置换指南", en: "School Move-Up Guide" },
    off_market_brief: { zh: "非公开成交简报", en: "Off-Market Brief" },
    renovation_roi: { zh: "翻新回报预测", en: "Renovation ROI Report" },
  };
  return `${scopeLabel} · ${map[input.magnetType][locale]}`;
}

function buildFallbackNarrative(
  input: GenerateAreaMagnetInput,
  snapshot: MarketSnapshot
): MagnetNarrative {
  const locale = detectLocale(input);
  const isChinese = locale.startsWith("zh");
  const sl = snapshot.scopeLabel;

  // P0-2: $/sqft stories
  const sqftStory =
    snapshot.activePricePerSqft !== null
      ? isChinese
        ? `活跃房源每平方英尺均价约 $${Math.round(snapshot.activePricePerSqft)}`
        : `Active listings average ~$${Math.round(snapshot.activePricePerSqft)}/sqft`
      : "";

  if (isChinese) {
    const priceStory = snapshot.activeMedianPrice
      ? `${sl} 当前在售中位价约 ${formatCurrency(snapshot.activeMedianPrice)}`
      : `${sl} 当前挂牌价格区间正在收紧`;
    const demandStory = snapshot.soldToListRatio
      ? `近期成交均值大约是挂牌价的 ${(snapshot.soldToListRatio * 100).toFixed(1)}%`
      : "近期成交溢价数据仍在补全中";
    const domStory = snapshot.averageDom
      ? `平均去化节奏约 ${Math.round(snapshot.averageDom)} 天`
      : "平均去化节奏仍需更多近期样本";
    const topTypes =
      snapshot.propertyTypeMix.map((item) => item.label).join(" / ") || "住宅";
    const audienceLabel =
      input.audience === "seller"
        ? "卖家"
        : input.audience === "buyer"
          ? "买家"
          : input.audience === "investor"
            ? "投资人"
            : "换房家庭";

    return {
      title: defaultTitle(input, sl, locale),
      heroHook: `${priceStory}，${demandStory}。${sqftStory ? sqftStory + "。" : ""}对${audienceLabel}来说，这是一个值得尽快判断窗口期的位置。`,
      summary: `${sl} 当前样本显示 ${snapshot.activeCount} 套活跃房源、${snapshot.soldCount} 套近期成交（6个月内），${domStory}。这份报告把价格、节奏和可操作策略压缩成一页。`,
      insightBullets: [
        `${sl} 当前可见库存 ${snapshot.activeCount} 套，适合拿来判断供应压力。`,
        snapshot.activeMedianPrice
          ? `当前挂牌中位价约 ${formatCurrency(snapshot.activeMedianPrice)}。${sqftStory ? sqftStory + "。" : ""}`
          : "当前挂牌中位价仍在整理中。",
        `${domStory}，最活跃的物业类型以 ${topTypes} 为主。`,
        `${demandStory}，很适合作为首次触达客户的市场干货。`,
        `近 6 个月可见成交样本 ${snapshot.soldCount} 套，可用于校准当前市场判断。`,
      ],
      reportSections: [
        {
          title: "市场温度",
          body: `${sl} 的库存和去化速度说明，这里并不适合继续用泛泛的房源广告去触达客户。更好的做法是先给出一个可信的价格与节奏判断。${sqftStory ? `当前${sqftStory}。` : ""}`,
        },
        {
          title: "供需结构",
          body: `当前最常见的在售类型集中在 ${topTypes}。无论你想触达卖家还是买家，这都足够支撑一个明确的内容切口。`,
        },
        {
          title: "行动建议",
          body: `建议先用这份 ${defaultTitle(input, sl, locale)} 作为入口，再跟进房屋净值、置换策略或带看路线，能比直接发房源更容易拿到回复。`,
        },
      ],
      shareKit: {
        facebookPost: `${sl} 最近的库存、成交节奏和价格窗口，已经帮你整理成一份可直接转发的市场简报。想要完整版，私信我。`,
        instagramCaption: `${sl} 最新市场简报已整理好：库存、价格、去化速度一页看完。\n\n如果你在考虑今年卖房、换房或投资，这类内容比单纯发房源更有用。`,
        xhsNote: `最近把 ${sl} 的市场节奏重新看了一遍，发现现在最值得聊的不是"哪套房又降价了"，而是库存、成交速度和买卖双方的心理预期。整理成了一份简版报告，适合转给正在考虑置换的朋友。`,
        emailSubject: `${sl} 最新市场报告：适合现在发给客户的版本`,
        emailTeaser: `我把 ${sl} 最近的库存、价格和成交节奏压缩成了一份可以直接转发的市场报告。如果你想用内容而不是硬广去触达客户，这一版就够开始。`,
        hashtags: [
          sl.replace(/\s+/g, ""),
          "MarketUpdate",
          "HomeSeller",
          "LocalIntel",
        ],
      },
      cta: {
        title: `解锁 ${sl} 完整报告`,
        description: "留下邮箱或手机号，我会把完整市场分析和下一步建议发给你。",
        primaryLabel: "获取完整报告",
        followUpPrompt: `Hi，看到你刚下载了 ${sl} 的市场报告。如果你正在考虑卖房，我可以结合近期市场数据和你具体聊聊定价与上市节奏。`,
      },
    };
  }

  // English fallback (P1-3: previously missing)
  const priceStory = snapshot.activeMedianPrice
    ? `The median active listing price in ${sl} is around ${formatCurrency(snapshot.activeMedianPrice)}`
    : `Active listing prices in ${sl} are tightening`;
  const demandStory = snapshot.soldToListRatio
    ? `recent closings averaged about ${(snapshot.soldToListRatio * 100).toFixed(1)}% of list price`
    : "sold-to-list data is still being compiled";
  const domStory = snapshot.averageDom
    ? `average days on market is around ${Math.round(snapshot.averageDom)}`
    : "average market time needs more recent samples";
  const topTypes =
    snapshot.propertyTypeMix.map((item) => item.label).join(", ") ||
    "Residential";
  const audienceLabel =
    input.audience === "seller"
      ? "sellers"
      : input.audience === "buyer"
        ? "buyers"
        : input.audience === "investor"
          ? "investors"
          : "move-up families";

  return {
    title: defaultTitle(input, sl, locale),
    heroHook: `${priceStory}, and ${demandStory}. ${sqftStory ? sqftStory + ". " : ""}For ${audienceLabel}, this is a window worth evaluating now.`,
    summary: `${sl} currently shows ${snapshot.activeCount} active listings and ${snapshot.soldCount} recent sales (past 6 months), ${domStory}. This report compresses pricing, pace, and actionable strategy into one shareable page.`,
    insightBullets: [
      `${sl} has ${snapshot.activeCount} visible listings — enough to gauge supply pressure.`,
      snapshot.activeMedianPrice
        ? `Median asking price is around ${formatCurrency(snapshot.activeMedianPrice)}. ${sqftStory ? sqftStory + "." : ""}`
        : "Median asking price is still being compiled.",
      `${domStory.charAt(0).toUpperCase() + domStory.slice(1)}, with the most active property types being ${topTypes}.`,
      `${demandStory.charAt(0).toUpperCase() + demandStory.slice(1)} — solid material for a first-touch market conversation.`,
      `${snapshot.soldCount} visible sales from the past six months help calibrate the current market read.`,
    ],
    reportSections: [
      {
        title: "Market Temperature",
        body: `The inventory and absorption pace in ${sl} suggest generic listing ads won't cut it. A credible price-and-pace assessment is a stronger opening. ${sqftStory ? `Currently, ${sqftStory.toLowerCase()}.` : ""}`,
      },
      {
        title: "Supply & Demand",
        body: `The most common active property types are ${topTypes}. Whether you're targeting sellers or buyers, this data supports a clear content angle.`,
      },
      {
        title: "Recommended Action",
        body: `Use this ${defaultTitle(input, sl, locale)} as your entry point, then follow up with a home equity analysis, trade-up strategy, or showing route — much more effective than cold listing drops.`,
      },
    ],
    shareKit: {
      facebookPost: `${sl}'s latest inventory, pricing, and market pace — already packaged into a forwardable market brief. DM me for the full version.`,
      instagramCaption: `${sl} market brief is ready: inventory, pricing, and absorption speed in one page.\n\nIf you're thinking about selling, upgrading, or investing this year, this is more useful than a random listing post.`,
      xhsNote: `Just reviewed the market rhythm in ${sl}. The real story isn't "which home dropped price" — it's inventory, closing speed, and buyer/seller sentiment. Compiled a brief report, perfect for forwarding to friends considering a move.`,
      emailSubject: `${sl} Market Report — a version you can send to clients right now`,
      emailTeaser: `I compressed ${sl}'s recent inventory, pricing, and closing pace into a forwardable market report. If you want to reach clients with content instead of ads, this version is ready to go.`,
      hashtags: [
        sl.replace(/\s+/g, ""),
        "MarketUpdate",
        "HomeSeller",
        "LocalIntel",
      ],
    },
    cta: {
      title: `Unlock the full ${sl} report`,
      description:
        "Leave your email or phone number and I'll send you the complete market analysis with recommended next steps.",
      primaryLabel: "Get the full report",
      followUpPrompt: `Hi, I saw you just downloaded the ${sl} market report. If you'd like to see your home's current value range, I can pull a personalized estimate for you.`,
    },
  };
}

// ─── AI Narrative Generation ───────────────────────────────────

function extractText(result: InvokeResult): string {
  const content = result.choices[0]?.message?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => (part.type === "text" ? part.text : ""))
      .filter(Boolean)
      .join("\n");
  }
  return "";
}

function parseNarrative(raw: string): MagnetNarrative {
  const parsed = JSON.parse(raw) as Partial<MagnetNarrative>;
  return {
    title: cleanText(parsed.title) || "Area Magnet",
    heroHook: cleanText(parsed.heroHook),
    summary: cleanText(parsed.summary),
    insightBullets: Array.isArray(parsed.insightBullets)
      ? parsed.insightBullets
          .map((item) => cleanText(item))
          .filter(Boolean)
          .slice(0, 6)
      : [],
    reportSections: Array.isArray(parsed.reportSections)
      ? parsed.reportSections
          .map((item) => ({
            title: cleanText(item?.title),
            body: cleanText(item?.body),
          }))
          .filter((item) => item.title && item.body)
          .slice(0, 5)
      : [],
    shareKit: {
      facebookPost: cleanText(parsed.shareKit?.facebookPost),
      instagramCaption: cleanText(parsed.shareKit?.instagramCaption),
      xhsNote: cleanText(parsed.shareKit?.xhsNote),
      emailSubject: cleanText(parsed.shareKit?.emailSubject),
      emailTeaser: cleanText(parsed.shareKit?.emailTeaser),
      hashtags: Array.isArray(parsed.shareKit?.hashtags)
        ? parsed.shareKit.hashtags
            .map((item) => cleanText(item))
            .filter(Boolean)
            .slice(0, 8)
        : [],
    },
    cta: {
      title: cleanText(parsed.cta?.title),
      description: cleanText(parsed.cta?.description),
      primaryLabel: cleanText(parsed.cta?.primaryLabel),
      followUpPrompt: cleanText(parsed.cta?.followUpPrompt),
    },
  };
}

async function generateNarrative(
  input: GenerateAreaMagnetInput,
  snapshot: MarketSnapshot
): Promise<{
  narrative: MagnetNarrative;
  model: string;
  usedFallback: boolean;
  fallbackReason: string | null;
}> {
  const candidateModels = Array.from(
    new Set(
      [ENV.openaiModel].filter(Boolean)
    )
  );

  // P0-3: magnetType-specific system prompt addendum
  const magnetTypePromptMap: Record<AreaMagnetType, string> = {
    spring_market:
      "Focus on new listing pace, absorption rate, months of supply, and seasonal momentum. Emphasize timing windows.",
    school_move_up:
      "Emphasize family-friendly homes (3+ bedrooms) and move-up timing without inventing school data.",
    off_market_brief:
      "Focus on price reductions, high DOM listings, sold-to-list ratios, and seller fatigue signals. Position the agent as having insider market read.",
    renovation_roi:
      "Compare older vs newer construction price-per-sqft premiums. Quantify renovation upside potential. Target investors and pre-list sellers.",
  };

  const systemPrompt = [
    "You are a senior US real-estate marketing strategist building lead magnets for working agents.",
    "Turn structured market data into a high-conviction but truthful report.",
    "Use only the provided facts. Do not invent school ratings, commercial projects, or private deal intel.",
    "Write concise, commercial, agent-ready copy. Avoid generic fluff.",
    magnetTypePromptMap[input.magnetType],
    "Include price-per-sqft insights when data is available.",
    "Return JSON only.",
  ].join(" ");

  const userPrompt = JSON.stringify(
    {
      task: "Generate an Area Magnet report and sharing kit",
      requirements: {
        titleStyle: "concise, premium, shareable",
        insightCount: 5,
        sectionCount: 3,
        tabs: ["overview", "report", "share_kit"],
        ctaGoal: "capture lead for follow-up",
      },
      input,
      snapshot,
      outputSchema: {
        title: "string",
        heroHook: "string",
        summary: "string",
        insightBullets: ["string"],
        reportSections: [{ title: "string", body: "string" }],
        shareKit: {
          facebookPost: "string",
          instagramCaption: "string",
          xhsNote: "string",
          emailSubject: "string",
          emailTeaser: "string",
          hashtags: ["string"],
        },
        cta: {
          title: "string",
          description: "string",
          primaryLabel: "string",
          followUpPrompt: "string",
        },
      },
    },
    null,
    2
  );

  let lastError: string | null = null;
  for (const model of candidateModels) {
    try {
      const result = await invokeLLM({
        task: "area-magnet",
        model,
        responseFormat: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      });

      const narrative = parseNarrative(extractText(result));
      const fallback = buildFallbackNarrative(input, snapshot);
      return {
        narrative: {
          ...fallback,
          ...narrative,
          insightBullets:
            narrative.insightBullets.length > 0
              ? narrative.insightBullets
              : fallback.insightBullets,
          reportSections:
            narrative.reportSections.length > 0
              ? narrative.reportSections
              : fallback.reportSections,
          shareKit: {
            ...fallback.shareKit,
            ...narrative.shareKit,
            hashtags:
              narrative.shareKit.hashtags.length > 0
                ? narrative.shareKit.hashtags
                : fallback.shareKit.hashtags,
          },
          cta: {
            ...fallback.cta,
            ...narrative.cta,
          },
        },
        model,
        usedFallback: false,
        fallbackReason: null,
      };
    } catch (error) {
      lastError =
        error instanceof Error ? error.message : "unknown_llm_error";
    }
  }

  return {
    narrative: buildFallbackNarrative(input, snapshot),
    model: candidateModels[0] ?? ENV.openaiModel,
    usedFallback: true,
    fallbackReason: lastError,
  };
}

// ─── Main Entry Point ──────────────────────────────────────────

export async function generateAreaMagnetReport(
  input: GenerateAreaMagnetInput
): Promise<AreaMagnetGenerationResult> {
  const normalizedInput: GenerateAreaMagnetInput = {
    ...input,
    query: input.query.trim(),
    captureFields:
      input.captureFields.length > 0 ? input.captureFields : ["email"],
  };

  const { activeListings, soldListings } = await fetchInventory(normalizedInput);
  if (activeListings.length === 0 && soldListings.length === 0) {
    throw new Error(
      "No listing data was available for this area. Try a nearby ZIP, neighborhood, or building."
    );
  }

  const snapshot = await buildSnapshot(
    normalizedInput,
    activeListings,
    soldListings
  );
  const generation = await generateNarrative(normalizedInput, snapshot);

  // P0-2: enhanced metrics with $/sqft
  const metrics = [
    {
      label: "Active inventory",
      value: String(snapshot.activeCount),
      detail: `${snapshot.scopeLabel} live listings`,
    },
    {
      label: "Recent sold (6mo)",
      value: String(snapshot.soldCount),
      detail: "Close records within 6 months",
    },
    {
      label: "Median list price",
      value: formatCurrency(snapshot.activeMedianPrice),
      detail: "Current asking median",
    },
    {
      label: "Median sold price",
      value: formatCurrency(snapshot.soldMedianPrice),
      detail: "Recent sold median",
    },
    {
      label: "Average DOM",
      value: snapshot.averageDom
        ? `${Math.round(snapshot.averageDom)} days`
        : "N/A",
      detail: "Visible market tempo",
    },
    {
      label: "Sold / list ratio",
      value: snapshot.soldToListRatio
        ? `${(snapshot.soldToListRatio * 100).toFixed(1)}%`
        : "N/A",
      detail: "Close price vs. ask",
    },
    // P0-2: new metrics
    {
      label: "Active $/sqft",
      value: snapshot.activePricePerSqft
        ? `$${Math.round(snapshot.activePricePerSqft)}`
        : "N/A",
      detail: "Median price per square foot (active)",
    },
    {
      label: "Sold $/sqft",
      value: snapshot.soldPricePerSqft
        ? `$${Math.round(snapshot.soldPricePerSqft)}`
        : "N/A",
      detail: "Median price per square foot (sold)",
    },
  ];

  const title =
    generation.narrative.title ||
    defaultTitle(normalizedInput, snapshot.scopeLabel, detectLocale(normalizedInput));
  const strategyPoints = generation.narrative.insightBullets.slice(0, 5);
  const listingKeys = snapshot.featuredListings
    .map((listing) => listing.listingKey)
    .filter(Boolean);

  // Determine data source label
  const dataSourceParts = ["bbo-search"];
  if (Object.keys(snapshot.magnetTypeExtras).length > 0)
    dataSourceParts.push(normalizedInput.magnetType);

  return {
    title,
    introMessage: generation.narrative.summary,
    strategyPoints,
    listingKeys,
    magnetScope: {
      scopeType: normalizedInput.scopeType,
      query: normalizedInput.query,
      normalizedLabel: snapshot.scopeLabel,
    },
    magnetPayload: {
      magnetType: normalizedInput.magnetType,
      audience: normalizedInput.audience,
      tone: normalizedInput.tone,
      scopeLabel: snapshot.scopeLabel,
      heroHook: generation.narrative.heroHook,
      summary: generation.narrative.summary,
      insightBullets: generation.narrative.insightBullets,
      reportSections: generation.narrative.reportSections,
      shareKit: generation.narrative.shareKit,
      capture: {
        fields: normalizedInput.captureFields,
        title: generation.narrative.cta.title,
        description: generation.narrative.cta.description,
        primaryLabel: generation.narrative.cta.primaryLabel,
        followUpPrompt: generation.narrative.cta.followUpPrompt,
      },
      metrics,
      snapshot: {
        activeCount: snapshot.activeCount,
        soldCount: snapshot.soldCount,
        activeMedianPrice: snapshot.activeMedianPrice,
        soldMedianPrice: snapshot.soldMedianPrice,
        averageDom: snapshot.averageDom,
        soldToListRatio: snapshot.soldToListRatio,
        activePricePerSqft: snapshot.activePricePerSqft,
        soldPricePerSqft: snapshot.soldPricePerSqft,
        priceRangeDistribution: snapshot.priceRangeDistribution,
        propertyTypeMix: snapshot.propertyTypeMix,
      },
      // P0-3: expose magnetType extras to frontend
      magnetTypeExtras: snapshot.magnetTypeExtras,
      featuredListings: snapshot.featuredListings,
      tabs: ["overview", "report", "share_kit"],
      generatedBy: {
        provider: "openai",
        model: generation.model,
        usedFallback: generation.usedFallback,
        fallbackReason: generation.fallbackReason,
      },
    },
    shareConfig: {
      strategyPoints,
    },
    generatedBy: {
      provider: "openai",
      model: generation.model,
      usedFallback: generation.usedFallback,
      fallbackReason: generation.fallbackReason,
    },
  };
}
