/**
 * CMA Pipeline Engine — 5-Stage Comparative Market Analysis.
 *
 * Flow:
 *   Stage 1 — Subject Resolution    (BBO getListing / resolveByAddress / RentCast)
 *   Stage 2a — Photo Analysis        (Azure GPT Vision)       ┐
 *   Stage 2b — Vector Comp Match     (BBO getCmaByListing)    ├── parallel
 *   Stage 2c — RentCast AVM + Comps  (RentCast /v1/avm/value) │
 *   Stage 3  — Tavily Web Search     (3 parallel queries)     │
 *   Stage 4  — Neighborhood Context  (BBO getNeighborhoodSummary) ┘
 *   Stage 5 — Final LLM Synthesis    (Azure GPT → structured JSON)
 *
 * Each stage degrades gracefully so the pipeline never crashes —
 * it just produces a report with fewer data sources.
 *
 * Adjustment methodology:
 *   - GLA (sqft): 1/3 of median price-per-sqft × sqft difference
 *   - Bedroom: market-calibrated from comp pool median price per bedroom
 *   - Age: 0.3% of comp price per year difference
 *   - Condition: from photo analysis (-$30k to +$50k)
 *
 * Cost per call: ~$0.06 (no photos) to ~$0.15 (with 6 photos)
 * Latency p50:  ~4.5-5.5s (all stages enabled)
 */

import { invokeLLM } from "../_core/llm";
import {
  getListing,
  getCmaByListing,
  getNeighborhoodSummary,
  searchListings,
} from "../clients/listingDataClient";
import type {
  ListingData,
  CmaComparable,
  NeighborhoodSummary,
} from "../clients/types";
import { ListingDataServiceError } from "../clients/types";
import {
  isRentCastConfigured,
  getPropertyValuation,
  getPropertyDetails,
} from "../clients/rentCastClient";
import type { RentCastAvmResponse, RentCastComparable } from "../clients/rentCastClient";
import { RentCastError } from "../clients/rentCastClient";
import { ENV } from "../_core/env";
import { searchMarketIntelligence } from "./tavilyClient";
import type { MarketIntelligence } from "./tavilyClient";
import { analyzePropertyPhotos } from "./photoAnalyzer";
import type { PhotoAnalysisResult } from "./photoAnalyzer";

// ─── Types ─────────────────────────────────────────────────────

export interface ManualPropertyInput {
  address: string;
  city: string;
  state: string;
  zipCode: string;
  beds?: number;
  baths?: number;
  sqft?: number;
  yearBuilt?: number;
  propertyType?: string;
  highlights?: string;
}

export interface AgentBranding {
  name: string;
  email: string;
  phone: string;
  logoUrl?: string;
  company?: string;
}

export interface CMAPipelineInput {
  listingKey?: string;
  manualInput?: ManualPropertyInput;
  photoUrls?: string[];
  compLimit?: number;
  enableWebSearch?: boolean;
  enablePhotoAnalysis?: boolean;
  enableRentCast?: boolean;
  locale?: "en" | "zh";
  branding: AgentBranding;
}

export interface CompAdjustmentBreakdown {
  bedroomAdj: number;
  sqftAdj: number;
  ageAdj: number;
  conditionAdj: number;
  total: number;
}

export interface CMAComparableEntry {
  address: string;
  city?: string;
  soldPrice: string;
  soldDate?: string;
  beds?: number;
  baths?: number;
  sqft?: string;
  yearBuilt?: number;
  similarityScore?: number;
  adjustedPrice: string;
  adjustmentBreakdown: CompAdjustmentBreakdown;
  status?: string;
  source?: string;
}

export interface RentCastValuation {
  estimatedPrice: number | null;
  priceLow: number | null;
  priceHigh: number | null;
  pricePerSqft: number | null;
}

export interface CMAReportResult {
  subject: {
    address: string;
    city: string;
    state: string;
    zipCode: string;
    listPrice?: string;
    beds?: number;
    baths?: number;
    sqft?: string;
    yearBuilt?: number;
    propertyType?: string;
    photoAnalysis?: PhotoAnalysisResult;
    imageUrls?: string[];
  };
  comparables: CMAComparableEntry[];
  marketIntelligence: MarketIntelligence;
  neighborhood?: {
    schoolRating?: number;
    walkScore?: number;
    crimeIndex?: number;
    medianHomePrice?: string;
    profileText?: string;
  };
  rentCastValuation?: RentCastValuation;
  priceRecommendation: {
    low: string;
    high: string;
    midpoint: string;
    confidence: "high" | "medium" | "low";
    methodology: string;
  };
  executiveSummary: {
    english: string;
    chinese: string;
  };
  dataSources: string[];
  generatedAt: string;
  totalLatencyMs: number;
}

// ─── Stage 1: Subject Resolution ──────────────────────────────

async function resolveSubject(
  input: CMAPipelineInput,
): Promise<{
  listing: ListingData | null;
  listingKey: string | null;
  rentCastProperty: { beds?: number; baths?: number; sqft?: number; yearBuilt?: number; propertyType?: string } | null;
}> {
  // If a listingKey is provided, fetch from BBO
  if (input.listingKey) {
    try {
      const response = await getListing(input.listingKey);
      return { listing: response.data, listingKey: input.listingKey, rentCastProperty: null };
    } catch (err) {
      if (
        err instanceof ListingDataServiceError &&
        err.statusCode === 404
      ) {
        return { listing: null, listingKey: input.listingKey, rentCastProperty: null };
      }
      console.warn("[cmaPipeline] getListing failed:", err);
      return { listing: null, listingKey: input.listingKey, rentCastProperty: null };
    }
  }

  // If manual input and RentCast is configured, try to auto-fill property details
  if (input.manualInput && isRentCastConfigured()) {
    try {
      const fullAddress = [
        input.manualInput.address,
        input.manualInput.city,
        `${input.manualInput.state} ${input.manualInput.zipCode}`,
      ].filter(Boolean).join(", ");
      const rcProp = await getPropertyDetails(fullAddress);
      if (rcProp) {
        return {
          listing: null,
          listingKey: null,
          rentCastProperty: {
            beds: rcProp.bedrooms ?? undefined,
            baths: rcProp.bathrooms ?? undefined,
            sqft: rcProp.squareFootage ?? undefined,
            yearBuilt: rcProp.yearBuilt ?? undefined,
            propertyType: rcProp.propertyType ?? undefined,
          },
        };
      }
    } catch (err) {
      console.warn("[cmaPipeline] RentCast property lookup failed:", err);
    }
  }

  return { listing: null, listingKey: null, rentCastProperty: null };
}

// ─── Stage 2b: Vector Comp Match ──────────────────────────────

async function fetchVectorComps(
  listingKey: string | null,
  limit: number,
): Promise<{ comps: CmaComparable[]; source: "vector" | "sql_fallback" }> {
  if (!listingKey) return { comps: [], source: "sql_fallback" };

  try {
    const res = await getCmaByListing(listingKey, limit);
    return {
      comps: res.data.comparables ?? [],
      source: res.data.source,
    };
  } catch (err) {
    console.warn("[cmaPipeline] getCmaByListing failed:", err);
    return { comps: [], source: "sql_fallback" };
  }
}

// ─── Stage 2c: RentCast AVM + Comps ──────────────────────────

async function fetchRentCastData(
  address: string,
  compLimit: number,
): Promise<{ avm: RentCastAvmResponse | null; comps: CmaComparable[] }> {
  if (!isRentCastConfigured() || !address) {
    return { avm: null, comps: [] };
  }

  try {
    const avm = await getPropertyValuation(address, compLimit);
    const comps: CmaComparable[] = (avm.comparables ?? []).map(
      (rc: RentCastComparable, idx: number) => ({
        listingKey: rc.id ?? `rentcast-${idx}`,
        listingId: null,
        address: rc.formattedAddress ?? rc.addressLine1 ?? null,
        city: rc.city ?? null,
        postalCode: rc.zipCode ?? null,
        price: rc.lastSalePrice != null ? String(rc.lastSalePrice) : (rc.price != null ? String(rc.price) : null),
        propertyType: rc.propertyType ?? null,
        bedrooms: rc.bedrooms ?? null,
        bathrooms: rc.bathrooms ?? null,
        livingArea: rc.squareFootage != null ? String(rc.squareFootage) : null,
        yearBuilt: rc.yearBuilt ?? null,
        status: "Closed",
        score: rc.correlation ?? null,
        soldDate: rc.lastSaleDate ?? null,
        source: "rentcast" as const,
      }),
    );
    return { avm, comps };
  } catch (err) {
    if (err instanceof RentCastError) {
      console.warn("[cmaPipeline] RentCast AVM failed:", err.message);
    } else {
      console.warn("[cmaPipeline] RentCast AVM failed:", err);
    }
    return { avm: null, comps: [] };
  }
}

// ─── Stage 4: Neighborhood Context ──────────────────────────

async function fetchNeighborhood(
  zipCode: string | null | undefined,
): Promise<NeighborhoodSummary | null> {
  if (!zipCode) return null;
  try {
    return await getNeighborhoodSummary(zipCode);
  } catch {
    return null;
  }
}

// ─── Price Adjustments (Market-Calibrated) ───────────────────

interface AdjustmentContext {
  medianPricePerSqft: number;
  medianPricePerBedroom: number;
}

function buildAdjustmentContext(
  comps: CmaComparable[],
): AdjustmentContext {
  // Calculate median price per sqft from all comps
  const pricesPerSqft: number[] = [];
  const pricesPerBedroom: number[] = [];

  for (const comp of comps) {
    const price = parseInt(comp.price ?? "0", 10);
    if (price <= 0) continue;

    const sqft = parseInt(comp.livingArea ?? "0", 10);
    if (sqft > 0) pricesPerSqft.push(price / sqft);

    const beds = comp.bedrooms ?? 0;
    if (beds > 0) pricesPerBedroom.push(price / beds);
  }

  const median = (arr: number[]) => {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
      ? (sorted[mid - 1]! + sorted[mid]!) / 2
      : sorted[mid]!;
  };

  return {
    medianPricePerSqft: median(pricesPerSqft) || 200,
    medianPricePerBedroom: median(pricesPerBedroom) || 50000,
  };
}

function calculateCompAdjustments(
  subject: { beds?: number; sqft?: number; yearBuilt?: number; conditionScore?: number },
  comp: CmaComparable,
  ctx: AdjustmentContext,
): CompAdjustmentBreakdown {
  const subjectBeds = subject.beds;
  const compBeds = comp.bedrooms;
  const subjectSqft = subject.sqft;
  const compSqft = parseInt(comp.livingArea ?? "0", 10) || 0;
  const compPrice = parseInt(comp.price ?? "0", 10) || 0;

  // Bedroom adjustment: market-calibrated from comp pool
  // Only apply when both subject and comp have bedroom data
  let bedroomAdj = 0;
  if (subjectBeds != null && compBeds != null && subjectBeds !== compBeds) {
    bedroomAdj = Math.round((subjectBeds - compBeds) * ctx.medianPricePerBedroom * 0.3);
  }

  // GLA (sqft) adjustment: 1/3 of median price-per-sqft × difference
  // Industry standard: adjusting at 1/3 rate prevents over-adjustment
  let sqftAdj = 0;
  if (subjectSqft != null && subjectSqft > 0 && compSqft > 0) {
    sqftAdj = Math.round((subjectSqft - compSqft) * ctx.medianPricePerSqft / 3);
  }

  // Age adjustment: 0.3% of comp price per year difference
  // Only apply when both subject and comp have yearBuilt data
  let ageAdj = 0;
  const subjectYear = subject.yearBuilt;
  const compYear = comp.yearBuilt;
  if (subjectYear != null && compYear != null && subjectYear !== compYear) {
    ageAdj = Math.round((subjectYear - compYear) * compPrice * 0.003);
  }

  // Condition adjustment: from photo analysis (-$30k to +$50k)
  const conditionScore = subject.conditionScore ?? 5;
  const conditionAdj = Math.round((conditionScore - 5) * 10000);

  const total = bedroomAdj + sqftAdj + ageAdj + conditionAdj;

  return {
    bedroomAdj,
    sqftAdj,
    ageAdj,
    conditionAdj,
    total: Math.round(total),
  };
}

// ─── Comp Deduplication & Merging ─────────────────────────────

function deduplicateComps(
  bboComps: CmaComparable[],
  rentCastComps: CmaComparable[],
): CmaComparable[] {
  const seen = new Map<string, CmaComparable>();

  // BBO comps take priority (they have vector similarity scores)
  for (const comp of bboComps) {
    const key = normalizeAddress(comp.address ?? "");
    if (key && !seen.has(key)) {
      seen.set(key, { ...comp, source: comp.source ?? "bbo_vector" });
    }
  }

  // RentCast comps fill in the gaps
  for (const comp of rentCastComps) {
    const key = normalizeAddress(comp.address ?? "");
    if (key && !seen.has(key)) {
      seen.set(key, comp);
    } else if (key && seen.has(key)) {
      // Merge yearBuilt/soldDate from RentCast if BBO comp lacks them
      const existing = seen.get(key)!;
      if (!existing.yearBuilt && comp.yearBuilt) {
        existing.yearBuilt = comp.yearBuilt;
      }
      if (!existing.soldDate && comp.soldDate) {
        existing.soldDate = comp.soldDate;
      }
    }
  }

  return Array.from(seen.values());
}

function normalizeAddress(addr: string): string {
  return addr
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

// ─── Stage 5: Final LLM Synthesis ─────────────────────────────

function buildSynthesisPrompt(params: {
  subject: CMAReportResult["subject"];
  comps: CMAComparableEntry[];
  marketIntel: MarketIntelligence;
  neighborhood: NeighborhoodSummary | null;
  photoAnalysis: PhotoAnalysisResult | null;
  rentCastAvm: RentCastAvmResponse | null;
  locale: "en" | "zh";
}): string {
  const { subject, comps, marketIntel, neighborhood, photoAnalysis, rentCastAvm } = params;

  const subjectBlock = `SUBJECT PROPERTY:
  Address   : ${subject.address}
  City/State: ${subject.city}, ${subject.state} ${subject.zipCode}
  List Price: ${subject.listPrice ?? "unknown"}
  Beds/Baths: ${subject.beds ?? "?"} bd / ${subject.baths ?? "?"} ba
  Sqft      : ${subject.sqft ?? "unknown"}
  Year Built: ${subject.yearBuilt ?? "unknown"}
  Type      : ${subject.propertyType ?? "residential"}`;

  const compsBlock = comps.length > 0
    ? comps.map((c, i) => {
        const score = c.similarityScore != null
          ? ` (similarity ${c.similarityScore.toFixed(3)})`
          : "";
        const src = c.source ? ` [${c.source}]` : "";
        return `Comp ${i + 1}${score}${src}:
  Address      : ${c.address}
  Sold Price   : ${c.soldPrice}
  Sold Date    : ${c.soldDate ?? "unknown"}
  Beds/Baths   : ${c.beds ?? "?"} bd / ${c.baths ?? "?"} ba
  Sqft         : ${c.sqft ?? "unknown"}
  Year Built   : ${c.yearBuilt ?? "unknown"}
  Status       : ${c.status ?? "Closed"}
  Adjusted Price: ${c.adjustedPrice} (adj: ${c.adjustmentBreakdown.total >= 0 ? "+" : ""}$${c.adjustmentBreakdown.total.toLocaleString()})
    Bedroom adj: ${c.adjustmentBreakdown.bedroomAdj >= 0 ? "+" : ""}$${c.adjustmentBreakdown.bedroomAdj.toLocaleString()}
    Sqft adj   : ${c.adjustmentBreakdown.sqftAdj >= 0 ? "+" : ""}$${c.adjustmentBreakdown.sqftAdj.toLocaleString()}
    Age adj    : ${c.adjustmentBreakdown.ageAdj >= 0 ? "+" : ""}$${c.adjustmentBreakdown.ageAdj.toLocaleString()}
    Condition  : ${c.adjustmentBreakdown.conditionAdj >= 0 ? "+" : ""}$${c.adjustmentBreakdown.conditionAdj.toLocaleString()}`;
      }).join("\n\n")
    : "No comparable sales data available.";

  const rentCastBlock = rentCastAvm
    ? `RENTCAST AVM (independent valuation):
  Estimated Price    : $${rentCastAvm.price?.toLocaleString() ?? "N/A"}
  Price Range Low    : $${rentCastAvm.priceRangeLow?.toLocaleString() ?? "N/A"}
  Price Range High   : $${rentCastAvm.priceRangeHigh?.toLocaleString() ?? "N/A"}
  Price Per Sqft     : $${rentCastAvm.pricePerSquareFoot?.toLocaleString() ?? "N/A"}`
    : "RENTCAST AVM: Not available";

  const marketBlock = `MARKET INTELLIGENCE (from web search):
  Market Type     : ${marketIntel.marketType}
  Median Price    : ${marketIntel.medianPrice ?? "N/A"}
  Price Change YoY: ${marketIntel.priceChangeYoY ?? "N/A"}
  Avg DOM         : ${marketIntel.avgDaysOnMarket ?? "N/A"}
  Trends          : ${marketIntel.recentTrends.slice(0, 500)}`;

  const neighborhoodBlock = neighborhood
    ? `NEIGHBORHOOD DATA (ZIP ${neighborhood.zipCode}):
  School Rating   : ${neighborhood.schoolRating ?? "N/A"}/10
  Walk Score      : ${neighborhood.walkScore ?? "N/A"}/100
  Crime Index     : ${neighborhood.crimeIndex ?? "N/A"} (lower = safer)
  Median Price    : ${neighborhood.medianHomePrice ?? "N/A"}
  Profile         : ${neighborhood.profileText?.slice(0, 200) ?? "N/A"}`
    : "NEIGHBORHOOD DATA: Not available";

  const photoBlock = photoAnalysis
    ? `INTERIOR PHOTO ANALYSIS:
  Condition Score : ${photoAnalysis.conditionScore}/10
  Upgrade Level   : ${photoAnalysis.upgradeLevel}
  Features        : ${photoAnalysis.detectedFeatures.join(", ") || "none detected"}
  Value Impact    : ${photoAnalysis.valueImpact}
  Assessment      : ${photoAnalysis.narrative.english}`
    : "INTERIOR PHOTOS: Not provided";

  // Calculate average adjusted price for guidance
  const adjustedPrices = comps
    .map((c) => parseInt(c.adjustedPrice.replace(/[$,]/g, ""), 10))
    .filter((n) => Number.isFinite(n) && n > 0);
  const avgAdjusted = adjustedPrices.length > 0
    ? Math.round(adjustedPrices.reduce((a, b) => a + b, 0) / adjustedPrices.length)
    : null;
  const guidanceBlock = avgAdjusted
    ? `\nAVERAGE ADJUSTED COMP PRICE: $${avgAdjusted.toLocaleString()}`
    : "";

  return `You are a licensed real estate appraiser creating a CMA (Comparative Market Analysis) report.
Analyze ALL provided data sources and produce a comprehensive CMA recommendation.
Weight the data sources as follows:
1. Comparable closed sales (adjusted) — primary basis
2. RentCast AVM — independent valuation anchor for calibration
3. Market intelligence — trend context
4. Photo analysis — condition premium/discount
5. Neighborhood data — location context

${subjectBlock}

COMPARABLE SALES (${comps.length} comps from multiple sources):
${compsBlock}
${guidanceBlock}

${rentCastBlock}

${marketBlock}

${neighborhoodBlock}

${photoBlock}

Return ONLY valid JSON — no markdown fences, no extra text:
{
  "priceRecommendation": {
    "low": "<string, e.g. '$1,150,000'>",
    "high": "<string, e.g. '$1,280,000'>",
    "midpoint": "<string, e.g. '$1,215,000'>",
    "confidence": "<'high' | 'medium' | 'low'>",
    "methodology": "<1-2 sentence explanation of how price was derived>"
  },
  "executiveSummary": {
    "english": "<3-5 sentence professional CMA summary in English>",
    "chinese": "<3-5 sentence professional CMA summary in Simplified Chinese>"
  }
}`;
}

async function synthesizeReport(params: {
  subject: CMAReportResult["subject"];
  comps: CMAComparableEntry[];
  marketIntel: MarketIntelligence;
  neighborhood: NeighborhoodSummary | null;
  photoAnalysis: PhotoAnalysisResult | null;
  rentCastAvm: RentCastAvmResponse | null;
  locale: "en" | "zh";
}): Promise<{
  priceRecommendation: CMAReportResult["priceRecommendation"];
  executiveSummary: CMAReportResult["executiveSummary"];
}> {
  const prompt = buildSynthesisPrompt(params);

  try {
    const response = await invokeLLM({
      task: "cma-report",
      messages: [
        {
          role: "system",
          content:
            "You are a senior licensed real estate appraiser. " +
            "Produce a CMA pricing recommendation and executive summary. " +
            "Return only valid JSON matching the requested schema.",
        },
        { role: "user", content: prompt },
      ],
      responseFormat: { type: "json_object" },
    });

    const raw =
      typeof response.choices[0].message.content === "string"
        ? response.choices[0].message.content
        : JSON.stringify(response.choices[0].message.content);

    const parsed = JSON.parse(raw);

    return {
      priceRecommendation: {
        low: parsed.priceRecommendation?.low ?? "N/A",
        high: parsed.priceRecommendation?.high ?? "N/A",
        midpoint: parsed.priceRecommendation?.midpoint ?? "N/A",
        confidence: parsed.priceRecommendation?.confidence ?? "low",
        methodology:
          parsed.priceRecommendation?.methodology ??
          "Insufficient data for reliable estimate.",
      },
      executiveSummary: {
        english:
          parsed.executiveSummary?.english ??
          "CMA report generated with limited data.",
        chinese:
          parsed.executiveSummary?.chinese ??
          "CMA 报告基于有限数据生成。",
      },
    };
  } catch (err) {
    console.error("[cmaPipeline] LLM synthesis failed:", err);

    // Build heuristic fallback from comps
    const adjustedPrices = params.comps
      .map((c) => parseInt(c.adjustedPrice.replace(/[$,]/g, ""), 10))
      .filter((n) => Number.isFinite(n) && n > 0);

    // Also consider RentCast AVM as a fallback anchor
    if (params.rentCastAvm?.price) {
      adjustedPrices.push(params.rentCastAvm.price);
    }

    if (adjustedPrices.length > 0) {
      const avg = Math.round(
        adjustedPrices.reduce((a, b) => a + b, 0) / adjustedPrices.length,
      );
      const low = Math.round(avg * 0.95);
      const high = Math.round(avg * 1.05);
      return {
        priceRecommendation: {
          low: `$${low.toLocaleString()}`,
          high: `$${high.toLocaleString()}`,
          midpoint: `$${avg.toLocaleString()}`,
          confidence: "low",
          methodology:
            "Heuristic estimate from adjusted comparable prices (AI synthesis unavailable).",
        },
        executiveSummary: {
          english: `Based on ${params.comps.length} comparable sales, the estimated value range is $${low.toLocaleString()} to $${high.toLocaleString()}.`,
          chinese: `基于 ${params.comps.length} 套可比房源，估值区间为 $${low.toLocaleString()} 至 $${high.toLocaleString()}。`,
        },
      };
    }

    return {
      priceRecommendation: {
        low: "N/A",
        high: "N/A",
        midpoint: "N/A",
        confidence: "low",
        methodology: "Insufficient data.",
      },
      executiveSummary: {
        english: "CMA generation failed — insufficient data and AI unavailable.",
        chinese: "CMA 生成失败 — 数据不足且 AI 不可用。",
      },
    };
  }
}

// ─── Main Pipeline ────────────────────────────────────────────

/**
 * Run the complete 5-stage CMA pipeline.
 *
 * Each stage degrades gracefully — the pipeline always returns a result,
 * just with fewer data sources if some stages fail.
 */
export async function runCMAPipeline(
  input: CMAPipelineInput,
): Promise<CMAReportResult> {
  const startTime = Date.now();
  const locale = input.locale ?? "en";
  const dataSources: string[] = [];

  // ── Stage 1: Subject Resolution (~300ms) ──────────────────
  const { listing, listingKey, rentCastProperty } = await resolveSubject(input);
  if (listing) dataSources.push("bbo_listing");
  if (rentCastProperty) dataSources.push("rentcast_property");

  // Build subject info from listing or manual input, enriched by RentCast
  const manual = input.manualInput;
  const subject: CMAReportResult["subject"] = {
    address: listing?.unparsedAddress ?? manual?.address ?? "Unknown",
    city: listing?.city ?? manual?.city ?? "Unknown",
    state: listing?.stateOrProvince ?? manual?.state ?? "",
    zipCode: listing?.postalCode ?? manual?.zipCode ?? "",
    listPrice: listing?.listPrice,
    beds: listing?.bedroomsTotal ?? manual?.beds ?? rentCastProperty?.beds,
    baths: listing?.bathroomsTotalInteger ?? manual?.baths ?? rentCastProperty?.baths,
    sqft: listing?.livingArea ?? (manual?.sqft ? String(manual.sqft) : undefined) ?? (rentCastProperty?.sqft ? String(rentCastProperty.sqft) : undefined),
    yearBuilt: listing?.yearBuilt ?? manual?.yearBuilt ?? rentCastProperty?.yearBuilt,
    propertyType: listing?.propertyType ?? manual?.propertyType ?? rentCastProperty?.propertyType,
  };

  // Build full address string for RentCast
  const fullAddress = [subject.address, subject.city, `${subject.state} ${subject.zipCode}`]
    .filter(Boolean)
    .join(", ");

  // ── Stages 2a + 2b + 2c + 3 + 4: Parallel (~1.5-2s) ─────
  const compLimit = input.compLimit ?? 8;
  const photoUrls = input.photoUrls ?? [];
  const enablePhotos = input.enablePhotoAnalysis !== false && photoUrls.length > 0;
  const enableWeb = input.enableWebSearch !== false;
  const enableRentCast = input.enableRentCast !== false;
  const enableBboNeighborhood = !!subject.zipCode;

  const [
    photoResult,
    compResult,
    rentCastResult,
    webResult,
    neighborhoodResult,
  ] = await Promise.allSettled([
    // Stage 2a: Photo analysis
    enablePhotos
      ? analyzePropertyPhotos({
          photoUrls,
          propertyContext: `${subject.address}, ${subject.city} — ${subject.beds ?? "?"}bd/${subject.baths ?? "?"}ba, ${subject.sqft ?? "?"}sqft`,
          locale,
        })
      : Promise.resolve(null),

    // Stage 2b: BBO vector comp match
    fetchVectorComps(listingKey, compLimit),

    // Stage 2c: RentCast AVM + comps
    enableRentCast
      ? fetchRentCastData(fullAddress, compLimit)
      : Promise.resolve({ avm: null, comps: [] }),

    // Stage 3: Tavily web search
    enableWeb
      ? searchMarketIntelligence({
          address: subject.address,
          city: subject.city,
          state: subject.state,
          zipCode: subject.zipCode,
          propertyType: subject.propertyType,
        })
      : Promise.resolve<MarketIntelligence>({
          marketType: "balanced",
          recentTrends: "Web search disabled.",
          citations: [],
        }),

    // Stage 4: BBO neighborhood
    enableBboNeighborhood
      ? fetchNeighborhood(subject.zipCode)
      : Promise.resolve(null),
  ]);

  // Unwrap results
  const photoAnalysis: PhotoAnalysisResult | null =
    photoResult.status === "fulfilled" ? photoResult.value : null;
  if (photoAnalysis && photoAnalysis.conditionScore !== 5) {
    dataSources.push("photo_analysis");
    subject.photoAnalysis = photoAnalysis;
    subject.imageUrls = photoUrls;
  }

  const rawBboComps: CmaComparable[] =
    compResult.status === "fulfilled" ? compResult.value.comps : [];
  if (rawBboComps.length > 0) dataSources.push("bbo_vector");

  const rentCastData = rentCastResult.status === "fulfilled"
    ? rentCastResult.value
    : { avm: null, comps: [] };
  if (rentCastData.avm) dataSources.push("rentcast_avm");
  if (rentCastData.comps.length > 0) dataSources.push("rentcast_comps");

  const marketIntel: MarketIntelligence =
    webResult.status === "fulfilled"
      ? webResult.value
      : { marketType: "balanced", recentTrends: "Web search failed.", citations: [] };
  if (marketIntel.citations.length > 0) dataSources.push("tavily_web_search");

  const neighborhood: NeighborhoodSummary | null =
    neighborhoodResult.status === "fulfilled"
      ? neighborhoodResult.value
      : null;
  if (neighborhood) dataSources.push("bbo_neighborhood");

  // ── Merge & Deduplicate Comps ────────────────────────────
  const allComps = deduplicateComps(rawBboComps, rentCastData.comps);

  // ── Build Comparables with market-calibrated adjustments ──
  const conditionScore = photoAnalysis?.conditionScore;
  const subjectSpecs = {
    beds: subject.beds,
    sqft: subject.sqft ? parseInt(subject.sqft, 10) : undefined,
    yearBuilt: subject.yearBuilt,
    conditionScore,
  };

  // Build adjustment context from the full comp pool
  const adjContext = buildAdjustmentContext(allComps);

  const comparables: CMAComparableEntry[] = allComps.map((comp) => {
    const adjustments = calculateCompAdjustments(subjectSpecs, comp, adjContext);
    const compPrice = parseInt(comp.price ?? "0", 10) || 0;
    const adjustedPrice = Math.max(0, compPrice + adjustments.total);

    return {
      address: comp.address ?? "Unknown",
      city: comp.city ?? undefined,
      soldPrice: comp.price ? `$${parseInt(comp.price, 10).toLocaleString()}` : "N/A",
      soldDate: comp.soldDate ?? undefined,
      beds: comp.bedrooms ?? undefined,
      baths: comp.bathrooms ?? undefined,
      sqft: comp.livingArea ?? undefined,
      yearBuilt: comp.yearBuilt ?? undefined,
      similarityScore: comp.score ?? undefined,
      adjustedPrice: `$${adjustedPrice.toLocaleString()}`,
      adjustmentBreakdown: adjustments,
      status: comp.status ?? undefined,
      source: comp.source ?? undefined,
    };
  });

  // ── Build RentCast valuation summary ─────────────────────
  const rentCastValuation: RentCastValuation | undefined = rentCastData.avm
    ? {
        estimatedPrice: rentCastData.avm.price ?? null,
        priceLow: rentCastData.avm.priceRangeLow ?? null,
        priceHigh: rentCastData.avm.priceRangeHigh ?? null,
        pricePerSqft: rentCastData.avm.pricePerSquareFoot ?? null,
      }
    : undefined;

  // ── Stage 5: Final LLM Synthesis (~2s) ────────────────────
  const { priceRecommendation, executiveSummary } = await synthesizeReport({
    subject,
    comps: comparables,
    marketIntel,
    neighborhood,
    photoAnalysis,
    rentCastAvm: rentCastData.avm,
    locale,
  });

  // ── Assemble final result ─────────────────────────────────
  const totalLatencyMs = Date.now() - startTime;

  return {
    subject,
    comparables,
    marketIntelligence: marketIntel,
    neighborhood: neighborhood
      ? {
          schoolRating: neighborhood.schoolRating ?? undefined,
          walkScore: neighborhood.walkScore ?? undefined,
          crimeIndex: neighborhood.crimeIndex ?? undefined,
          medianHomePrice: neighborhood.medianHomePrice ?? undefined,
          profileText: neighborhood.profileText ?? undefined,
        }
      : undefined,
    rentCastValuation,
    priceRecommendation,
    executiveSummary,
    dataSources,
    generatedAt: new Date().toISOString(),
    totalLatencyMs,
  };
}
