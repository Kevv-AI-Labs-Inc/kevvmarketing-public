import { and, desc, eq, ilike, inArray, or } from "drizzle-orm";

import type { Db } from "@/lib/db";
import {
  buyerProfiles,
  clients,
  contacts,
  listingSubscriptions,
  showingFeedback,
  smartMatchResults,
  smartMatchRuns,
  type Contact,
} from "@/lib/db/schema";
import {
  generateEmbedding,
  generateMockEmbedding,
  getEmbeddingModelId,
} from "@/server/embeddingService";
import {
  getListingsBatch,
  searchListings,
  vectorSearch,
} from "@/server/clients/listingDataClient";
import type {
  ListingData,
  SearchFilters,
  VectorSearchResult,
} from "@/server/clients/types";
import { parseSearchQuery, buildSemanticText } from "./queryParser";

export type SmartMatchLocale = "zh" | "en";

export type SmartMatchWorkspaceInput = {
  agentId: number;
  query?: string;
  limit?: number;
};

export type SmartMatchGenerateInput = {
  agentId: number;
  contactId: number;
  locale?: SmartMatchLocale;
  searchBrief?: string;
  city?: string;
  postalCode?: string;
  propertyType?: string;
  minPrice?: number;
  maxPrice?: number;
  minBedrooms?: number;
  maxBedrooms?: number;
  topK?: number;
};

/**
 * Natural language search input — no contact required.
 * LLM parses the query into structured filters + semantic residual.
 */
export type SmartMatchNLSearchInput = {
  agentId: number;
  query: string;
  contactId?: number;
  topK?: number;
};

type LegacyClient = typeof clients.$inferSelect;
type ListingSubscription = typeof listingSubscriptions.$inferSelect;
type ShowingFeedback = typeof showingFeedback.$inferSelect;

type SmartMatchHardFilters = {
  city?: string | null;
  postalCode?: string | null;
  propertyType?: string | null;
  minPrice?: number | null;
  maxPrice?: number | null;
  minBedrooms?: number | null;
  maxBedrooms?: number | null;
  status: "Active";
};

type ScoreBreakdown = {
  semanticScore: number;
  ruleScore: number;
  behaviorScore: number;
  finalScore: number;
};

type MatchCandidate = {
  listing: ListingData;
  images: string[];
  semanticScore: number;
  ruleScore: number;
  behaviorScore: number;
  finalScore: number;
  matchReasons: string[];
};

function normalizeOptional(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

function parseCurrency(value?: string | null) {
  if (!value) return null;
  const parsed = Number.parseFloat(value.replace(/[^0-9.]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function parseArrayText(value?: string | null) {
  if (!value) return [] as string[];

  try {
    const parsed = JSON.parse(value) as unknown;
    if (Array.isArray(parsed)) {
      return parsed
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter(Boolean);
    }
  } catch {
    // Fall through to delimiter parsing.
  }

  return value
    .split(/[,\n|]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(values.filter((value): value is string => Boolean(value && value.trim().length > 0)))
  );
}

function tokenize(text: string) {
  return text
    .toLowerCase()
    .split(/[^a-z0-9\u4e00-\u9fff]+/g)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
}

function cosineSimilarity(a: number[], b: number[]) {
  const length = Math.min(a.length, b.length);
  if (length === 0) return 0;

  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < length; i += 1) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }

  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

function clampScore(value: number) {
  return Math.max(0, Math.min(1, value));
}

function formatBudgetSummary(minPrice?: number | null, maxPrice?: number | null) {
  if (minPrice && maxPrice) return `$${minPrice.toLocaleString()}-$${maxPrice.toLocaleString()}`;
  if (minPrice) return `>$${minPrice.toLocaleString()}`;
  if (maxPrice) return `<$${maxPrice.toLocaleString()}`;
  return null;
}

function featurePhrase(
  locale: SmartMatchLocale,
  key: "budget" | "city" | "postalCode" | "propertyType" | "bedrooms" | "feature" | "semantic" | "lifestyle",
  detail: string
) {
  const zh: Record<typeof key, string> = {
    budget: `价格带匹配：${detail}`,
    city: `区域匹配：${detail}`,
    postalCode: `邮编匹配：${detail}`,
    propertyType: `房型匹配：${detail}`,
    bedrooms: `卧室数量匹配：${detail}`,
    feature: `偏好特征命中：${detail}`,
    semantic: `整体画像相关度高：${detail}`,
    lifestyle: `生活方式匹配：${detail}`,
  };

  const en: Record<typeof key, string> = {
    budget: `Budget alignment: ${detail}`,
    city: `Location fit: ${detail}`,
    postalCode: `ZIP fit: ${detail}`,
    propertyType: `Property type fit: ${detail}`,
    bedrooms: `Bedroom fit: ${detail}`,
    feature: `Preference matched: ${detail}`,
    semantic: `Strong overall fit: ${detail}`,
    lifestyle: `Lifestyle match: ${detail}`,
  };

  const phrasesByLocale = { zh, en };
  return (phrasesByLocale[locale] ?? phrasesByLocale.zh)[key];
}

async function findLegacyClientForContact(db: Db, agentId: number, contact: Contact) {
  const email = normalizeOptional(contact.email);
  const phone = normalizeOptional(contact.phone);
  const externalId = normalizeOptional(contact.externalId);

  const predicates = [];
  if (externalId) predicates.push(eq(clients.externalId, externalId));
  if (email) predicates.push(eq(clients.email, email));
  if (phone) predicates.push(eq(clients.phone, phone));

  if (predicates.length === 0) return null;

  const rows = await db
    .select()
    .from(clients)
    .where(and(eq(clients.agentId, agentId), or(...predicates)))
    .limit(1);

  return rows[0] ?? null;
}

async function loadSubject(db: Db, input: SmartMatchGenerateInput) {
  const [contact] = await db
    .select()
    .from(contacts)
    .where(and(eq(contacts.id, input.contactId), eq(contacts.agentId, input.agentId)))
    .limit(1);

  if (!contact) {
    throw new Error("Contact not found");
  }

  const [existingProfile] = await db
    .select()
    .from(buyerProfiles)
    .where(eq(buyerProfiles.contactId, contact.id))
    .limit(1);

  const legacyClient = await findLegacyClientForContact(db, input.agentId, contact);

  const subscriptions = legacyClient
    ? await db
        .select()
        .from(listingSubscriptions)
        .where(
          and(
            eq(listingSubscriptions.agentId, input.agentId),
            eq(listingSubscriptions.clientId, legacyClient.id),
            eq(listingSubscriptions.status, "active")
          )
        )
        .limit(5)
    : [];

  const feedbackRows = legacyClient
    ? await db
        .select()
        .from(showingFeedback)
        .where(
          and(
            eq(showingFeedback.agentId, input.agentId),
            eq(showingFeedback.clientId, legacyClient.id)
          )
        )
        .orderBy(desc(showingFeedback.createdAt))
        .limit(12)
    : [];

  return {
    contact,
    existingProfile: existingProfile ?? null,
    legacyClient,
    subscriptions,
    feedbackRows,
  };
}

function buildHardFilters(args: {
  contact: Contact;
  legacyClient: LegacyClient | null;
  subscriptions: ListingSubscription[];
  input: SmartMatchGenerateInput;
}) {
  const subscription = args.subscriptions[0];
  const preferredCities = parseArrayText(args.legacyClient?.preferredCities);
  const preferredPropertyTypes = parseArrayText(args.legacyClient?.preferredPropertyTypes);

  const hardFilters: SmartMatchHardFilters = {
    city:
      normalizeOptional(args.input.city) ??
      normalizeOptional(args.contact.area) ??
      normalizeOptional(subscription?.cities?.[0]) ??
      normalizeOptional(preferredCities[0]),
    postalCode: normalizeOptional(args.input.postalCode),
    propertyType:
      normalizeOptional(args.input.propertyType) ??
      normalizeOptional(subscription?.propertyTypes?.[0]) ??
      normalizeOptional(preferredPropertyTypes[0]),
    minPrice:
      args.input.minPrice ??
      parseCurrency(args.contact.budgetMin) ??
      parseCurrency(subscription?.minPrice) ??
      parseCurrency(args.legacyClient?.budgetMin),
    maxPrice:
      args.input.maxPrice ??
      parseCurrency(args.contact.budgetMax) ??
      parseCurrency(subscription?.maxPrice) ??
      parseCurrency(args.legacyClient?.budgetMax),
    minBedrooms:
      args.input.minBedrooms ??
      subscription?.minBeds ??
      args.legacyClient?.preferredBedrooms ??
      null,
    maxBedrooms:
      args.input.maxBedrooms ??
      subscription?.maxBeds ??
      null,
    status: "Active",
  };

  return hardFilters;
}

function buildPreferenceSummary(args: {
  contact: Contact;
  legacyClient: LegacyClient | null;
  subscriptions: ListingSubscription[];
  feedbackRows: ShowingFeedback[];
  input: SmartMatchGenerateInput;
}) {
  const mustHaveFeatures = parseArrayText(args.legacyClient?.mustHaveFeatures);
  const dealBreakers = parseArrayText(args.legacyClient?.dealBreakers);
  const preferredCities = parseArrayText(args.legacyClient?.preferredCities);
  const preferredPropertyTypes = parseArrayText(args.legacyClient?.preferredPropertyTypes);
  const positiveFeedback = args.feedbackRows.flatMap((row) =>
    Array.isArray(row.liked) ? (row.liked as string[]) : []
  );
  const negativeFeedback = args.feedbackRows.flatMap((row) =>
    Array.isArray(row.disliked) ? (row.disliked as string[]) : []
  );
  const subscriptionKeywords = args.subscriptions
    .map((row) => normalizeOptional(row.keywords))
    .filter(Boolean) as string[];

  const softPreferences = uniqueStrings([
    ...mustHaveFeatures,
    ...positiveFeedback,
    ...subscriptionKeywords,
    ...preferredCities,
    ...preferredPropertyTypes,
  ]);

  const negativePreferences = uniqueStrings([
    ...dealBreakers,
    ...negativeFeedback,
  ]);

  const budgetSummary = formatBudgetSummary(
    args.input.minPrice ?? parseCurrency(args.contact.budgetMin) ?? parseCurrency(args.legacyClient?.budgetMin),
    args.input.maxPrice ?? parseCurrency(args.contact.budgetMax) ?? parseCurrency(args.legacyClient?.budgetMax)
  );

  const lines = [
    args.contact.name ? `Client: ${args.contact.name}` : null,
    args.contact.preferredLanguage ? `Language: ${args.contact.preferredLanguage}` : null,
    args.contact.intent ? `Intent: ${args.contact.intent}` : null,
    budgetSummary ? `Budget: ${budgetSummary}` : null,
    args.contact.area ? `Primary area: ${args.contact.area}` : null,
    args.contact.timeline ? `Timeline: ${args.contact.timeline}` : null,
    normalizeOptional(args.contact.summary) ? `Lead summary: ${args.contact.summary}` : null,
    normalizeOptional(args.contact.notes) ? `Notes: ${args.contact.notes}` : null,
    args.contact.tags?.length ? `Tags: ${args.contact.tags.join(", ")}` : null,
    normalizeOptional(args.legacyClient?.profileSummary) ? `Legacy profile: ${args.legacyClient?.profileSummary}` : null,
    normalizeOptional(args.legacyClient?.lifestyleNotes) ? `Lifestyle notes: ${args.legacyClient?.lifestyleNotes}` : null,
    softPreferences.length ? `Positive preferences: ${softPreferences.join(", ")}` : null,
    negativePreferences.length ? `Avoid: ${negativePreferences.join(", ")}` : null,
    args.input.searchBrief ? `Current home search brief: ${args.input.searchBrief}` : null,
  ];

  return {
    canonicalSummary: lines.filter(Boolean).join("\n"),
    softPreferences,
    negativePreferences,
  };
}

function toSearchFilters(hardFilters: SmartMatchHardFilters): SearchFilters {
  return {
    status: hardFilters.status,
    city: hardFilters.city ?? undefined,
    postalCode: hardFilters.postalCode ?? undefined,
    propertyType: hardFilters.propertyType ?? undefined,
    minPrice: hardFilters.minPrice ?? undefined,
    maxPrice: hardFilters.maxPrice ?? undefined,
    minBedrooms: hardFilters.minBedrooms ?? undefined,
    maxBedrooms: hardFilters.maxBedrooms ?? undefined,
  };
}

function buildListingText(listing: ListingData) {
  return [
    listing.unparsedAddress,
    listing.city,
    listing.stateOrProvince,
    listing.postalCode,
    listing.propertyType,
    listing.publicRemarks,
  ]
    .filter(Boolean)
    .join(" ");
}

// ─── Two-Phase Scoring ────────────────────────────────────────
//
// Phase 1 (Structural Retrieve): Use hard filters → DB/API query → candidate set
// Phase 2 (Semantic Re-rank): Score candidates using embedding similarity + feature matching + behavior
//
// New weight distribution:
//   Final = Semantic × 0.40 + Rule × 0.40 + Behavior × 0.20
//
// The key change: rule score is now a "quality of match" metric post-retrieval,
// not a survival filter. Structural filters already ensured price/location/beds match.

function scoreListing(args: {
  listing: ListingData;
  hardFilters: SmartMatchHardFilters;
  softPreferences: string[];
  negativePreferences: string[];
  features: string[];
  lifestyle: string[];
  queryText: string;
  locale: SmartMatchLocale;
  vectorSimilarity?: number | null;
}): MatchCandidate {
  const listingText = buildListingText(args.listing);
  const listingTokens = new Set(tokenize(listingText));
  const queryTokens = tokenize(args.queryText);

  // ── Semantic Score (40%) ─────────────────────────────────
  const mockQueryEmbedding = generateMockEmbedding(args.queryText);
  const mockListingEmbedding = generateMockEmbedding(listingText);
  const localSemantic = cosineSimilarity(mockQueryEmbedding, mockListingEmbedding);
  const semanticScore = clampScore(
    args.vectorSimilarity != null ? args.vectorSimilarity * 0.75 + localSemantic * 0.25 : localSemantic
  );

  // ── Rule Score (40%) — how well this listing matches hard filters ──
  let ruleScore = 0;
  const reasons: string[] = [];
  const listingPrice = parseCurrency(args.listing.listPrice);

  if (args.hardFilters.city && args.listing.city.toLowerCase() === args.hardFilters.city.toLowerCase()) {
    ruleScore += 0.22;
    reasons.push(featurePhrase(args.locale, "city", args.listing.city));
  }
  if (
    args.hardFilters.postalCode &&
    args.listing.postalCode?.toLowerCase() === args.hardFilters.postalCode.toLowerCase()
  ) {
    ruleScore += 0.14;
    reasons.push(featurePhrase(args.locale, "postalCode", args.listing.postalCode));
  }
  if (
    args.hardFilters.propertyType &&
    args.listing.propertyType?.toLowerCase() === args.hardFilters.propertyType.toLowerCase()
  ) {
    ruleScore += 0.14;
    reasons.push(featurePhrase(args.locale, "propertyType", args.listing.propertyType));
  }
  if (
    args.hardFilters.minBedrooms &&
    (args.listing.bedroomsTotal ?? 0) >= args.hardFilters.minBedrooms
  ) {
    ruleScore += 0.12;
    reasons.push(
      featurePhrase(args.locale, "bedrooms", `${args.listing.bedroomsTotal ?? 0} bd`)
    );
  }
  if (
    listingPrice &&
    (!args.hardFilters.minPrice || listingPrice >= args.hardFilters.minPrice) &&
    (!args.hardFilters.maxPrice || listingPrice <= args.hardFilters.maxPrice)
  ) {
    ruleScore += 0.18;
    reasons.push(
      featurePhrase(
        args.locale,
        "budget",
        `$${Math.round(listingPrice).toLocaleString()}`
      )
    );
  }

  // ── Behavior Score (20%) — soft preferences + features + lifestyle ──
  const allSoftPrefs = uniqueStrings([...args.softPreferences, ...args.features]);

  const matchedSoft = uniqueStrings(
    allSoftPrefs.filter((item) => {
      const tokens = tokenize(item);
      return tokens.some((token) => listingTokens.has(token));
    })
  ).slice(0, 3);

  const matchedLifestyle = uniqueStrings(
    args.lifestyle.filter((item) => {
      const tokens = tokenize(item);
      return tokens.some((token) => listingTokens.has(token));
    })
  ).slice(0, 2);

  const matchedNegative = uniqueStrings(
    args.negativePreferences.filter((item) => {
      const tokens = tokenize(item);
      return tokens.some((token) => listingTokens.has(token));
    })
  );

  const tokenOverlap =
    queryTokens.length === 0
      ? 0
      : queryTokens.filter((token) => listingTokens.has(token)).length /
        Math.max(queryTokens.length, 1);

  const behaviorScore = clampScore(
    Math.max(
      0,
      matchedSoft.length * 0.20 +
      matchedLifestyle.length * 0.15 +
      tokenOverlap * 0.30 -
      matchedNegative.length * 0.35
    )
  );

  if (matchedSoft.length > 0) {
    reasons.push(featurePhrase(args.locale, "feature", matchedSoft.join(", ")));
  }
  if (matchedLifestyle.length > 0) {
    reasons.push(featurePhrase(args.locale, "lifestyle", matchedLifestyle.join(", ")));
  }
  if (semanticScore >= 0.72) {
    const semanticDetailsByLocale = {
      zh: "整体需求表达高度接近",
      en: "overall needs line up closely",
    };
    reasons.push(
      featurePhrase(
        args.locale,
        "semantic",
        semanticDetailsByLocale[args.locale] ?? semanticDetailsByLocale.zh
      )
    );
  }

  // ── Final Composite ──────────────────────────────────────
  const finalScore = clampScore(
    semanticScore * 0.40 + clampScore(ruleScore) * 0.40 + behaviorScore * 0.20
  );

  return {
    listing: args.listing,
    images: [],
    semanticScore,
    ruleScore: clampScore(ruleScore),
    behaviorScore,
    finalScore,
    matchReasons: uniqueStrings(reasons).slice(0, 5),
  };
}

async function enrichImages(candidates: MatchCandidate[]) {
  const listingKeys = candidates.map((candidate) => candidate.listing.listingKey);
  if (listingKeys.length === 0) return candidates;

  try {
    const batch = await getListingsBatch(listingKeys);
    return candidates.map((candidate) => {
      const row = batch.get(candidate.listing.listingKey);
      return {
        ...candidate,
        images:
          row?.imageUrls?.slice(0, 5) ??
          row?.media?.slice(0, 5).map((item) => item.mediaURL) ??
          candidate.images,
      };
    });
  } catch {
    return candidates;
  }
}

// ─── Phase 1: Structural Retrieve ─────────────────────────────
//
// Retrieve candidates using HARD filters (price, city, beds, type).
// These are exact-match filters — users expect precise results.
// Returns a broad candidate set (3-6x topK) for Phase 2 re-ranking.

async function structuralRetrieve(args: {
  hardFilters: SmartMatchHardFilters;
  candidateMultiplier?: number;
  topK: number;
}): Promise<{ listings: ListingData[]; source: "search" }> {
  const filters = toSearchFilters(args.hardFilters);
  const fetchCount = Math.min(
    Math.max(args.topK * (args.candidateMultiplier ?? 5), 24),
    100,
  );

  const response = await searchListings({
    ...filters,
    perPage: fetchCount,
    page: 1,
  });

  return {
    listings: response.data,
    source: "search",
  };
}

// ─── Phase 2: Semantic Re-rank ────────────────────────────────
//
// Take the structurally-retrieved candidates and re-rank them using:
// 1. Embedding cosine similarity (query embedding vs listing)
// 2. Feature/lifestyle token matching
// 3. Soft preference matching
// 4. Negative preference penalty

async function semanticRerank(args: {
  candidates: ListingData[];
  queryEmbedding: number[];
  queryText: string;
  hardFilters: SmartMatchHardFilters;
  softPreferences: string[];
  negativePreferences: string[];
  features: string[];
  lifestyle: string[];
  topK: number;
  locale: SmartMatchLocale;
}): Promise<MatchCandidate[]> {
  // Try to get vector similarities for the candidates (batch)
  let vectorScores = new Map<string, number>();

  try {
    const vectorResponse = await vectorSearch({
      embedding: args.queryEmbedding,
      topK: Math.min(args.candidates.length, 50),
      filters: toSearchFilters(args.hardFilters),
    });

    if (vectorResponse.data?.length > 0) {
      vectorScores = new Map(
        vectorResponse.data.map((item: VectorSearchResult) => [
          item.listing.listingKey,
          item.score,
        ]),
      );
    }
  } catch {
    // Vector search unavailable — proceed with local scoring only
  }

  const scored = args.candidates.map((listing) => {
    const candidate = scoreListing({
      listing,
      hardFilters: args.hardFilters,
      softPreferences: args.softPreferences,
      negativePreferences: args.negativePreferences,
      features: args.features,
      lifestyle: args.lifestyle,
      queryText: args.queryText,
      locale: args.locale,
      vectorSimilarity: vectorScores.get(listing.listingKey) ?? null,
    });
    return candidate;
  });

  // Sort by final score, take top K
  scored.sort((a, b) => b.finalScore - a.finalScore);
  const topResults = scored.slice(0, args.topK);

  return enrichImages(topResults);
}

// ─── Legacy Retrieve (vector-first, fallback to search) ──────
// Kept for backward compatibility with contact-based matching

async function retrieveCandidatesLegacy(args: {
  queryEmbedding: number[];
  queryText: string;
  hardFilters: SmartMatchHardFilters;
  softPreferences: string[];
  negativePreferences: string[];
  topK: number;
  locale: SmartMatchLocale;
}) {
  const filters = toSearchFilters(args.hardFilters);

  try {
    const response = await vectorSearch({
      embedding: args.queryEmbedding,
      topK: Math.min(Math.max(args.topK * 4, 20), 50),
      filters,
    });

    if ((response.data ?? []).length > 0) {
      const ranked = response.data
        .map((item: VectorSearchResult) => {
          const candidate = scoreListing({
            listing: item.listing,
            hardFilters: args.hardFilters,
            softPreferences: args.softPreferences,
            negativePreferences: args.negativePreferences,
            features: [],
            lifestyle: [],
            queryText: args.queryText,
            locale: args.locale,
            vectorSimilarity: item.score,
          });

          return {
            ...candidate,
            images: item.media?.slice(0, 5).map((media) => media.mediaURL) ?? [],
          };
        })
        .sort((a, b) => b.finalScore - a.finalScore)
        .slice(0, args.topK);

      return {
        retrievalSource: "vector" as const,
        candidateCount: response.data.length,
        items: ranked,
      };
    }
  } catch {
    // Fall back to structured search.
  }

  // Fallback: use two-phase retrieve → re-rank
  const { listings } = await structuralRetrieve({
    hardFilters: args.hardFilters,
    topK: args.topK,
  });

  const reranked = await semanticRerank({
    candidates: listings,
    queryEmbedding: args.queryEmbedding,
    queryText: args.queryText,
    hardFilters: args.hardFilters,
    softPreferences: args.softPreferences,
    negativePreferences: args.negativePreferences,
    features: [],
    lifestyle: [],
    topK: args.topK,
    locale: args.locale,
  });

  return {
    retrievalSource: "search" as const,
    candidateCount: listings.length,
    items: reranked,
  };
}

// ─── Public API ───────────────────────────────────────────────

export async function getSmartMatchWorkspace(
  input: SmartMatchWorkspaceInput,
  db: Db
) {
  const conditions = [eq(contacts.agentId, input.agentId)];
  if (normalizeOptional(input.query)) {
    conditions.push(
      or(
        ilike(contacts.name, `%${input.query!.trim()}%`),
        ilike(contacts.email, `%${input.query!.trim()}%`),
        ilike(contacts.phone, `%${input.query!.trim()}%`),
        ilike(contacts.area, `%${input.query!.trim()}%`),
        ilike(contacts.summary, `%${input.query!.trim()}%`)
      )!
    );
  }

  const rows = await db
    .select()
    .from(contacts)
    .where(and(...conditions))
    .orderBy(desc(contacts.updatedAt))
    .limit(input.limit ?? 24);

  const profileRows =
    rows.length > 0
      ? await db
          .select()
          .from(buyerProfiles)
          .where(inArray(buyerProfiles.contactId, rows.map((contact) => contact.id)))
      : [];

  const recentRuns = await db
    .select()
    .from(smartMatchRuns)
    .where(eq(smartMatchRuns.agentId, input.agentId))
    .orderBy(desc(smartMatchRuns.createdAt))
    .limit(8);

  const profilesByContactId = new Map(
    profileRows.map((profile) => [profile.contactId, profile])
  );
  const contactsById = new Map(rows.map((contact) => [contact.id, contact]));

  return {
    contacts: rows.map((contact) => ({
      ...contact,
      buyerProfile: profilesByContactId.get(contact.id) ?? null,
    })),
    recentRuns: recentRuns.map((run) => ({
      ...run,
      contactName: contactsById.get(run.contactId)?.name ?? null,
    })),
  };
}

/**
 * Contact-based Smart Match — the original flow.
 * Agent selects a contact → system builds profile → match.
 */
export async function generateSmartMatch(
  input: SmartMatchGenerateInput,
  db: Db
) {
  const startedAt = Date.now();
  const locale = input.locale ?? "zh";
  const topK = input.topK ?? 8;

  const subject = await loadSubject(db, input);
  const hardFilters = buildHardFilters({
    contact: subject.contact,
    legacyClient: subject.legacyClient,
    subscriptions: subject.subscriptions,
    input,
  });
  const preferenceSummary = buildPreferenceSummary({
    contact: subject.contact,
    legacyClient: subject.legacyClient,
    subscriptions: subject.subscriptions,
    feedbackRows: subject.feedbackRows,
    input,
  });

  const queryText = preferenceSummary.canonicalSummary;
  const queryEmbedding = await generateEmbedding(queryText);

  const [profile] = subject.existingProfile
    ? await db
        .update(buyerProfiles)
        .set({
          agentId: input.agentId,
          legacyClientId: subject.legacyClient?.id ?? subject.existingProfile.legacyClientId,
          canonicalSummary: queryText,
          hardFilters,
          softPreferences: preferenceSummary.softPreferences,
          negativePreferences: preferenceSummary.negativePreferences,
          searchMetadata: {
            source: subject.contact.source,
            contactIntent: subject.contact.intent,
            searchBrief: normalizeOptional(input.searchBrief),
            preferredLanguage: subject.contact.preferredLanguage,
            subscriptionIds: subject.subscriptions.map((item) => item.id),
          },
          embedding: queryEmbedding,
          embeddingModel: getEmbeddingModelId(),
          embeddingUpdatedAt: new Date(),
          lastMatchedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(buyerProfiles.id, subject.existingProfile.id))
        .returning()
    : await db
        .insert(buyerProfiles)
        .values({
          agentId: input.agentId,
          contactId: subject.contact.id,
          legacyClientId: subject.legacyClient?.id ?? null,
          status: "active",
          canonicalSummary: queryText,
          hardFilters,
          softPreferences: preferenceSummary.softPreferences,
          negativePreferences: preferenceSummary.negativePreferences,
          searchMetadata: {
            source: subject.contact.source,
            contactIntent: subject.contact.intent,
            searchBrief: normalizeOptional(input.searchBrief),
            preferredLanguage: subject.contact.preferredLanguage,
            subscriptionIds: subject.subscriptions.map((item) => item.id),
          },
          embedding: queryEmbedding,
          embeddingModel: getEmbeddingModelId(),
          embeddingUpdatedAt: new Date(),
          lastMatchedAt: new Date(),
        })
        .returning();

  const retrieval = await retrieveCandidatesLegacy({
    queryEmbedding,
    queryText,
    hardFilters,
    softPreferences: preferenceSummary.softPreferences,
    negativePreferences: preferenceSummary.negativePreferences,
    topK,
    locale,
  });

  const processingMs = Date.now() - startedAt;

  const [run] = await db
    .insert(smartMatchRuns)
    .values({
      agentId: input.agentId,
      contactId: subject.contact.id,
      buyerProfileId: profile.id,
      status: "completed",
      queryText,
      hardFilters,
      topK,
      retrievalSource: retrieval.retrievalSource,
      candidateCount: retrieval.candidateCount,
      returnedCount: retrieval.items.length,
      processingMs,
    })
    .returning();

  if (retrieval.items.length > 0) {
    await db.insert(smartMatchResults).values(
      retrieval.items.map((item) => ({
        runId: run.id,
        listingKey: item.listing.listingKey,
        listingId: item.listing.listingId,
        listingSnapshot: item.listing as unknown as Record<string, unknown>,
        semanticScore: Math.round(item.semanticScore * 1000),
        ruleScore: Math.round(item.ruleScore * 1000),
        behaviorScore: Math.round(item.behaviorScore * 1000),
        finalScore: Math.round(item.finalScore * 1000),
        matchReasons: item.matchReasons,
        images: item.images,
      }))
    );
  }

  return {
    runId: run.id,
    retrievalSource: retrieval.retrievalSource,
    candidateCount: retrieval.candidateCount,
    processingTime: processingMs,
    contact: {
      id: subject.contact.id,
      name: subject.contact.name,
      email: subject.contact.email,
      phone: subject.contact.phone,
      source: subject.contact.source,
      intent: subject.contact.intent,
      area: subject.contact.area,
      budgetMin: subject.contact.budgetMin,
      budgetMax: subject.contact.budgetMax,
      preferredLanguage: subject.contact.preferredLanguage,
    },
    buyerProfile: {
      id: profile.id,
      canonicalSummary: profile.canonicalSummary,
      hardFilters: profile.hardFilters,
      softPreferences: profile.softPreferences,
      negativePreferences: profile.negativePreferences,
      updatedAt: profile.updatedAt,
    },
    requirements: {
      hard: hardFilters,
      soft: preferenceSummary.softPreferences,
      negative: preferenceSummary.negativePreferences,
    },
    recommendations: retrieval.items.map((item) => ({
      property: {
        listingKey: item.listing.listingKey,
        listingId: item.listing.listingId,
        unparsedAddress: item.listing.unparsedAddress,
        city: item.listing.city,
        stateOrProvince: item.listing.stateOrProvince,
        postalCode: item.listing.postalCode,
        listPrice: item.listing.listPrice,
        propertyType: item.listing.propertyType,
        bedroomsTotal: item.listing.bedroomsTotal,
        bathroomsTotalInteger: item.listing.bathroomsTotalInteger,
        livingArea: item.listing.livingArea,
        publicRemarks: item.listing.publicRemarks,
        standardStatus: item.listing.standardStatus,
      },
      matchReasons: item.matchReasons,
      images: item.images,
      scoreBreakdown: {
        semanticScore: Number(item.semanticScore.toFixed(3)),
        ruleScore: Number(item.ruleScore.toFixed(3)),
        behaviorScore: Number(item.behaviorScore.toFixed(3)),
        finalScore: Number(item.finalScore.toFixed(3)),
      } satisfies ScoreBreakdown,
    })),
  };
}

/**
 * Natural Language Smart Match — the new flow.
 * Agent types a free-text query → LLM parses → structured retrieve → semantic re-rank.
 * No contact required (optional for behavioral context).
 *
 * Pipeline:
 *   1. LLM parses NL query → structured filters + features + lifestyle + residual
 *   2. Structural retrieve using hard filters (price, city, beds, type)
 *   3. Generate embedding from semantic text (features + lifestyle + residual)
 *   4. Semantic re-rank using embedding similarity + feature matching
 *   5. Return ranked results with match reasons
 */
export async function generateNLSearch(
  input: SmartMatchNLSearchInput,
  db: Db,
) {
  const startedAt = Date.now();

  // ── Step 1: LLM Query Parsing (~300-500ms) ──────────────
  const parsed = await parseSearchQuery(input.query);
  const locale = parsed.locale;
  const topK = input.topK ?? 8;

  // Build hard filters from parsed structured data
  const hardFilters: SmartMatchHardFilters = {
    city: parsed.filters.city ?? null,
    postalCode: parsed.filters.postalCode ?? null,
    propertyType: parsed.filters.propertyType ?? null,
    minPrice: parsed.filters.minPrice ?? null,
    maxPrice: parsed.filters.maxPrice ?? null,
    minBedrooms: parsed.filters.minBedrooms ?? null,
    maxBedrooms: parsed.filters.maxBedrooms ?? null,
    status: "Active",
  };

  // Load contact context if provided (for behavioral enrichment)
  let softPreferences: string[] = [];
  let negativePreferences: string[] = [];

  if (input.contactId) {
    try {
      const [contact] = await db
        .select()
        .from(contacts)
        .where(and(eq(contacts.id, input.contactId), eq(contacts.agentId, input.agentId)))
        .limit(1);

      if (contact) {
        const legacyClient = await findLegacyClientForContact(db, input.agentId, contact);
        if (legacyClient) {
          softPreferences = parseArrayText(legacyClient.mustHaveFeatures);
          negativePreferences = parseArrayText(legacyClient.dealBreakers);
        }
      }
    } catch {
      // Contact enrichment is optional — proceed without
    }
  }

  // ── Step 2: Structural Retrieve (~200-400ms) ────────────
  const { listings } = await structuralRetrieve({
    hardFilters,
    topK,
    candidateMultiplier: 5,
  });

  // ── Step 3: Generate Embedding (~200-300ms) ─────────────
  const semanticText = buildSemanticText(parsed);
  const queryEmbedding = await generateEmbedding(semanticText);

  // ── Step 4: Semantic Re-rank (~50-100ms) ────────────────
  const reranked = await semanticRerank({
    candidates: listings,
    queryEmbedding,
    queryText: input.query,
    hardFilters,
    softPreferences,
    negativePreferences,
    features: parsed.features,
    lifestyle: parsed.lifestyle,
    topK,
    locale,
  });

  const processingMs = Date.now() - startedAt;

  // ── Step 5: Persist run for analytics ───────────────────
  const [run] = await db
    .insert(smartMatchRuns)
    .values({
      agentId: input.agentId,
      contactId: input.contactId ?? 0,
      buyerProfileId: null,
      status: "completed",
      queryText: input.query,
      hardFilters,
      topK,
      retrievalSource: "nl_search",
      candidateCount: listings.length,
      returnedCount: reranked.length,
      processingMs,
    })
    .returning();

  if (reranked.length > 0) {
    await db.insert(smartMatchResults).values(
      reranked.map((item) => ({
        runId: run.id,
        listingKey: item.listing.listingKey,
        listingId: item.listing.listingId,
        listingSnapshot: item.listing as unknown as Record<string, unknown>,
        semanticScore: Math.round(item.semanticScore * 1000),
        ruleScore: Math.round(item.ruleScore * 1000),
        behaviorScore: Math.round(item.behaviorScore * 1000),
        finalScore: Math.round(item.finalScore * 1000),
        matchReasons: item.matchReasons,
        images: item.images,
      })),
    );
  }

  return {
    runId: run.id,
    retrievalSource: "nl_search" as const,
    candidateCount: listings.length,
    processingTime: processingMs,
    parsedQuery: {
      filters: parsed.filters,
      features: parsed.features,
      lifestyle: parsed.lifestyle,
      residualText: parsed.residualText,
      locale: parsed.locale,
    },
    recommendations: reranked.map((item) => ({
      property: {
        listingKey: item.listing.listingKey,
        listingId: item.listing.listingId,
        unparsedAddress: item.listing.unparsedAddress,
        city: item.listing.city,
        stateOrProvince: item.listing.stateOrProvince,
        postalCode: item.listing.postalCode,
        listPrice: item.listing.listPrice,
        propertyType: item.listing.propertyType,
        bedroomsTotal: item.listing.bedroomsTotal,
        bathroomsTotalInteger: item.listing.bathroomsTotalInteger,
        livingArea: item.listing.livingArea,
        publicRemarks: item.listing.publicRemarks,
        standardStatus: item.listing.standardStatus,
      },
      matchReasons: item.matchReasons,
      images: item.images,
      scoreBreakdown: {
        semanticScore: Number(item.semanticScore.toFixed(3)),
        ruleScore: Number(item.ruleScore.toFixed(3)),
        behaviorScore: Number(item.behaviorScore.toFixed(3)),
        finalScore: Number(item.finalScore.toFixed(3)),
      } satisfies ScoreBreakdown,
    })),
  };
}
