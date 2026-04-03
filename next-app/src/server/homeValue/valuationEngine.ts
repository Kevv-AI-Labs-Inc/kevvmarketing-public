/**
 * Home Value Estimation Engine
 *
 * Enhanced multi-stage pipeline with robust address resolution:
 *
 *  Stage 0 — Input detection: MLS ID vs address
 *    Detects "KEY123456" or pure numeric MLS IDs → routes to by-mls lookup
 *
 *  Stage 1 — Address resolution via BBO (3-tier fallback)
 *    1a. POST /api/v1/listings/by-address  →  strict match (parsed address fields)
 *    1b. On 409 (ambiguous) → pick highest-confidence candidate automatically
 *    1c. On 404 → POST /api/v1/listings/address-candidates → fuzzy trigram match
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
  getAddressCandidates,
  getListingsByLocation,
  getListingByMls,
  getListing,
  getListingMedia,
  getListingsBatch,
  getCmaByListing,
  getNeighborhoodSummary,
} from "@/server/clients/listingDataClient";
import { geocodeWithGoogle } from "@/server/mapProviders/googleProvider";
import { buildDemoValuationResult } from "@/server/demo/factories";
import type { ValuationResult } from "@/lib/db/schema";
import type {
  ListingData,
  CmaComparable,
  NeighborhoodSummary,
  AddressCandidate,
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
  /** Describes how confident we are in the data backing this estimate */
  dataConfidence: "high" | "medium" | "low";
  /** Human-readable label for data source */
  dataSource: string;
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

/**
 * Parse a full address string into structured fields for BBO.
 * e.g. "123 Main St, Irvine, CA 92618" → { address: "123 Main St", city: "Irvine", stateOrProvince: "CA", postalCode: "92618" }
 */
function parseAddressFields(raw: string): {
  address: string;
  city?: string;
  stateOrProvince?: string;
  postalCode?: string;
} {
  const segments = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (segments.length === 0) return { address: raw };
  if (segments.length === 1) return { address: segments[0] };

  const address = segments[0];
  const city = segments[1] || undefined;

  // Last segment(s) might contain "CA 92618" or "CA 92618, USA"
  const tail = segments.slice(2).join(" ").replace(/,?\s*USA$/i, "").trim();
  const stateMatch = tail.match(/\b([A-Z]{2})\b/i);
  const postalMatch = tail.match(/\b(\d{5}(?:-\d{4})?)\b/);

  return {
    address,
    city,
    stateOrProvince: stateMatch?.[1]?.toUpperCase(),
    postalCode: postalMatch?.[1],
  };
}

/**
 * Detect if user input looks like an MLS ID rather than a street address.
 * MLS IDs: pure numbers (5+ digits), or KEY-prefixed, or alphanumeric without spaces.
 */
function looksLikeMlsId(input: string): boolean {
  const trimmed = input.trim();
  // Pure numeric (5+ digits)
  if (/^\d{5,}$/.test(trimmed)) return true;
  // KEY-prefixed
  if (/^KEY\d+$/i.test(trimmed)) return true;
  // Alphanumeric without spaces, 5-30 chars (like "MLS12345" or "OH2345678")
  if (/^[A-Z0-9]{5,30}$/i.test(trimmed) && !/\s/.test(trimmed) && !/^\d{1,4}$/.test(trimmed)) {
    return true;
  }
  return false;
}

// ─── Stage 0: MLS ID Resolution ──────────────────────────────

/**
 * Try to resolve input as an MLS ID.
 * Tries getListingByMls first, then getListing (by-key) for KEY-prefixed IDs.
 */
async function tryResolveMlsId(
  mlsId: string,
): Promise<{ listing: ListingData; listingKey: string } | null> {
  if (!ENV.listingDataServiceUrl) return null;

  try {
    const res = await getListingByMls(mlsId);
    const listing = res.data;
    if (!listing?.listingKey) return null;
    return { listing, listingKey: listing.listingKey };
  } catch {
    // Try as listingKey directly (for KEY-prefixed inputs)
    if (/^KEY/i.test(mlsId)) {
      try {
        const res = await getListing(mlsId);
        const listing = res.data;
        if (!listing?.listingKey) return null;
        return { listing, listingKey: listing.listingKey };
      } catch {
        return null;
      }
    }
    return null;
  }
}

// ─── Stage 1: Address Resolution (3-tier) ────────────────────

/**
 * Enhanced address resolution with 3-tier fallback:
 * 1. Strict by-address with parsed fields
 * 2. On 409, pick highest-confidence candidate
 * 3. On 404, try fuzzy address-candidates
 */
async function tryResolveSubject(
  address: string,
): Promise<{ listing: ListingData; listingKey: string } | null> {
  if (!ENV.listingDataServiceUrl) return null;

  const parsed = parseAddressFields(address);

  // ── Tier 1: Strict address resolution ──
  try {
    const res = await resolveByAddress(parsed);
    const listing = res.property;
    const listingKey = listing?.listingKey;
    if (!listingKey) return null;
    return { listing, listingKey };
  } catch (err) {
    if (err instanceof ListingDataServiceError) {
      // ── Tier 2: Ambiguous → pick best candidate ──
      if (err.statusCode === 409) {
        return tryPickBestCandidate(parsed);
      }
      // ── Tier 3: Not found → fuzzy search ──
      if (err.statusCode === 404) {
        return tryFuzzyAddressSearch(parsed);
      }
    }
    console.warn("[valuationEngine] resolveByAddress failed:", err);
    return null;
  }
}

/**
 * When by-address returns 409 (multiple matches), use address-candidates
 * to get ranked candidates and pick the highest-confidence one.
 */
async function tryPickBestCandidate(
  parsed: ReturnType<typeof parseAddressFields>,
): Promise<{ listing: ListingData; listingKey: string } | null> {
  try {
    const res = await getAddressCandidates({ ...parsed, limit: 5 });
    const candidates = res.data ?? [];
    return pickAndHydrateCandidate(candidates);
  } catch (err) {
    console.warn("[valuationEngine] address-candidates (409 fallback) failed:", err);
    return null;
  }
}

/**
 * When by-address returns 404, use address-candidates for fuzzy trigram matching.
 */
async function tryFuzzyAddressSearch(
  parsed: ReturnType<typeof parseAddressFields>,
): Promise<{ listing: ListingData; listingKey: string } | null> {
  try {
    const res = await getAddressCandidates({ ...parsed, limit: 5 });
    const candidates = res.data ?? [];
    return pickAndHydrateCandidate(candidates);
  } catch (err) {
    console.warn("[valuationEngine] address-candidates (fuzzy fallback) failed:", err);
    return null;
  }
}

/**
 * From a ranked list of candidates, pick the best one (highest confidence)
 * and hydrate it via getListing (by-key) to get full listing data.
 */
async function pickAndHydrateCandidate(
  candidates: AddressCandidate[],
): Promise<{ listing: ListingData; listingKey: string } | null> {
  if (candidates.length === 0) return null;

  // Sort by confidence descending, prefer "Active" status
  const sorted = [...candidates]
    .filter((c) => c.listingKey)
    .sort((a, b) => {
      const confDiff = (b.confidence ?? 0) - (a.confidence ?? 0);
      if (confDiff !== 0) return confDiff;
      // Prefer Active listings
      const aActive = a.standardStatus?.toLowerCase() === "active" ? 1 : 0;
      const bActive = b.standardStatus?.toLowerCase() === "active" ? 1 : 0;
      return bActive - aActive;
    });

  // Try the best candidate (minimum 0.5 confidence)
  const best = sorted[0];
  if (!best?.listingKey || (best.confidence ?? 0) < 0.5) return null;

  try {
    const res = await getListing(best.listingKey);
    const listing = res.data;
    if (!listing?.listingKey) return null;
    return { listing, listingKey: listing.listingKey };
  } catch {
    return null;
  }
}

// ─── Stage 1b: Geocode + Spatial Proximity ───────────────────

/**
 * Stage 1b: Geocode address -> spatial proximity query.
 * When text-based matching fails, fall back to lat/lng coordinates.
 * Google Places Autocomplete already validated the address exists.
 */
async function tryResolveByGeocode(
  address: string,
): Promise<{ listing: ListingData; listingKey: string } | null> {
  if (!ENV.listingDataServiceUrl) return null;

  try {
    const geo = await geocodeWithGoogle(address);
    if (!geo.latitude || !geo.longitude) return null;

    const res = await getListingsByLocation({
      latitude: geo.latitude,
      longitude: geo.longitude,
      radiusKm: 0.3, // ~0.2 miles — tight radius for residential
      limit: 5,
    });

    const listings = res.items ?? [];
    if (listings.length === 0) return null;

    // Pick the closest listing (items are sorted by distance from BBO)
    const best = listings[0];
    if (!best?.data?.listingKey) return null;

    // Hydrate via getListing for full data
    const full = await getListing(best.data.listingKey);
    return { listing: full.data, listingKey: full.data.listingKey };
  } catch (err) {
    console.warn("[valuationEngine] geocode+spatial fallback failed:", err);
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

// ─── Stage 2c: Property Images ──────────────────────────────────

/**
 * Fetch hero image URL for the subject property.
 * Uses the listing media endpoint from BBO.
 */
async function tryGetSubjectImage(listingKey: string): Promise<string | null> {
  try {
    const res = await getListingMedia(listingKey);
    const items = res?.data ?? [];
    // Pick first image sorted by order
    const first = Array.isArray(items)
      ? items.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))[0]
      : null;
    return first?.mediaURL ?? null;
  } catch {
    return null;
  }
}

/**
 * Fetch thumbnail images for CMA comparable properties.
 * Uses batch lookup to minimize API calls.
 * Returns a map of listingKey → first image URL.
 */
async function tryGetCompImages(
  compKeys: string[],
): Promise<Map<string, string>> {
  const imageMap = new Map<string, string>();
  if (compKeys.length === 0) return imageMap;

  try {
    const batch = await getListingsBatch(compKeys);
    for (const [key, listing] of batch) {
      const firstImg = listing.imageUrls?.[0] ?? null;
      if (firstImg) imageMap.set(key, firstImg);
    }
  } catch {
    // Non-critical — comps will just lack images
  }
  return imageMap;
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
    return `${params.city} 当前市场对整备充分、定价清晰的房源依然有吸引力。按 Kevv 的估值逻辑，这套房产当前合理区间大约在 ${fmt.format(params.estimatedValue)} 左右，过去一年预计涨幅约 ${params.appreciationRate.toFixed(1)}%。建议下一步联系经纪人获取基于真实成交数据的精确 CMA 报告。`;
  }

  return `${params.city} is still rewarding homes that launch with clean prep, disciplined pricing, and a tight seller story. Kevv's preliminary estimate puts this property around ${fmt.format(params.estimatedValue)}, with an estimated ${params.appreciationRate.toFixed(1)}% year-over-year gain. Contact your agent for a detailed CMA backed by real comparable sales.`;
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
    /palo alto|menlo park|cupertino|los altos|atherton|mountain view|sunnyvale|san jose|santa clara|saratoga|los gatos/i.test(city)
      ? 1_900_000
      : /new york|manhattan|brooklyn|queens|bronx|long island|nassau|suffolk/i.test(city)
        ? 1_350_000
        : /seattle|bellevue|redmond|kirkland|bothell/i.test(city)
          ? 1_250_000
          : /irvine|newport|pasadena|arcadia|san gabriel|alhambra|temple city|walnut|diamond bar|rowland heights|hacienda heights/i.test(city)
            ? 1_550_000
            : /san francisco|daly city|south san francisco/i.test(city)
              ? 1_650_000
              : /los angeles|glendale|burbank|beverly hills|santa monica|west hollywood/i.test(city)
                ? 1_400_000
                : /fremont|union city|newark|milpitas|hayward/i.test(city)
                  ? 1_350_000
                  : /san diego|la jolla|carlsbad|encinitas/i.test(city)
                    ? 1_100_000
                    : /austin|houston|dallas|fort worth|san antonio/i.test(city)
                      ? 550_000
                      : /chicago|evanston|naperville/i.test(city)
                        ? 480_000
                        : /miami|fort lauderdale|boca raton|palm beach/i.test(city)
                          ? 750_000
                          : /boston|cambridge|brookline/i.test(city)
                            ? 950_000
                            : /portland|beaverton|lake oswego/i.test(city)
                              ? 680_000
                              : /denver|boulder|aurora/i.test(city)
                                ? 650_000
                                : /phoenix|scottsdale|tempe|chandler|gilbert/i.test(city)
                                  ? 520_000
                                  : /las vegas|henderson/i.test(city)
                                    ? 430_000
                                    : /washington|arlington|bethesda|mclean/i.test(city)
                                      ? 850_000
                                      : 620_000;

  const estimatedValue = listing?.listPrice
    ? Number(String(listing.listPrice).replace(/[^\d.]/g, "")) || cityBias
    : cityBias + (seed % Math.round(cityBias * 0.35));

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

// ─── Image Enrichment ────────────────────────────────────────

/**
 * Attach real MLS photos to comparable sales in the AI result,
 * matching by address (AI comp address → BBO comp address).
 * Also attach subject property hero image.
 */
function enrichResultWithImages(
  result: ValuationResult,
  bboComps: CmaComparable[],
  compImages: Map<string, string>,
  subjectImageUrl: string | null,
): ValuationResult {
  // Build address → imageUrl map from BBO comps
  const addrToImage = new Map<string, string>();
  for (const comp of bboComps) {
    const key = comp.listingKey;
    const img = compImages.get(key);
    if (img && comp.address) {
      addrToImage.set(comp.address.toLowerCase().trim(), img);
      // Also map by listingKey in case AI uses it
      addrToImage.set(key.toLowerCase(), img);
    }
  }

  const enrichedComps = result.comparableSales.map((sale) => {
    // Try exact address match first
    const addrKey = sale.address.toLowerCase().trim();
    let imageUrl = addrToImage.get(addrKey);
    // Fuzzy: check if any BBO comp address starts with the same street number+name
    if (!imageUrl) {
      for (const [bboAddr, img] of addrToImage) {
        if (bboAddr.startsWith(addrKey.split(",")[0]) || addrKey.startsWith(bboAddr.split(",")[0])) {
          imageUrl = img;
          break;
        }
      }
    }
    return imageUrl ? { ...sale, imageUrl } : sale;
  });

  return {
    ...result,
    comparableSales: enrichedComps,
    subjectImageUrl: subjectImageUrl ?? undefined,
  };
}

// ─── Main Export ───────────────────────────────────────────────

export async function generateHomeValueEstimate({
  address,
  locale = "en",
  fallbackArea,
}: GenerateHomeValueEstimateInput): Promise<HomeValueEstimate> {
  const seed = hashString(address);
  const trimmedAddress = address.trim();

  // ── Stage 0: MLS ID detection ──────────────────────────────
  let resolved: { listing: ListingData; listingKey: string } | null = null;

  if (looksLikeMlsId(trimmedAddress)) {
    resolved = await tryResolveMlsId(trimmedAddress);
    // If MLS lookup fails, still try as address
    if (!resolved) {
      resolved = await tryResolveSubject(trimmedAddress);
    }
  } else {
    // ── Stage 1: Address resolution (3-tier fallback) ──────
    resolved = await tryResolveSubject(trimmedAddress);
  }

  // ── Stage 1b: Geocode + spatial fallback ─────────────────
  if (!resolved) {
    resolved = await tryResolveByGeocode(trimmedAddress);
  }

  const listing = resolved?.listing ?? null;
  const listingKey = resolved?.listingKey ?? null;

  const city =
    listing?.city || extractCity(address) || fallbackArea || "Local market";

  // ── Stage 2: CMA comps + Neighborhood + Subject Image (parallel) ──
  const [comps, neighborhood, subjectImageUrl] = listingKey
    ? await Promise.all([
        tryGetCmaComps(listingKey),
        tryGetNeighborhood(listing?.postalCode),
        tryGetSubjectImage(listingKey),
      ])
    : [[], null, null];

  // ── Stage 2c: Fetch comp images in parallel ──
  const compKeys = comps
    .map((c) => c.listingKey)
    .filter(Boolean);
  const compImages = compKeys.length > 0 ? await tryGetCompImages(compKeys) : new Map<string, string>();

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
      // Attach images to comps and subject
      const enrichedResult = enrichResultWithImages(aiResult, comps, compImages, subjectImageUrl);
      return {
        result: enrichedResult,
        modelUsed: "kevv-home-value-ai-v1",
        provider: `bbo-cma(${comps.length},${neighborhood ? "neighborhood" : "no-neighborhood"})`,
        summary: enrichedResult.marketSummary,
        dataConfidence: "high",
        dataSource: locale === "zh" ? "基于 MLS 真实成交数据" : "Based on MLS comparable sales data",
      };
    }
  }

  // If we have a listing but no comps, still better than pure heuristic
  if (listing) {
    const result = buildHeuristicEstimate({ listing, locale, city, seed });
    result.subjectImageUrl = subjectImageUrl ?? undefined;
    return {
      result,
      modelUsed: "kevv-home-value-v1",
      provider: "bbo-listing+heuristic",
      summary: result.marketSummary,
      dataConfidence: "medium",
      dataSource: locale === "zh" ? "基于 MLS 挂牌数据 + 区域市场估算" : "Based on MLS listing data + market estimates",
    };
  }

  // ── Fallback: heuristic estimate ────────────────────────────
  const result = buildHeuristicEstimate({ listing: null, locale, city, seed });

  return {
    result,
    modelUsed: "kevv-home-value-v1",
    provider: "heuristic",
    summary: result.marketSummary,
    dataConfidence: "low",
    dataSource: locale === "zh"
      ? "基于区域市场估算 — 建议联系经纪人获取精确 CMA"
      : "Preliminary area estimate — contact agent for a detailed CMA",
  };
}
