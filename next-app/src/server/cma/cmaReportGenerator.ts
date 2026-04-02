/**
 * CMA Report Generator — Presentation layer for CMA reports.
 *
 * Takes the CMAReportResult from the pipeline and formats it for:
 *   - Frontend preview display
 *   - Future PDF generation (stub for now)
 *   - Share-ready data packages
 *
 * PDF generation is a placeholder — will be replaced with a proper
 * PDF engine (Puppeteer, react-pdf, etc.) in a future iteration.
 */

import type { CMAReportResult, AgentBranding } from "./cmaAnalyzer";

// ─── Types ─────────────────────────────────────────────────────

export interface CMAPresentation {
  coverPage: {
    title: string;
    subtitle: string;
    address: string;
    agentName: string;
    agentCompany: string;
    agentPhone: string;
    agentEmail: string;
    logoUrl?: string;
    date: string;
  };
  subject: CMAReportResult["subject"];
  comparables: CMAReportResult["comparables"];
  marketIntelligence: CMAReportResult["marketIntelligence"];
  neighborhood: CMAReportResult["neighborhood"];
  priceRecommendation: CMAReportResult["priceRecommendation"];
  executiveSummary: CMAReportResult["executiveSummary"];
  dataSources: string[];
}

// ─── Build Presentation ───────────────────────────────────────

/**
 * Build a presentation-ready structure from the pipeline result.
 */
export function buildCMAPresentation(
  result: CMAReportResult,
  branding: AgentBranding,
): CMAPresentation {
  return {
    coverPage: {
      title: "Comparative Market Analysis",
      subtitle: result.subject.address,
      address: `${result.subject.address}, ${result.subject.city}, ${result.subject.state} ${result.subject.zipCode}`,
      agentName: branding.name,
      agentCompany: branding.company ?? "",
      agentPhone: branding.phone,
      agentEmail: branding.email,
      logoUrl: branding.logoUrl,
      date: new Date().toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
    },
    subject: result.subject,
    comparables: result.comparables,
    marketIntelligence: result.marketIntelligence,
    neighborhood: result.neighborhood,
    priceRecommendation: result.priceRecommendation,
    executiveSummary: result.executiveSummary,
    dataSources: result.dataSources,
  };
}

// ─── PDF Generation (Stub) ────────────────────────────────────

/**
 * Generate a PDF for the CMA report.
 *
 * TODO: Replace with a proper PDF engine:
 *   - Option A: html2canvas + jsPDF (client-side)
 *   - Option B: Puppeteer (server-side, highest quality)
 *   - Option C: @react-pdf/renderer (React native)
 *
 * For now, returns a placeholder URL.
 */
export async function generateCMAPdf(
  _presentation: CMAPresentation,
): Promise<string | null> {
  // Stub — PDF generation to be implemented in a future iteration
  console.info("[cmaReportGenerator] PDF generation is a stub. Will be implemented later.");
  return null;
}
