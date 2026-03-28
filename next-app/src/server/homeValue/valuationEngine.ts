import { ENV } from "@/server/_core/env";
import { searchListings } from "@/server/clients/listingDataClient";
import { buildDemoValuationResult } from "@/server/demo/factories";
import type { ValuationResult } from "@/lib/db/schema";

type GenerateHomeValueEstimateInput = {
  address: string;
  locale?: "en" | "zh";
  fallbackArea?: string | null;
};

type HomeValueEstimate = {
  result: ValuationResult;
  modelUsed: string;
  provider: string;
  summary: string;
};

function hashString(input: string) {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function roundToNearestThousand(value: number) {
  return Math.round(value / 1000) * 1000;
}

function extractCity(address: string) {
  const parts = address
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length >= 2) return parts[1];
  return null;
}

function buildLocalizedSummary(params: {
  city: string;
  locale: "en" | "zh";
  estimatedValue: number;
  appreciationRate: number;
}) {
  if (params.locale === "zh") {
    return `${params.city} 当前市场对整备充分、定价清晰的房源依然有吸引力。按 Kevv 的估值逻辑，这套房产当前合理区间大约在 ${new Intl.NumberFormat(
      "en-US",
      {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      }
    ).format(params.estimatedValue)} 左右，过去一年预计涨幅约 ${params.appreciationRate.toFixed(1)}%。建议下一步用真实成交和上市竞品把上市策略收窄。`;
  }

  return `${params.city} is still rewarding homes that launch with clean prep, disciplined pricing, and a tight seller story. Kevv's estimate puts this property around ${new Intl.NumberFormat(
    "en-US",
    {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }
  ).format(params.estimatedValue)}, with an estimated ${params.appreciationRate.toFixed(
    1
  )}% year-over-year gain. The next step is to tighten the range with live comps and a real launch plan.`;
}

async function tryHydrateFromListingData(address: string) {
  if (!ENV.listingDataServiceUrl) return null;

  try {
    const response = await searchListings({
      search: address,
      perPage: 1,
      page: 1,
    });

    return response.data[0] ?? null;
  } catch {
    return null;
  }
}

export async function generateHomeValueEstimate({
  address,
  locale = "en",
  fallbackArea,
}: GenerateHomeValueEstimateInput): Promise<HomeValueEstimate> {
  const seed = hashString(address);
  const listing = await tryHydrateFromListingData(address);
  const city = listing?.city || extractCity(address) || fallbackArea || "Local market";

  const cityBias =
    /palo alto|menlo park|cupertino|los altos|atherton/i.test(city)
      ? 1_900_000
      : /new york|manhattan|brooklyn|queens/i.test(city)
        ? 1_350_000
        : /seattle|bellevue|redmond/i.test(city)
          ? 1_250_000
          : /irvine|newport|pasadena/i.test(city)
            ? 1_550_000
            : 820_000;

  const estimatedValue = listing?.listPrice
    ? Number(String(listing.listPrice).replace(/[^\d.]/g, "")) || cityBias
    : cityBias + (seed % 950_000);

  const appreciationRate = 3.2 + ((seed % 35) / 10);
  const spread = Math.max(estimatedValue * 0.045, 55_000);
  const low = roundToNearestThousand(estimatedValue - spread);
  const high = roundToNearestThousand(estimatedValue + spread);
  const center = roundToNearestThousand((low + high) / 2);

  const demo = buildDemoValuationResult();
  const beds =
    listing?.bedroomsTotal ??
    listing?.bedroomsTotal ??
    3 + (seed % 3);
  const baths = listing?.bathroomsTotalInteger ?? 2 + (seed % 2);
  const sqft =
    Number(String(listing?.livingArea ?? "").replace(/[^\d.]/g, "")) ||
    1600 + (seed % 1600);
  const yearBuilt =
    typeof listing?.yearBuilt === "number" ? listing.yearBuilt : 1978 + (seed % 38);

  const result: ValuationResult = {
    ...demo,
    estimatedValueLow: low,
    estimatedValueHigh: high,
    estimatedValue: center,
    appreciationRate,
    propertyDetails: {
      beds,
      baths,
      sqft,
      yearBuilt,
      lotSize: `${4800 + (seed % 4200)} sqft`,
      propertyType: listing?.propertyType || "Single Family",
    },
    comparableSales: [0, 1, 2].map((offset) => ({
      address: `${100 + ((seed + offset * 17) % 900)} ${city} Ave`,
      price: roundToNearestThousand(center - 95_000 + offset * 62_000),
      date: new Date(Date.now() - (offset + 1) * 21 * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10),
      beds: Math.max(2, beds - (offset % 2)),
      baths: Math.max(2, baths),
      sqft: Math.max(900, sqft - 120 + offset * 75),
    })),
    schoolRating: 7 + (seed % 3),
    neighborhoodTrend:
      locale === "zh"
        ? "优质学区和通勤友好型社区仍然有稳定需求。"
        : "Well-prepped homes in commute-friendly neighborhoods are still clearing quickly.",
    marketSummary: buildLocalizedSummary({
      city,
      locale,
      estimatedValue: center,
      appreciationRate,
    }),
  };

  return {
    result,
    modelUsed: "kevv-home-value-v1",
    provider: listing ? "listing-data+heuristic" : "heuristic",
    summary: result.marketSummary,
  };
}
