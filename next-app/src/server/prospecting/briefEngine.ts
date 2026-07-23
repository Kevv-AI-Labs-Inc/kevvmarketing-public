/**
 * Prospect Brief Engine — Data gathering → LLM call → Parse response.
 *
 * Generates AI-powered pitch packages for expired/FSBO listings.
 * Data pipeline: listing lookup → LLM generation → structured parse.
 */

import { randomUUID } from "crypto";
import { listingDataClient } from "../clients/listingDataClient";
import type { ListingData, ListingResponse } from "../clients/types";
import { invokeLLM } from "../_core/llm";

// ─── Types ────────────────────────────────────────────────

export type BriefTone = "professional" | "friendly" | "direct" | "empathetic";
export type BriefLanguage = "en" | "zh";

export interface GenerateBriefInput {
  listingId?: string;
  address?: string;
  tone?: BriefTone;
  language?: BriefLanguage;
}

export interface PitchAngle {
  id: string;
  name: string;
  confidence: number;
  script: string;
}

export interface OutreachScripts {
  call: string;
  sms: string;
  email: string;
  postcard: string;
}

export interface ObjectionHandler {
  objection: string;
  rebuttal: string;
}

export interface BriefResult {
  listingId: string | null;
  address: string | null;
  listingData: Record<string, unknown>;
  diagnosis: Record<string, unknown>;
  pitchAngles: PitchAngle[];
  outreachScripts: OutreachScripts;
  objectionHandlers: ObjectionHandler[];
  llmPrompt: string;
  llmResponse: string;
}

export interface ListingCandidate {
  listingKey: string;
  listingId: string;
  address: string;
  city: string;
  state: string;
  price: string;
  status: string;
}

// ─── Data Gathering ───────────────────────────────────────

/**
 * Resolve a listing by MLS ID or address.
 * Returns null if not found. Returns array if address is ambiguous.
 */
export async function resolveListing(
  input: GenerateBriefInput
): Promise<
  | { type: "found"; listing: ListingResponse }
  | { type: "ambiguous"; candidates: ListingCandidate[] }
  | { type: "not_found" }
> {
  // Try MLS ID first
  if (input.listingId) {
    try {
      const listing = await listingDataClient.getListingByMls(input.listingId);
      if (listing?.data) return { type: "found", listing };
    } catch {
      // Fall through to address search
    }
  }

  // Search by address
  if (input.address) {
    try {
      const results = await listingDataClient.searchListings({
        search: input.address,
        perPage: 10,
      });

      if (results.data.length === 1) {
        const match = results.data[0];
        const full = await listingDataClient.getListing(match.listingKey);
        return { type: "found", listing: full };
      }

      if (results.data.length > 1) {
        return {
          type: "ambiguous",
          candidates: results.data.map((d) => ({
            listingKey: d.listingKey,
            listingId: d.listingId,
            address: d.unparsedAddress,
            city: d.city,
            state: d.stateOrProvince,
            price: d.listPrice,
            status: d.standardStatus,
          })),
        };
      }
    } catch {
      // Fall through
    }
  }

  return { type: "not_found" };
}

// ─── LLM Prompt ───────────────────────────────────────────

function buildPrompt(
  listing: ListingData,
  tone: BriefTone,
  language: BriefLanguage
): string {
  const listPrice = listing.listPrice ?? "unknown";
  const originalPrice = listing.originalListPrice ?? listPrice;
  const dom = listing.daysOnMarket ?? "unknown";
  const beds = listing.bedroomsTotal ?? "unknown";
  const baths = listing.bathroomsTotalInteger ?? "unknown";
  const sqft = listing.livingArea ?? "unknown";
  const yearBuilt = listing.yearBuilt ?? "unknown";
  const status = listing.standardStatus ?? "unknown";
  const remarks = listing.publicRemarks ?? "none";
  const agent = listing.listAgentFullName ?? "unknown";
  const office = listing.listOfficeName ?? "unknown";
  const propertyType = listing.propertyType ?? "unknown";

  const toneInstructions = {
    professional:
      "Use a professional, consultative tone. Emphasize market expertise and data-driven insights.",
    friendly:
      "Use a warm, approachable tone. Be personable and empathetic while still being informative.",
    direct:
      "Be concise and to-the-point. Lead with the key insight and actionable recommendation.",
    empathetic:
      "Lead with understanding of the seller's frustration. Acknowledge the difficulty before pivoting to solutions.",
  };

  const langInstruction =
    language === "zh"
      ? "Write ALL output in Simplified Chinese (中文). Use natural Chinese phrasing, not translations."
      : "Write ALL output in English.";

  return `You are an expert real estate prospecting analyst. Generate a Prospect Brief for an agent who wants to contact the owner of this listing.

## Listing Data
- Address: ${listing.unparsedAddress}, ${listing.city}, ${listing.stateOrProvince} ${listing.postalCode}
- Status: ${status}
- List Price: $${listPrice} | Original Price: $${originalPrice}
- Days on Market: ${dom}
- Property: ${propertyType}, ${beds}bd/${baths}ba, ${sqft} sqft, built ${yearBuilt}
- Listing Agent: ${agent} (${office})
- Remarks: ${remarks}

## Instructions
${langInstruction}
Tone: ${toneInstructions[tone]}

Generate the following sections as valid JSON (and nothing else):

{
  "diagnosis": {
    "summary": "One-sentence diagnosis of why this listing failed or is struggling",
    "reasons": ["reason 1", "reason 2", "reason 3"],
    "evidence": ["specific evidence bullet 1", "evidence bullet 2", "evidence bullet 3"]
  },
  "pitchAngles": [
    {
      "name": "Angle name (e.g., Pricing Strategy, Marketing Upgrade, Fresh Start)",
      "confidence": 85,
      "script": "30-second call opener script for this angle"
    }
  ],
  "outreachScripts": {
    "call": "Full 60-second phone script with opener, value proposition, and soft close",
    "sms": "SMS message under 160 characters",
    "email": "Email with subject line and body (use --- to separate subject from body)",
    "postcard": "Postcard message under 200 words"
  },
  "objectionHandlers": [
    {
      "objection": "Common objection the seller might raise",
      "rebuttal": "Effective rebuttal that addresses the concern"
    }
  ]
}

Requirements:
- Provide exactly 3 pitch angles ranked by confidence (0-100)
- Provide exactly 3 objection handlers
- Base diagnosis on the actual listing data, not generic advice
- Scripts must reference specific details from this listing (price, DOM, neighborhood)
- Do not claim access to comparable sales that were not provided`;
}

// ─── Parse LLM Response ───────────────────────────────────

function parseBriefResponse(raw: string): {
  diagnosis: Record<string, unknown>;
  pitchAngles: PitchAngle[];
  outreachScripts: OutreachScripts;
  objectionHandlers: ObjectionHandler[];
} {
  // Extract JSON from response (handle markdown code blocks)
  let jsonStr = raw.trim();
  const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    jsonStr = codeBlockMatch[1].trim();
  }

  const parsed = JSON.parse(jsonStr);

  // Assign stable IDs to pitch angles
  const pitchAngles: PitchAngle[] = (parsed.pitchAngles ?? []).map(
    (angle: Omit<PitchAngle, "id">) => ({
      id: randomUUID(),
      name: angle.name,
      confidence: angle.confidence,
      script: angle.script,
    })
  );

  return {
    diagnosis: parsed.diagnosis ?? { summary: "Unable to diagnose", reasons: [], evidence: [] },
    pitchAngles,
    outreachScripts: parsed.outreachScripts ?? { call: "", sms: "", email: "", postcard: "" },
    objectionHandlers: parsed.objectionHandlers ?? [],
  };
}

// ─── Main Entry Point ─────────────────────────────────────

/**
 * Generate a Prospect Brief for a listing.
 * Pipeline: resolve listing → LLM → parse → return.
 */
export async function generateBrief(
  input: GenerateBriefInput
): Promise<BriefResult> {
  const tone = input.tone ?? "professional";
  const language = input.language ?? "en";

  // Step 1: Resolve listing
  const resolution = await resolveListing(input);

  if (resolution.type === "not_found") {
    throw new Error("Listing not found. Please check the MLS ID or address.");
  }

  if (resolution.type === "ambiguous") {
    // Caller should handle this by showing disambiguation UI
    const err = new Error("AMBIGUOUS_ADDRESS") as Error & {
      candidates: ListingCandidate[];
    };
    err.candidates = resolution.candidates;
    throw err;
  }

  const { listing } = resolution;
  const listingData = listing.data;

  // Step 2: Build prompt and call LLM
  const prompt = buildPrompt(listingData, tone, language);

  const llmResult = await invokeLLM({
    task: "prospecting",
    messages: [
      { role: "system", content: "You are a real estate prospecting AI. Always respond with valid JSON." },
      { role: "user", content: prompt },
    ],
    responseFormat: { type: "json_object" },
  });

  const rawResponse =
    typeof llmResult.choices[0]?.message?.content === "string"
      ? llmResult.choices[0].message.content
      : "";

  // Step 3: Parse response
  const parsed = parseBriefResponse(rawResponse);

  return {
    listingId: listingData.listingId ?? null,
    address: listingData.unparsedAddress
      ? `${listingData.unparsedAddress}, ${listingData.city}, ${listingData.stateOrProvince} ${listingData.postalCode}`
      : null,
    listingData: {
      listPrice: listingData.listPrice,
      originalListPrice: listingData.originalListPrice,
      daysOnMarket: listingData.daysOnMarket,
      standardStatus: listingData.standardStatus,
      propertyType: listingData.propertyType,
      bedroomsTotal: listingData.bedroomsTotal,
      bathroomsTotalInteger: listingData.bathroomsTotalInteger,
      livingArea: listingData.livingArea,
      yearBuilt: listingData.yearBuilt,
      listAgentFullName: listingData.listAgentFullName,
      listOfficeName: listingData.listOfficeName,
      compsCount: 0,
      compsAvailable: false,
    },
    diagnosis: parsed.diagnosis,
    pitchAngles: parsed.pitchAngles,
    outreachScripts: parsed.outreachScripts,
    objectionHandlers: parsed.objectionHandlers,
    llmPrompt: prompt,
    llmResponse: rawResponse,
  };
}
