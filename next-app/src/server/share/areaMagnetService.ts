import { invokeLLM, type InvokeResult } from "@/server/_core/llm";
import { ENV } from "@/server/_core/env";
import { searchListings } from "@/server/clients/listingDataClient";
import type { ListingData, SearchFilters } from "@/server/clients/types";

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
  }>;
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

function buildSearchFilters(input: GenerateAreaMagnetInput): SearchFilters {
  const base: SearchFilters = { perPage: 40, page: 1 };
  if (input.scopeType === "zip") {
    return { ...base, postalCode: input.query.trim() };
  }
  return { ...base, search: input.query.trim() };
}

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

async function fetchInventory(input: GenerateAreaMagnetInput) {
  const filters = buildSearchFilters(input);
  const [activeResponse, closedResponse, soldResponse] = await Promise.allSettled([
    searchListings({ ...filters, status: "Active" }),
    searchListings({ ...filters, status: "Closed" }),
    searchListings({ ...filters, status: "Sold" }),
  ]);

  const activeListings =
    activeResponse.status === "fulfilled" ? activeResponse.value.data ?? [] : [];
  const closedListings =
    closedResponse.status === "fulfilled" ? closedResponse.value.data ?? [] : [];
  const soldListings =
    soldResponse.status === "fulfilled" ? soldResponse.value.data ?? [] : [];

  return {
    activeListings,
    soldListings: closedListings.length > 0 ? closedListings : soldListings,
  };
}

function buildSnapshot(
  input: GenerateAreaMagnetInput,
  activeListings: ListingData[],
  soldListings: ListingData[]
): MarketSnapshot {
  const activePrices = activeListings
    .map((row) => toNumber(row.listPrice))
    .filter((value): value is number => value !== null);
  const soldPrices = soldListings
    .map((row) => toNumber(row.closePrice ?? row.listPrice))
    .filter((value): value is number => value !== null);
  const domValues = [...activeListings, ...soldListings]
    .map((row) => row.daysOnMarket)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));

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
    }));

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
    propertyTypeMix: collectPropertyMix(activeListings.length > 0 ? activeListings : soldListings),
    featuredListings,
    rawMetrics: {
      activePrices,
      soldPrices,
      domValues,
    },
  };
}

function defaultTitle(input: GenerateAreaMagnetInput, scopeLabel: string) {
  const map: Record<AreaMagnetType, string> = {
    spring_market: "春季市场分析",
    school_move_up: "学区置换指南",
    off_market_brief: "非公开成交简报",
    renovation_roi: "翻新回报预测",
  };
  return `${scopeLabel} · ${map[input.magnetType]}`;
}

function buildFallbackNarrative(
  input: GenerateAreaMagnetInput,
  snapshot: MarketSnapshot
): MagnetNarrative {
  const priceStory = snapshot.activeMedianPrice
    ? `${snapshot.scopeLabel} 当前在售中位价约 ${formatCurrency(snapshot.activeMedianPrice)}`
    : `${snapshot.scopeLabel} 当前挂牌价格区间正在收紧`;
  const demandStory = snapshot.soldToListRatio
    ? `近期成交均值大约是挂牌价的 ${(snapshot.soldToListRatio * 100).toFixed(1)}%`
    : "近期成交溢价数据仍在补全中";
  const domStory = snapshot.averageDom
    ? `平均去化节奏约 ${Math.round(snapshot.averageDom)} 天`
    : "平均去化节奏仍需更多近期样本";
  const topTypes = snapshot.propertyTypeMix.map((item) => item.label).join(" / ") || "住宅";

  return {
    title: defaultTitle(input, snapshot.scopeLabel),
    heroHook: `${priceStory}，${demandStory}。对 ${input.audience === "seller" ? "卖家" : "买家"} 来说，这是一个值得尽快判断窗口期的位置。`,
    summary: `${snapshot.scopeLabel} 当前样本显示 ${snapshot.activeCount} 套活跃房源、${snapshot.soldCount} 套近期成交，${domStory}。这份报告把价格、节奏和可操作策略压缩成一页，方便直接分享给潜在客户。`,
    insightBullets: [
      `${snapshot.scopeLabel} 当前可见库存 ${snapshot.activeCount} 套，适合拿来判断供应压力。`,
      snapshot.activeMedianPrice
        ? `当前挂牌中位价约 ${formatCurrency(snapshot.activeMedianPrice)}。`
        : "当前挂牌中位价仍在整理中。",
      `${domStory}，最活跃的物业类型以 ${topTypes} 为主。`,
      `${demandStory}，很适合作为首次触达客户的市场干货。`,
    ],
    reportSections: [
      {
        title: "市场温度",
        body: `${snapshot.scopeLabel} 的库存和去化速度说明，这里并不适合继续用泛泛的房源广告去触达客户。更好的做法是先给出一个可信的价格与节奏判断。`,
      },
      {
        title: "供需结构",
        body: `当前最常见的在售类型集中在 ${topTypes}。无论你想触达卖家还是买家，这都足够支撑一个明确的内容切口。`,
      },
      {
        title: "行动建议",
        body: `建议先用这份 ${defaultTitle(input, snapshot.scopeLabel)} 作为入口，再跟进房屋净值、置换策略或带看路线，能比直接发房源更容易拿到回复。`,
      },
    ],
    shareKit: {
      facebookPost: `${snapshot.scopeLabel} 最近的库存、成交节奏和价格窗口，已经帮你整理成一份可直接转发的市场简报。想要完整版，私信我。`,
      instagramCaption: `${snapshot.scopeLabel} 最新市场简报已整理好：库存、价格、去化速度一页看完。\n\n如果你在考虑今年卖房、换房或投资，这类内容比单纯发房源更有用。`,
      xhsNote: `最近把 ${snapshot.scopeLabel} 的市场节奏重新看了一遍，发现现在最值得聊的不是“哪套房又降价了”，而是库存、成交速度和买卖双方的心理预期。整理成了一份简版报告，适合转给正在考虑置换的朋友。`,
      emailSubject: `${snapshot.scopeLabel} 最新市场报告：适合现在发给客户的版本`,
      emailTeaser: `我把 ${snapshot.scopeLabel} 最近的库存、价格和成交节奏压缩成了一份可以直接转发的市场报告。如果你想用内容而不是硬广去触达客户，这一版就够开始。`,
      hashtags: [snapshot.scopeLabel.replace(/\s+/g, ""), "MarketUpdate", "HomeSeller", "LocalIntel"],
    },
    cta: {
      title: `解锁 ${snapshot.scopeLabel} 完整报告`,
      description: "留下邮箱或手机号，我会把完整市场分析和下一步建议发给你。",
      primaryLabel: "获取完整报告",
      followUpPrompt: `Hi，看到你刚下载了 ${snapshot.scopeLabel} 的市场报告。如果你想进一步看你这套房当前的估值区间，我可以继续帮你拉一版专属数据。`,
    },
  };
}

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
      ? parsed.insightBullets.map((item) => cleanText(item)).filter(Boolean).slice(0, 6)
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
        ? parsed.shareKit.hashtags.map((item) => cleanText(item)).filter(Boolean).slice(0, 8)
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
): Promise<{ narrative: MagnetNarrative; model: string; usedFallback: boolean; fallbackReason: string | null }> {
  const candidateModels = Array.from(
    new Set([ENV.openaiAreaMagnetModel, ENV.openaiModel].filter(Boolean))
  );

  const systemPrompt = [
    "You are a senior US real-estate marketing strategist building lead magnets for working agents.",
    "Turn structured market data into a high-conviction but truthful report.",
    "Use only the provided facts. Do not invent school ratings, commercial projects, or private deal intel.",
    "Write concise, commercial, agent-ready copy. Avoid generic fluff.",
    "Return JSON only.",
  ].join(" ");

  const userPrompt = JSON.stringify(
    {
      task: "Generate an Area Magnet report and sharing kit",
      requirements: {
        titleStyle: "concise, premium, shareable",
        insightCount: 4,
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
        provider: "openai",
        model,
        responseFormat: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      });

      const narrative = parseNarrative(extractText(result));
      return {
        narrative: {
          ...buildFallbackNarrative(input, snapshot),
          ...narrative,
          insightBullets:
            narrative.insightBullets.length > 0
              ? narrative.insightBullets
              : buildFallbackNarrative(input, snapshot).insightBullets,
          reportSections:
            narrative.reportSections.length > 0
              ? narrative.reportSections
              : buildFallbackNarrative(input, snapshot).reportSections,
          shareKit: {
            ...buildFallbackNarrative(input, snapshot).shareKit,
            ...narrative.shareKit,
            hashtags:
              narrative.shareKit.hashtags.length > 0
                ? narrative.shareKit.hashtags
                : buildFallbackNarrative(input, snapshot).shareKit.hashtags,
          },
          cta: {
            ...buildFallbackNarrative(input, snapshot).cta,
            ...narrative.cta,
          },
        },
        model,
        usedFallback: false,
        fallbackReason: null,
      };
    } catch (error) {
      lastError = error instanceof Error ? error.message : "unknown_llm_error";
    }
  }

  return {
    narrative: buildFallbackNarrative(input, snapshot),
    model: candidateModels[0] ?? ENV.openaiModel,
    usedFallback: true,
    fallbackReason: lastError,
  };
}

export async function generateAreaMagnetReport(
  input: GenerateAreaMagnetInput
): Promise<AreaMagnetGenerationResult> {
  const normalizedInput: GenerateAreaMagnetInput = {
    ...input,
    query: input.query.trim(),
    captureFields: input.captureFields.length > 0 ? input.captureFields : ["email"],
  };

  const { activeListings, soldListings } = await fetchInventory(normalizedInput);
  if (activeListings.length === 0 && soldListings.length === 0) {
    throw new Error("No listing data was available for this area. Try a nearby ZIP, neighborhood, or building.");
  }

  const snapshot = buildSnapshot(normalizedInput, activeListings, soldListings);
  const generation = await generateNarrative(normalizedInput, snapshot);

  const metrics = [
    { label: "Active inventory", value: String(snapshot.activeCount), detail: `${snapshot.scopeLabel} live listings` },
    { label: "Recent sold sample", value: String(snapshot.soldCount), detail: "Recent close records" },
    { label: "Median list price", value: formatCurrency(snapshot.activeMedianPrice), detail: "Current asking median" },
    { label: "Median sold price", value: formatCurrency(snapshot.soldMedianPrice), detail: "Recent sold median" },
    { label: "Average DOM", value: snapshot.averageDom ? `${Math.round(snapshot.averageDom)} days` : "N/A", detail: "Visible market tempo" },
    {
      label: "Sold / list ratio",
      value: snapshot.soldToListRatio ? `${(snapshot.soldToListRatio * 100).toFixed(1)}%` : "N/A",
      detail: "Close price vs. ask",
    },
  ];

  const title = generation.narrative.title || defaultTitle(normalizedInput, snapshot.scopeLabel);
  const strategyPoints = generation.narrative.insightBullets.slice(0, 5);
  const listingKeys = snapshot.featuredListings.map((listing) => listing.listingKey).filter(Boolean);

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
        propertyTypeMix: snapshot.propertyTypeMix,
      },
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
