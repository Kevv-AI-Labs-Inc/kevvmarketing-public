/**
 * Photo Analyzer — Azure GPT Vision for interior condition assessment.
 *
 * Analyzes user-uploaded property photos to assess:
 *   - Overall condition (1-10 scale)
 *   - Upgrade level (original → fully renovated)
 *   - Key features detected (hardwood, granite, stainless, etc.)
 *   - Estimated value impact on CMA pricing
 *
 * Uses the existing invokeLLM() with ImageContent type,
 * which is already supported by both OpenAI and Azure providers.
 *
 * AI task: CMA_PHOTO
 * Called by: cmaAnalyzer.ts Stage 2a
 */

import { invokeLLM } from "../_core/llm";
import type { MessageContent } from "../_core/llm";

// ─── Types ─────────────────────────────────────────────────────

export interface PhotoAnalysisResult {
  conditionScore: number;
  upgradeLevel:
    | "original"
    | "partial_update"
    | "fully_renovated"
    | "new_construction";
  detectedFeatures: string[];
  roomTypes: string[];
  valueImpact:
    | "negative"
    | "neutral"
    | "positive"
    | "significant_positive";
  narrative: {
    english: string;
    chinese: string;
  };
}

// ─── Photo Analysis ───────────────────────────────────────────

/**
 * Analyze property photos using Azure GPT Vision.
 *
 * @param photoUrls    — 1-6 R2 public URLs of interior/exterior photos
 * @param propertyContext — brief description: address + basic specs
 * @param locale       — primary output language
 */
export async function analyzePropertyPhotos(params: {
  photoUrls: string[];
  propertyContext: string;
  locale: "en" | "zh";
}): Promise<PhotoAnalysisResult> {
  const { photoUrls, propertyContext, locale } = params;

  if (photoUrls.length === 0) {
    return defaultAnalysis();
  }

  // Build message content with text prompt + images
  const contentParts: MessageContent[] = [
    {
      type: "text",
      text: buildPhotoPrompt(propertyContext, locale, photoUrls.length),
    },
    ...photoUrls.slice(0, 6).map(
      (url): MessageContent => ({
        type: "image_url",
        image_url: { url, detail: "auto" },
      }),
    ),
  ];

  try {
    const response = await invokeLLM({
      task: "cma-photo",
      messages: [
        {
          role: "system",
          content:
            "You are an expert real estate appraiser specializing in property condition assessment. " +
            "Analyze the provided photos and return ONLY valid JSON matching the schema. " +
            "No markdown fences, no extra keys, no explanation outside the JSON.",
        },
        {
          role: "user",
          content: contentParts,
        },
      ],
      responseFormat: { type: "json_object" },
    });

    const raw =
      typeof response.choices[0].message.content === "string"
        ? response.choices[0].message.content
        : JSON.stringify(response.choices[0].message.content);

    const parsed = JSON.parse(raw) as Partial<PhotoAnalysisResult>;
    return normalizeResult(parsed);
  } catch (err) {
    console.error("[photoAnalyzer] Vision analysis failed:", err);
    return defaultAnalysis();
  }
}

// ─── Prompt ───────────────────────────────────────────────────

function buildPhotoPrompt(
  propertyContext: string,
  locale: "en" | "zh",
  photoCount: number,
): string {
  const isChinese = locale.startsWith("zh");
  const langNote =
    isChinese
      ? 'Write "narrative.english" in English and "narrative.chinese" in Simplified Chinese.'
      : 'Write "narrative.english" in English and "narrative.chinese" in Simplified Chinese.';

  return `Analyze the ${photoCount} property photo(s) below for a Comparative Market Analysis (CMA).

PROPERTY CONTEXT: ${propertyContext}

${langNote}

Return ONLY valid JSON:
{
  "conditionScore": <integer 1-10, where 1=poor/needs major work, 5=average, 10=pristine/model home>,
  "upgradeLevel": <"original" | "partial_update" | "fully_renovated" | "new_construction">,
  "detectedFeatures": [<array of feature strings, e.g. "hardwood_floors", "granite_counters", "stainless_appliances", "crown_molding", "open_floor_plan", "modern_lighting", "updated_bathrooms", "pool", "custom_cabinetry">],
  "roomTypes": [<array of room types visible, e.g. "kitchen", "living_room", "master_bedroom", "bathroom", "dining_room", "backyard", "garage", "exterior">],
  "valueImpact": <"negative" | "neutral" | "positive" | "significant_positive">,
  "narrative": {
    "english": "<2-3 sentence professional condition summary>",
    "chinese": "<2-3 sentence condition summary in Simplified Chinese>"
  }
}`;
}

// ─── Helpers ──────────────────────────────────────────────────

function normalizeResult(
  parsed: Partial<PhotoAnalysisResult>,
): PhotoAnalysisResult {
  return {
    conditionScore:
      typeof parsed.conditionScore === "number"
        ? Math.min(10, Math.max(1, Math.round(parsed.conditionScore)))
        : 5,
    upgradeLevel:
      parsed.upgradeLevel &&
      [
        "original",
        "partial_update",
        "fully_renovated",
        "new_construction",
      ].includes(parsed.upgradeLevel)
        ? parsed.upgradeLevel
        : "original",
    detectedFeatures: Array.isArray(parsed.detectedFeatures)
      ? parsed.detectedFeatures.filter(
          (f): f is string => typeof f === "string",
        )
      : [],
    roomTypes: Array.isArray(parsed.roomTypes)
      ? parsed.roomTypes.filter((r): r is string => typeof r === "string")
      : [],
    valueImpact:
      parsed.valueImpact &&
      ["negative", "neutral", "positive", "significant_positive"].includes(
        parsed.valueImpact,
      )
        ? parsed.valueImpact
        : "neutral",
    narrative: {
      english:
        typeof parsed.narrative?.english === "string"
          ? parsed.narrative.english
          : "Photo analysis unavailable.",
      chinese:
        typeof parsed.narrative?.chinese === "string"
          ? parsed.narrative.chinese
          : "照片分析不可用。",
    },
  };
}

function defaultAnalysis(): PhotoAnalysisResult {
  return {
    conditionScore: 5,
    upgradeLevel: "original",
    detectedFeatures: [],
    roomTypes: [],
    valueImpact: "neutral",
    narrative: {
      english: "No photos provided for condition assessment.",
      chinese: "未提供照片，无法进行状况评估。",
    },
  };
}
