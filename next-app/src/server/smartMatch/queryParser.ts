/**
 * Smart Match Query Parser — LLM-powered natural language → structured filters.
 *
 * Takes a free-text query like:
 *   "Irvine 好学区 150万以内 4房 带院子 现代装修"
 *   "3 bed homes near good schools in Arcadia under 1.2M with garage"
 *
 * Returns structured filters for the database + residual text for semantic re-rank.
 *
 * Architecture: LLM extraction → structured filters (DB query) → residual (embedding re-rank)
 * This follows the Redfin/Zillow pattern: NL → structured + semantic hybrid.
 */

import { invokeLLM } from "../_core/llm";

// ─── Types ────────────────────────────────────────────────────

export interface ParsedSearchQuery {
  /** Extracted structured filters — map directly to DB/API filters */
  filters: {
    city?: string;
    postalCode?: string;
    stateOrProvince?: string;
    propertyType?: string;
    minPrice?: number;
    maxPrice?: number;
    minBedrooms?: number;
    maxBedrooms?: number;
    minBathrooms?: number;
    minSqft?: number;
    maxSqft?: number;
  };
  /** Specific property features extracted (pool, garage, yard, fireplace, etc.) */
  features: string[];
  /** Lifestyle/subjective terms (good schools, walkable, quiet, safe, etc.) */
  lifestyle: string[];
  /** Anything that couldn't be structurally mapped — used for semantic re-rank */
  residualText: string;
  /** The original query, preserved for embedding generation */
  originalQuery: string;
  /** Detected language */
  locale: "en" | "zh";
}

// ─── LLM Extraction ──────────────────────────────────────────

const EXTRACTION_SYSTEM_PROMPT = `You are a real estate search query parser. Extract structured filters from a natural language property search query.

IMPORTANT RULES:
- Extract ONLY what is explicitly stated or clearly implied. Do NOT invent or assume values.
- Price: Convert shorthand like "1.2M" → 1200000, "150万" → 1500000, "80万" → 800000, "under 1M" → maxPrice:1000000
- City: Extract the city name. Common California cities: Irvine, Arcadia, San Marino, Pasadena, etc.
- Bedrooms: "4房" = minBedrooms:4, "3-4 bed" = minBedrooms:3, maxBedrooms:4
- Property type: Map to one of: Residential, Condo, Townhouse, Land, Multi-Family
- Features: Physical property features like pool, garage, yard, fireplace, balcony, basement, modern kitchen, hardwood floors, open floor plan, wine cellar
- Lifestyle: Subjective/location qualities like good schools, walkable, safe neighborhood, quiet, near parks, near transit, family-friendly, close to shopping
- Residual: Anything that doesn't map to above categories. Keep it brief.
- Locale: "zh" if the query contains Chinese characters, "en" otherwise.

Return ONLY valid JSON matching this schema — no markdown fences:
{
  "filters": {
    "city": "string or null",
    "postalCode": "string or null",
    "stateOrProvince": "string or null",
    "propertyType": "string or null",
    "minPrice": "number or null",
    "maxPrice": "number or null",
    "minBedrooms": "number or null",
    "maxBedrooms": "number or null",
    "minBathrooms": "number or null",
    "minSqft": "number or null",
    "maxSqft": "number or null"
  },
  "features": ["array of feature strings"],
  "lifestyle": ["array of lifestyle strings"],
  "residualText": "remaining unstructured text",
  "locale": "en or zh"
}`;

/**
 * Parse a natural language property search query into structured components.
 *
 * Cost: ~$0.002 per call (gpt-4o-mini)
 * Latency: ~300-500ms
 */
export async function parseSearchQuery(query: string): Promise<ParsedSearchQuery> {
  const trimmed = query.trim();
  if (!trimmed) {
    return {
      filters: {},
      features: [],
      lifestyle: [],
      residualText: "",
      originalQuery: "",
      locale: "en",
    };
  }

  try {
    const response = await invokeLLM({
      task: "smart-match",
      messages: [
        { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
        { role: "user", content: trimmed },
      ],
      responseFormat: { type: "json_object" },
      maxTokens: 500,
    });

    const raw =
      typeof response.choices[0].message.content === "string"
        ? response.choices[0].message.content
        : JSON.stringify(response.choices[0].message.content);

    const parsed = JSON.parse(raw);
    const filters = parsed.filters ?? {};

    return {
      filters: {
        city: typeof filters.city === "string" ? filters.city : undefined,
        postalCode: typeof filters.postalCode === "string" ? filters.postalCode : undefined,
        stateOrProvince: typeof filters.stateOrProvince === "string" ? filters.stateOrProvince : undefined,
        propertyType: typeof filters.propertyType === "string" ? filters.propertyType : undefined,
        minPrice: typeof filters.minPrice === "number" ? filters.minPrice : undefined,
        maxPrice: typeof filters.maxPrice === "number" ? filters.maxPrice : undefined,
        minBedrooms: typeof filters.minBedrooms === "number" ? filters.minBedrooms : undefined,
        maxBedrooms: typeof filters.maxBedrooms === "number" ? filters.maxBedrooms : undefined,
        minBathrooms: typeof filters.minBathrooms === "number" ? filters.minBathrooms : undefined,
        minSqft: typeof filters.minSqft === "number" ? filters.minSqft : undefined,
        maxSqft: typeof filters.maxSqft === "number" ? filters.maxSqft : undefined,
      },
      features: Array.isArray(parsed.features) ? parsed.features.filter((f: unknown) => typeof f === "string") : [],
      lifestyle: Array.isArray(parsed.lifestyle) ? parsed.lifestyle.filter((l: unknown) => typeof l === "string") : [],
      residualText: typeof parsed.residualText === "string" ? parsed.residualText : "",
      originalQuery: trimmed,
      locale: parsed.locale === "zh" ? "zh" : "en",
    };
  } catch (err) {
    console.warn("[queryParser] LLM extraction failed, falling back to passthrough:", err);
    // Fallback: treat entire query as residual text for semantic search
    const hasChinese = /[\u4e00-\u9fff]/.test(trimmed);
    return {
      filters: {},
      features: [],
      lifestyle: [],
      residualText: trimmed,
      originalQuery: trimmed,
      locale: hasChinese ? "zh" : "en",
    };
  }
}

/**
 * Build a semantic search text from the non-structural parts of a parsed query.
 * This is embedded and used for re-ranking the structurally-retrieved candidates.
 */
export function buildSemanticText(parsed: ParsedSearchQuery): string {
  const parts: string[] = [];

  if (parsed.features.length > 0) {
    parts.push(`Features: ${parsed.features.join(", ")}`);
  }
  if (parsed.lifestyle.length > 0) {
    parts.push(`Lifestyle: ${parsed.lifestyle.join(", ")}`);
  }
  if (parsed.residualText) {
    parts.push(parsed.residualText);
  }

  // If there's nothing semantic, use the original query
  return parts.length > 0 ? parts.join(". ") : parsed.originalQuery;
}
