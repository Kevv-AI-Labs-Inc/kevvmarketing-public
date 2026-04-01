/**
 * Home Value Estimation Engine
 *
 * Three-stage pipeline (each stage falls back gracefully):
 *
 *  Stage 1 — Address resolution via BBO
 *    POST /api/v1/listings/by-address  →  subject listing + listingKey
 *
 *  Stage 2 — CMA + Neighborhood (parallel, only when Stage 1 succeeds)
 *    POST /api/internal/cma/by-listing           →  real closed comps
 *    GET  /api/internal/neighborhoods/:zip/summary →  school / walk / median price
 *
 *  Stage 3 — AI synthesis (when comps are available)
 *    invokeLLM() with subject + comps + neighborhood context
 *    → structured ValuationResult JSON
 *
 *  Fallback — heuristic estimate (city-bias + address hash seed)
 *    Used whenever BBO is unreachable or returns no useful data.
 *
 * Cost per call (with BBO configured):
 *   BBO calls: free (internal)
 *   AI tokens: ~$0.003-0.005 (GPT-4o / Gemini)
 *   Embedding: $0 (BBO generates embeddings for CMA internally)
 *
 * Latency p50 with BBO:
 *   Stage 1 (~300 ms) → Stage 2 parallel (~400 ms) → Stage 3 (~1.2 s)
 *   Total ≈ 1.9-2.2 s  (user sees "Generating..." animation)
 */

import { ENV } from "@/server/_core/env";
import { invokeLLM } from "@/server/_core/llm";
import {
  resolveByAddress,
  getCmaByListing,
  getNeighborhoodSummary,
} from "@/server/clients/listingDataClient";
import { buildDemoValuationResult } from "@/server/demo/factories";
import type { ValuationResult } from "@/lib/db/schema";
import type {
  ListingData,
  CmaComparable,
  NeighborhoodSummary,
} from "@/server/clients/types";
import { ListingDataServiceError } from "@/server/clients/types";

// ─── Types ─────────────────────────────────────────────────────

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

// ─── Utilities ─────────────────────────────────────────────────

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function roundToNearestThousand(value: number): number {
  return Math.round(value / 1000) * 1000;
}

function extractCity(address: string): string | null {
  const parts = address
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  return parts.length >= 2 ? parts[1] : null;
}

// ─── Stage 1: Address Resolution ──────────────────────────────

/**
 * Resolve subject property via BBO's strict address resolver.
 * Returns null on 404 (not found) or 409 (ambiguous).
 * Both cases fall through to heuristic gracefully.
 */
async function tryResolveSubject(
  address: string,
): Promise<{ listing: ListingData; listingKey: string } | null> {
  if (!ENV.listingDataServiceUrl) return null;
  try {
    const res = await resolveByAddress({ address });
    const listing = res.property;
    const listingKey = listing?.listingKey;
    if (!listingKey) return null;
    return { listing, listingKey };
  } catch (err) {
    // 404 = not in MLS, 409 = ambiguous address → both are non-fatal
    if (
      err instanceof ListingDataServiceError &&
      (err.statusCode === 404 || err.statusCode === 409)
    ) {
      return null;
    }
    // Log unexpected errors but don't crash the valuation
    console.warn("[valuationEngine] resolveByAddress failed:", err);
    return null;
  }
}

// ─── Stage 2a: CMA Comparables ────────────────────────────────

/**
 * Fetch closed comps from BBO's CMA engine.
 * BBO handles vector embedding + pgvector similarity search internally.
 * Falls back to SQL-based comp selection if vectors aren't available.
 */
async function tryGetCmaComps(listingKey: string): Promise<CmaComparable[]> {
  try {
    const res = await getCmaByListing(listingKey, 5);
    return res.data.comparables ?? [];
  } catch {
    return [];
  }
}

// ─── Stage 2b: Neighborhood Data ──────────────────────────────

/**
 * Fetch neighborhood profile from BBO by ZIP code.
 * Provides schoolRating, walkScore, medianHomePrice, profileText.
 */
async function tryGetNeighborhood(
  postalCode: string | null | undefined,
): Promise<NeighborhoodSummary | null> {
  if (!postalCode) return null;
  try {
    return await getNeighborhoodSummary(postalCode);
  } catch {
    return null;
  }
}

// ─── Stage 3: AI Synthesis ─────────────────────────────────────

function buildValuationPrompt({
  address,
  listing,
  comps,
  neighborhood,
  locale,
}: {
  address: string;
  listing: ListingData | null;
  comps: CmaComparable[];
  neighborhood: NeighborhoodSummary | null;
  locale: "en" | "zh";
}): string {
  // Subject property block
  const subjectBlock = listing
    ? `SUBJECT PROPERTY (from MLS):
  Address   : ${listing.unparsedAddress}
  Status    : ${listing.standardStatus}
  List Price: ${listing.listPrice}
  Beds/Baths: ${listing.bedroomsTotal ?? "?"} bd / ${listing.bathroomsTotalInteger ?? "?"} ba
  Sqft      : ${listing.livingArea ?? "unknown"}
  Year Built: ${listing.yearBuilt ?? "unknown"}
  Type      : ${listing.propertyType}`
    : `SUBJECT PROPERTY: ${address}
  (Not found in active MLS — use comps only to derive estimate)`;

  // Comparable sales block
  const compsBlock = comps
    .map((c, i) => {
      const score = c.score !== null ? ` (similarity ${c.score.toFixed(3)})` : "";
      return `Comp ${i + 1}${score}:
  Address   : ${c.address ?? "unknown"}
  City      : ${c.city ?? "unknown"}
  Sale Price: ${c.price ?? "unknown"}
  Status    : ${c.status ?? "unknown"}
  Beds/Baths: ${c.bedrooms ?? "?"} bd / ${c.bathrooms ?? "?"} ba
  Sqft      : ${c.livingArea ?? "unknown"}`;
    })
    .join("\n\n");

  // Neighborhood block (rich context for AI)
  const neighborhoodBlock = neighborhood
    ? `NEIGHBORHOOD DATA (ZIP ${neighborhood.zipCode}):
  Name            : ${neighborhood.name ?? neighborhood.city ?? "unknown"}
  School Rating   : ${neighborhood.schoolRating ?? "N/A"}/10
  Walk Score      : ${neighborhood.walkScore ?? "N/A"}/100
  Crime Index     : ${neighborhood.crimeIndex ?? "N/A"} (lower = safer)
  Median Home Price: ${neighborhood.medianHomePrice ?? "N/A"}
  Profile         : ${neighborhood.profileText ?? "N/A"}`
    : `NEIGHBORHOOD DATA: Not available for this area`;

  const langNote =
    locale === "zh"
      ? 'Write "marketSummary" and "neighborhoodTrend" in Simplified Chinese.'
      : 'Write "marketSummary" and "neighborhoodTrend" in English.';

  return `You are a licensed real estate appraiser. Analyze the subject property, comparable sales, and neighborhood data to produce a market value estimate.

${subjectBlock}

COMPARABLE CLOSED SALES (from BBO vector/CMA engine):
${compsBlock}

${neighborhoodBlock}

${langNote}

Return ONLY valid JSON — no markdown fences, no extra keys, no explanation:
{
  "estimatedValue": <integer, best point estimate in USD>,
  "estimatedValueLow": <integer, conservative low end ~4-5% below center>,
  "estimatedValueHigh": <integer, optimistic high end ~4-5% above center>,
  "appreciationRate": <float, estimated YoY appreciation %, e.g. 4.2>,
  "propertyDetails": {
    "beds": <integer>,
    "baths": <integer>,
    "sqft": <integer>,
    "yearBuilt": <integer>,
    "lotSize": "<string, e.g. '5200 sqft'>",
    "propertyType": "<string>"
  },
  "comparableSales": [
    {
      "address": "<string>",
      "price": <integer sale price>,
      "date": "<YYYY-MM-DD or approximate>",
      "beds": <integer>,
      "baths": <integer>,
      "sqft": <integer>
    }
  ],
  "schoolRating": <integer 1-10, use neighborhood data if available>,
  "neighborhoodTrend": "<one sentence>",
  "marketSummary": "<2-3 sentences about this property's value and current market context>"
}`;
}

async function synthesizeWithAI({
  address,
  listing,
  comps,
  neighborhood,
  locale,
  seed,
}: {
  address: string;
  listing: ListingData | null;
  comps: CmaComparable[];
  neighborhood: NeighborhoodSummary | null;
  locale: "en" | "zh";
  seed: number;
}): Promise<ValuationResult | null> {
  try {
    const prompt = buildValuationPrompt({ address, listing, comps, neighborhood, locale });

    const response = await invokeLLM({
      task: "home-value",
      messages: [
        {
          role: "system",
          content:
            "You are a professional real estate appraiser. Return only valid JSON matching the schema provided. No markdown. No explanation outside the JSON.",
        },
        { role: "user", content: prompt },
      ],
      responseFormat: { type: "json_object" },
    });

    const raw =
      typeof response.choices[0].message.content === "string"
        ? response.choices[0].message.content
        : JSON.stringify(response.choices[0].message.content);

    const parsed = JSON.parse(raw) as Partial<ValuationResult>;
    if (!parsed.estimatedValue || typeof parsed.estimatedValue !== "number") return null;

    const demo = buildDemoValuationResult();
    const ev = parsed.estimatedValue;

    // Use neighborhood schoolRating if AI didn't provide one
    const schoolRating =
      parsed.schoolRating ??
      neighborhood?.schoolRating ??
      7 + (seed % 3);

    return {
      ...demo,
      ...parsed,
      estimatedValue: roundToNearestThousand(ev),
      estimatedValueLow: roundToNearestThousand(
        parsed.estimatedValueLow ?? Math.round(ev * 0.955),
      ),
      estimatedValueHigh: roundToNearestThousand(
        parsed.estimatedValueHigh ?? Math.round(ev * 1.045),
      ),
      appreciationRate: parsed.appreciationRate ?? 3.5,
      propertyDetails: {
        ...demo.propertyDetails,
        ...(parsed.propertyDetails ?? {}),
        beds: parsed.propertyDetails?.beds ?? listing?.bedroomsTotal ?? 3 + (seed % 3),
        baths:
          parsed.propertyDetails?.baths ?? listing?.bathroomsTotalInteger ?? 2 + (seed % 2),
        sqft:
          parsed.propertyDetails?.sqft ??
          (Number(String(listing?.livingArea ?? "").replace(/[^\d.]/g, "")) ||
            1600 + (seed % 1600)),
        yearBuilt:
          parsed.propertyDetails?.yearBuilt ??
          listing?.yearBuilt ??
          1978 + (seed % 38),
      },
      comparableSales:
        parsed.comparableSales && parsed.comparableSales.length > 0
          ? parsed.comparableSales
          : demo.comparableSales,
      schoolRating,
      neighborhoodTrend: parsed.neighborhoodTrend ?? demo.neighborhoodTrend,
      marketSummary: parsed.marketSummary ?? demo.marketSummary,
    } as ValuationResult;
  } catch {
    // LLM unavailable, JSON parse error, network issue → fall through
    return null;
  }
}

// ─── Heuristic Fallback ────────────────────────────────────────

function buildLocalizedSummary(params: {
  city: string;
  locale: "en" | "zh";
  estimatedValue: number;
  appreciationRate: number;
}): string {
  const fmt = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

  if (params.locale === "zh") {
    return `${params.city} 当前市场对整备充分、定价清晰的房源依然有吸引力。按 Kevv 的估值逻辑，这套房产当前合理区间大约在 ${fmt.format(params.estimatedValue)} 左右，过去一年预计涨幅约 ${params.appreciationRate.toFixed(1)}%。建议下一步用真实成交和上市竞品把上市策略收窄。`;
  }

  return `${params.city} is still rewarding homes that launch with clean prep, disciplined pricing, and a tight seller story. Kevv's estimate puts this property around ${fmt.format(params.estimatedValue)}, with an estimated ${params.appreciationRate.toFixed(1)}% year-over-year gain. The next step is to tighten the range with live comps and a real launch plan.`;
}

function buildHeuristicEstimate({
  listing,
  locale,
  city,
  seed,
}: {
  listing: ListingData | null;
  locale: "en" | "zh";
  city: string;
  seed: number;
}): ValuationResult {
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

  const appreciationRate = 3.2 + (seed % 35) / 10;
  const spread = Math.max(estimatedValue * 0.045, 55_000);
  const low = roundToNearestThousand(estimatedValue - spread);
  const high = roundToNearestThousand(estimatedValue + spread);
  const center = roundToNearestThousand((low + high) / 2);

  const demo = buildDemoValuationResult();
  const beds = listing?.bedroomsTotal ?? 3 + (seed % 3);
  const baths = listing?.bathroomsTotalInteger ?? 2 + (seed % 2);
  const sqft =
    Number(String(listing?.livingArea ?? "").replace(/[^\d.]/g, "")) ||
    1600 + (seed % 1600);
  const yearBuilt =
    typeof listing?.yearBuilt === "number" ? listing.yearBuilt : 1978 + (seed % 38);

  return {
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
    marketSummary: buildLocalizedSummary({ city, locale, estimatedValue: center, appreciationRate }),
  };
}

// ─── Main Export ───────────────────────────────────────────────

export async function generateHomeValueEstimate({
  address,
  locale = "en",
  fallbackArea,
}: GenerateHomeValueEstimateInput): Promise<HomeValueEstimate> {
  const seed = hashString(address);

  // ── Stage 1: Resolve subject property (~300 ms) ────────────
  const resolved = await tryResolveSubject(address);
  const listing = resolved?.listing ?? null;
  const listingKey = resolved?.listingKey ?? null;

  const city =
    listing?.city || extractCity(address) || fallbackArea || "Local market";

  // ── Stage 2: CMA comps + Neighborhood (parallel, ~400 ms) ──
  const [comps, neighborhood] = listingKey
    ? await Promise.all([
        tryGetCmaComps(listingKey),
        tryGetNeighborhood(listing?.postalCode),
      ])
    : [[], null];

  // ── Stage 3: AI synthesis (when we have real comps) ────────
  if (comps.length > 0) {
    const aiResult = await synthesizeWithAI({
      address,
      listing,
      comps,
      neighborhood,
      locale,
      seed,
    });

    if (aiResult) {
      return {
        result: aiResult,
        modelUsed: "kevv-home-value-ai-v1",
        provider: `bbo-cma(${comps.length},${neighborhood ? "neighborhood" : "no-neighborhood"})`,
        summary: aiResult.marketSummary,
      };
    }
  }

  // ── Fallback: heuristic estimate ────────────────────────────
  const result = buildHeuristicEstimate({ listing, locale, city, seed });

  return {
    result,
    modelUsed: "kevv-home-value-v1",
    provider: listing ? "bbo-listing+heuristic" : "heuristic",
    summary: result.marketSummary,
  };
}
