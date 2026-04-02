/**
 * Tavily Search Client — AI-optimized web search for CMA market intelligence.
 *
 * Tavily is purpose-built for AI agent workflows. It returns concise,
 * cite-ready snippets instead of raw HTML — ideal for feeding into LLM synthesis.
 *
 * Env vars:
 *   TAVILY_API_KEY   — required (get one at https://tavily.com)
 *   SEARCH_PROVIDER  — "tavily" (default) | "brave" | "none"
 *
 * Pricing: $0.008/credit, 1000 free/month
 * Docs:    https://docs.tavily.com/docs/rest-api
 *
 * Called by: cmaAnalyzer.ts Stage 3
 */

import { ENV } from "../_core/env";

// ─── Types ─────────────────────────────────────────────────────

export interface TavilySearchParams {
  query: string;
  search_depth?: "basic" | "advanced";
  include_domains?: string[];
  exclude_domains?: string[];
  max_results?: number;
  include_answer?: boolean;
  include_raw_content?: boolean;
}

export interface TavilyResult {
  title: string;
  url: string;
  content: string;
  score: number;
}

export interface TavilyResponse {
  answer?: string;
  results: TavilyResult[];
  query: string;
}

export interface MarketIntelligence {
  medianPrice?: string;
  priceChangeYoY?: string;
  avgDaysOnMarket?: number;
  inventoryLevel?: string;
  marketType: "seller" | "buyer" | "balanced";
  recentTrends: string;
  citations: Array<{ title: string; url: string }>;
}

// ─── Tavily REST API ───────────────────────────────────────────

const TAVILY_API_URL = "https://api.tavily.com/search";

/**
 * Execute a single Tavily search query.
 */
export async function tavilySearch(
  params: TavilySearchParams,
): Promise<TavilyResponse> {
  const apiKey = ENV.tavilyApiKey;
  if (!apiKey) {
    throw new Error(
      "TAVILY_API_KEY is not configured. Get a key at https://tavily.com",
    );
  }

  const body = {
    api_key: apiKey,
    query: params.query,
    search_depth: params.search_depth ?? "basic",
    include_domains: params.include_domains,
    exclude_domains: params.exclude_domains,
    max_results: params.max_results ?? 5,
    include_answer: params.include_answer ?? true,
    include_raw_content: params.include_raw_content ?? false,
  };

  const response = await fetch(TAVILY_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Tavily search failed: ${response.status} — ${text}`);
  }

  return (await response.json()) as TavilyResponse;
}

// ─── CMA Market Intelligence ──────────────────────────────────

/**
 * Run 3 parallel Tavily queries to build a comprehensive market snapshot.
 *
 * Query 1: Market trends  (Zillow, Redfin, Realtor.com)
 * Query 2: Neighborhood   (GreatSchools, WalkScore, Niche)
 * Query 3: Price & inventory (Zillow, Redfin, NAR)
 *
 * Results are aggregated into a MarketIntelligence object for LLM synthesis.
 */
export async function searchMarketIntelligence(params: {
  address: string;
  city: string;
  state: string;
  zipCode: string;
  propertyType?: string;
}): Promise<MarketIntelligence> {
  // Guard: if Tavily is not configured, return a minimal fallback
  if (!ENV.tavilyApiKey || ENV.searchProvider === "none") {
    return {
      marketType: "balanced",
      recentTrends: "Web search not configured — using BBO data only.",
      citations: [],
    };
  }

  const year = new Date().getFullYear();
  const propType = params.propertyType ?? "residential";

  // 3 parallel queries
  const [trendsRes, neighborhoodRes, priceRes] = await Promise.allSettled([
    // Query 1: Market trends
    tavilySearch({
      query: `${params.city} ${params.state} real estate market trends ${year}`,
      search_depth: "basic",
      include_domains: ["zillow.com", "redfin.com", "realtor.com"],
      max_results: 3,
      include_answer: true,
    }),
    // Query 2: Neighborhood quality
    tavilySearch({
      query: `${params.address} ${params.city} neighborhood school rating walkability`,
      search_depth: "basic",
      include_domains: [
        "greatschools.org",
        "walkscore.com",
        "niche.com",
        "areavibes.com",
      ],
      max_results: 3,
      include_answer: true,
    }),
    // Query 3: Price & inventory
    tavilySearch({
      query: `${params.city} ${params.state} ${propType} median home price days on market inventory ${year}`,
      search_depth: "basic",
      include_domains: ["zillow.com", "redfin.com", "nar.realtor"],
      max_results: 3,
      include_answer: true,
    }),
  ]);

  // Collect all citations
  const citations: Array<{ title: string; url: string }> = [];
  const answers: string[] = [];

  for (const result of [trendsRes, neighborhoodRes, priceRes]) {
    if (result.status === "fulfilled") {
      const res = result.value;
      if (res.answer) answers.push(res.answer);
      for (const r of res.results) {
        citations.push({ title: r.title, url: r.url });
      }
    }
  }

  // Extract structured data from Tavily answers
  const combinedAnswer = answers.join("\n\n");

  // Parse numeric signals from the combined text (best-effort extraction)
  const medianPrice = extractDollarAmount(combinedAnswer, "median");
  const priceChangeYoY = extractPercentage(combinedAnswer, "year-over-year|yoy|change");
  const daysOnMarket = extractNumber(combinedAnswer, "days on market|dom");
  const marketType = inferMarketType(combinedAnswer);

  return {
    medianPrice,
    priceChangeYoY,
    avgDaysOnMarket: daysOnMarket ?? undefined,
    marketType,
    recentTrends: combinedAnswer || "Market data unavailable.",
    citations: citations.slice(0, 10), // cap at 10 citations
  };
}

// ─── Text Extraction Helpers ──────────────────────────────────

function extractDollarAmount(
  text: string,
  context: string,
): string | undefined {
  const pattern = new RegExp(
    `${context}[^$]*\\$([\\d,]+(?:\\.\\d+)?(?:\\s*(?:k|K|m|M))?)`,
    "i",
  );
  const match = text.match(pattern);
  if (!match) return undefined;
  let raw = match[1].replace(/,/g, "");
  if (/[kK]$/.test(raw)) raw = String(parseFloat(raw) * 1000);
  if (/[mM]$/.test(raw)) raw = String(parseFloat(raw) * 1_000_000);
  const num = parseFloat(raw);
  return Number.isFinite(num)
    ? `$${Math.round(num).toLocaleString()}`
    : undefined;
}

function extractPercentage(
  text: string,
  context: string,
): string | undefined {
  const pattern = new RegExp(
    `(?:${context})[^%]*?([+-]?\\d+\\.?\\d*)\\s*%`,
    "i",
  );
  const match = text.match(pattern);
  return match ? `${match[1]}%` : undefined;
}

function extractNumber(
  text: string,
  context: string,
): number | null {
  const pattern = new RegExp(`(\\d+)\\s*(?:${context})`, "i");
  const match = text.match(pattern);
  if (match) {
    const n = parseInt(match[1], 10);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function inferMarketType(
  text: string,
): "seller" | "buyer" | "balanced" {
  const lower = text.toLowerCase();
  const sellerSignals = [
    "seller's market",
    "sellers market",
    "low inventory",
    "competitive",
    "bidding war",
    "multiple offers",
  ];
  const buyerSignals = [
    "buyer's market",
    "buyers market",
    "high inventory",
    "price reduction",
    "price cuts",
    "sitting on market",
  ];

  const sellerScore = sellerSignals.filter((s) => lower.includes(s)).length;
  const buyerScore = buyerSignals.filter((s) => lower.includes(s)).length;

  if (sellerScore > buyerScore) return "seller";
  if (buyerScore > sellerScore) return "buyer";
  return "balanced";
}
