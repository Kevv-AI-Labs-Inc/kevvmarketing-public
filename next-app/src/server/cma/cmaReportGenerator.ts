/**
 * CMA Report Generator — creates branded CMA presentations.
 *
 * For now generates structured JSON/data that can be rendered
 * into a PDF by the frontend or a PDF library.
 * TODO: Integrate with jsPDF or Puppeteer for server-side PDF generation.
 */

import type { CMAResult } from "./cmaAnalyzer";

// ─── Types ─────────────────────────────────────────────────

export interface AgentBranding {
  name: string;
  email: string;
  phone: string;
  logoUrl?: string;
  company?: string;
  colors?: { primary: string; secondary: string };
}

export interface CMAReportData {
  coverPage: {
    title: string;
    subtitle: string;
    agentBranding: AgentBranding;
    address: string;
    generatedDate: string;
  };
  targetSummary: {
    address: string;
    price: string;
    beds: number | null;
    baths: number | null;
    sqft: string;
    yearBuilt: number | undefined;
    photo?: string;
  };
  compsTable: Array<{
    address: string;
    soldPrice: string;
    soldDate: string | undefined;
    beds: number | null;
    baths: number | null;
    sqft: string;
    adjustedPrice: string;
    adjustment: string;
  }>;
  priceRecommendation: {
    low: string;
    high: string;
    midpoint: string;
  };
  aiAnalysis: string;
  marketTrends: Record<string, unknown>;
}

// ─── Report Builder ────────────────────────────────────────

/**
 * Build a structured CMA report from analysis results.
 */
export function buildCMAReport(
  cma: CMAResult,
  branding: AgentBranding,
): CMAReportData {
  const target = cma.target;

  return {
    coverPage: {
      title: "Comparative Market Analysis\n房产市场对比分析报告",
      subtitle: target.unparsedAddress ?? "Property Analysis",
      agentBranding: branding,
      address: `${target.unparsedAddress}, ${target.city}, ${target.stateOrProvince} ${target.postalCode}`,
      generatedDate: new Date().toISOString().split("T")[0],
    },

    targetSummary: {
      address: target.unparsedAddress,
      price: `$${parseInt(target.listPrice).toLocaleString()}`,
      beds: target.bedroomsTotal,
      baths: target.bathroomsTotalInteger,
      sqft: target.livingArea,
      yearBuilt: target.yearBuilt,
    },

    compsTable: cma.comps.map((comp) => ({
      address: comp.listing.unparsedAddress,
      soldPrice: `$${parseInt(comp.listing.closePrice ?? comp.listing.listPrice).toLocaleString()}`,
      soldDate: comp.listing.closeDate,
      beds: comp.listing.bedroomsTotal,
      baths: comp.listing.bathroomsTotalInteger,
      sqft: comp.listing.livingArea,
      adjustedPrice: `$${comp.adjustments.adjustedPrice.toLocaleString()}`,
      adjustment: `${comp.adjustments.total >= 0 ? "+" : ""}$${comp.adjustments.total.toLocaleString()}`,
    })),

    priceRecommendation: {
      low: `$${parseInt(cma.suggestedPriceLow).toLocaleString()}`,
      high: `$${parseInt(cma.suggestedPriceHigh).toLocaleString()}`,
      midpoint: `$${Math.round(
        (parseInt(cma.suggestedPriceLow) + parseInt(cma.suggestedPriceHigh)) / 2,
      ).toLocaleString()}`,
    },

    aiAnalysis: cma.aiAnalysis,
    marketTrends: cma.marketTrends,
  };
}

/**
 * Generate PDF from CMA report.
 * TODO: Implement with jsPDF or Puppeteer.
 * Currently returns a placeholder URL.
 */
export async function generateCMAPdf(
  report: CMAReportData,
): Promise<string> {
  console.log(`[cmaReportGenerator] Stub: generateCMAPdf for ${report.coverPage.address}`);
  // TODO: Implement PDF generation
  return `https://example.com/cma/${Date.now()}.pdf`;
}
