/**
 * CMA Analyzer — Comparative Market Analysis logic.
 *
 * Flow: target listing → find comps → adjust values → AI narrative → suggested price range
 */

import { listingDataClient } from "../clients/listingDataClient";
import type { ListingData } from "../clients/types";
import { invokeLLM } from "../_core/llm";

// ─── Types ─────────────────────────────────────────────────

export interface CompAdjustment {
  listing: ListingData;
  adjustments: {
    bedroomDiff: number;
    bedroomAdjustment: number; // dollar value
    sqftDiff: number;
    sqftAdjustment: number;
    ageDiff: number;
    ageAdjustment: number;
    total: number;
    adjustedPrice: number;
  };
}

export interface CMAResult {
  target: ListingData;
  comps: CompAdjustment[];
  suggestedPriceLow: string;
  suggestedPriceHigh: string;
  aiAnalysis: string;
  marketTrends: Record<string, unknown>;
}

// ─── Comp Finding ──────────────────────────────────────────

/**
 * Find comparable properties for a target listing.
 * Searches nearby with similar specs (±1 bed, ±30% sqft, same city).
 */
export async function findComps(
  target: ListingData,
  maxComps: number = 5,
): Promise<ListingData[]> {
  const beds = target.bedroomsTotal ?? 3;
  const sqft = parseInt(target.livingArea ?? "2000", 10);

  try {
    const results = await listingDataClient.searchListings({
      city: target.city,
      stateOrProvince: target.stateOrProvince,
      minBedrooms: Math.max(1, beds - 1),
      maxBedrooms: beds + 1,
      status: "Closed",
      perPage: maxComps * 2,
    });

    // Filter by sqft similarity and take top N
    return results.data
      .filter((comp) => {
        const compSqft = parseInt(comp.livingArea ?? "0", 10);
        return compSqft >= sqft * 0.7 && compSqft <= sqft * 1.3;
      })
      .slice(0, maxComps);
  } catch (err) {
    console.error("[cmaAnalyzer] Failed to find comps:", err);
    return [];
  }
}

// ─── Price Adjustments ─────────────────────────────────────

/**
 * Calculate price adjustments for a comp relative to the target.
 * Standard CMA adjustment methodology.
 */
export function calculateAdjustments(
  target: ListingData,
  comp: ListingData,
): CompAdjustment["adjustments"] {
  const targetBeds = target.bedroomsTotal ?? 3;
  const compBeds = comp.bedroomsTotal ?? 3;
  const targetSqft = parseInt(target.livingArea ?? "2000", 10);
  const compSqft = parseInt(comp.livingArea ?? "2000", 10);
  const targetYear = target.yearBuilt ?? 2000;
  const compYear = comp.yearBuilt ?? 2000;
  const compPrice = parseInt(comp.closePrice ?? comp.listPrice ?? "0", 10);

  // Bedroom adjustment: ~$25,000 per bedroom difference
  const bedroomDiff = targetBeds - compBeds;
  const bedroomAdjustment = bedroomDiff * 25000;

  // Sqft adjustment: ~$200/sqft difference
  const sqftDiff = targetSqft - compSqft;
  const pricePerSqft = compSqft > 0 ? compPrice / compSqft : 200;
  const sqftAdjustment = sqftDiff * Math.min(pricePerSqft * 0.5, 300);

  // Age adjustment: ~$5,000 per year newer
  const ageDiff = compYear - targetYear; // positive = comp is newer
  const ageAdjustment = ageDiff * -5000; // adjust up if target is newer

  const total = bedroomAdjustment + sqftAdjustment + ageAdjustment;
  const adjustedPrice = compPrice + total;

  return {
    bedroomDiff, bedroomAdjustment,
    sqftDiff, sqftAdjustment: Math.round(sqftAdjustment),
    ageDiff, ageAdjustment,
    total: Math.round(total),
    adjustedPrice: Math.round(adjustedPrice),
  };
}

// ─── AI Analysis ───────────────────────────────────────────

/**
 * Generate AI market analysis narrative for the CMA report.
 */
export async function generateCMAAnalysis(
  target: ListingData,
  comps: CompAdjustment[],
): Promise<string> {
  const adjustedPrices = comps.map((c) => c.adjustments.adjustedPrice);
  const avgAdjusted = adjustedPrices.reduce((a, b) => a + b, 0) / adjustedPrices.length;

  const prompt = `You are a bilingual (English + Chinese) real estate market analyst.
Generate a CMA (Comparative Market Analysis) narrative for this property.

TARGET PROPERTY:
- Address: ${target.unparsedAddress}, ${target.city}, ${target.stateOrProvince}
- Beds/Baths: ${target.bedroomsTotal}/${target.bathroomsTotalInteger}
- SqFt: ${target.livingArea}
- Year Built: ${target.yearBuilt}
- List Price: $${target.listPrice}

COMPARABLE SALES (${comps.length} comps):
${comps.map((c, i) => `${i + 1}. ${c.listing.unparsedAddress} — Sold: $${c.listing.closePrice}, Adjusted: $${c.adjustments.adjustedPrice} (${c.adjustments.total > 0 ? "+" : ""}$${c.adjustments.total})`).join("\n")}

Average Adjusted Price: $${Math.round(avgAdjusted).toLocaleString()}

Write a professional analysis in BOTH English and Chinese (separated by ---).
Include: market conditions, comp analysis summary, suggested pricing strategy.
Keep each language version under 200 words.`;

  try {
    const result = await invokeLLM({
      task: "cma",
      messages: [{ role: "user", content: prompt }],
    });
    const content = result.choices?.[0]?.message?.content;
    return typeof content === "string"
      ? content
      : `Based on ${comps.length} comparable sales, the adjusted average price is $${Math.round(avgAdjusted).toLocaleString()}.\n\n根据 ${comps.length} 套可比房源，调整后平均价格为 $${Math.round(avgAdjusted).toLocaleString()}。`;
  } catch {
    return `Based on ${comps.length} comparable sales, the adjusted average price is $${Math.round(avgAdjusted).toLocaleString()}.\n\n根据 ${comps.length} 套可比房源，调整后平均价格为 $${Math.round(avgAdjusted).toLocaleString()}。`;
  }
}

// ─── Full CMA Pipeline ────────────────────────────────────

/**
 * Run the complete CMA analysis pipeline.
 */
export async function runCMAAnalysis(
  listingKey: string,
): Promise<CMAResult> {
  // 1. Fetch target listing
  const targetResponse = await listingDataClient.getListing(listingKey);
  const target = targetResponse.data;

  // 2. Find comps
  const rawComps = await findComps(target);

  // 3. Calculate adjustments
  const comps: CompAdjustment[] = rawComps.map((comp) => ({
    listing: comp,
    adjustments: calculateAdjustments(target, comp),
  }));

  // 4. Calculate suggested price range
  const adjustedPrices = comps.map((c) => c.adjustments.adjustedPrice);
  const avgPrice = adjustedPrices.length > 0
    ? adjustedPrices.reduce((a, b) => a + b, 0) / adjustedPrices.length
    : parseInt(target.listPrice, 10);

  const suggestedPriceLow = Math.round(avgPrice * 0.95).toString();
  const suggestedPriceHigh = Math.round(avgPrice * 1.05).toString();

  // 5. Generate AI analysis
  const aiAnalysis = comps.length > 0
    ? await generateCMAAnalysis(target, comps)
    : "Insufficient comparable data for AI analysis.\n可比数据不足，无法生成 AI 分析。";

  return {
    target,
    comps,
    suggestedPriceLow,
    suggestedPriceHigh,
    aiAnalysis,
    marketTrends: {
      note: "Market trends require additional data integration.",
    },
  };
}
