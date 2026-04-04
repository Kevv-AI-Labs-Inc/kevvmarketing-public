/**
 * Shared types for listing-data-service (BBO) API responses.
 * These mirror the contract defined in BBO/LISTING_DATA_SERVICE_API_V1.md
 * and BBO/server/apiPlatformService.ts.
 */

// ─── Core Listing Types ────────────────────────────────────────

export interface MediaItem {
  mediaKey: string;
  mediaURL: string;
  mediaType: string;
  order: number;
}

export interface ListingData {
  listingKey: string;
  listingId: string;
  standardStatus: string;
  unparsedAddress: string;
  city: string;
  stateOrProvince: string;
  postalCode: string;
  latitude: string;
  longitude: string;
  listPrice: string;
  propertyType: string;
  bedroomsTotal: number | null;
  bathroomsTotalInteger: number | null;
  livingArea: string;
  publicRemarks: string;
  listAgentFullName: string;
  listOfficeName: string;
  // Extended fields (optional, may not be in every response)
  yearBuilt?: number;
  garageSpaces?: number;
  lotSizeAcres?: string;
  associationFee?: string;
  daysOnMarket?: number;
  originalListPrice?: string;
  closePrice?: string;
  closeDate?: string;
  thumbnailUrl?: string | null;
  modificationTimestamp?: string | null;
  countyOrParish?: string | null;
  lotSizeArea?: number | null;
}

// ─── Listing Lookup Responses ──────────────────────────────────

export interface ListingResponse {
  data: ListingData;
  source: "MLSGrid" | "manual";
  fallbackUsed: boolean;
  freshness?: string | null;
  media: MediaItem[];
  imageUrls: string[];
  lookup?: {
    input: string;
    matchedBy: string;
  };
  thumbnailUrl?: string | null;
}

export interface ListingSearchResponse {
  data: ListingData[];
  meta: {
    total: number;
    page: number;
    perPage: number;
    totalPages: number;
  };
  nextCursor?: string | null;
}

/**
 * Response from POST /api/v1/listings/by-address
 * (BBO's "ListingFull" shape — property is the raw MLS row)
 */
export interface AddressResolveResponse {
  source: "local" | "mlsgrid";
  fallbackUsed: boolean;
  lookup: {
    input: string;
    matchedBy: "listingId" | "listingKey" | "address";
  };
  property: ListingData;           // cast from Record<string,any>; fields match ListingData
  media: MediaItem[];
  imageUrls: string[];
  imageCount: number;
  r2ImageCount: number;
}

/**
 * One candidate from POST /api/v1/listings/address-candidates
 * Returned when the address is ambiguous (or as a ranked list).
 * confidence ∈ [0,1] — higher is better.
 */
export interface AddressCandidate {
  listingKey: string | null;
  listingId: string | null;
  address: string | null;
  city: string | null;
  stateOrProvince: string | null;
  postalCode: string | null;
  standardStatus: string | null;
  confidence: number;
  source: "local" | "mlsgrid";
}

export interface AddressCandidatesResponse {
  data: AddressCandidate[];
}

// ─── CMA Types ─────────────────────────────────────────────────

/**
 * The subject listing summary returned inside a CMA response.
 * Mirrors BBO's `CmaSubject` shape from apiPlatformService.ts.
 */
export interface CmaSubject {
  listingKey: string | null;
  listingId: string | null;
  address: string | null;
  city: string | null;
  postalCode: string | null;
  price: string | null;          // listPrice (or closePrice for closed)
  propertyType: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  livingArea: string | null;
}

/**
 * One comparable sale returned inside a CMA response.
 * score = cosine similarity from vector search (null if SQL fallback).
 */
export interface CmaComparable {
  listingKey: string;
  listingId: string | null;
  address: string | null;
  city: string | null;
  postalCode: string | null;
  price: string | null;          // close price for sold comps
  propertyType: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  livingArea: string | null;
  yearBuilt: number | null;
  status: string | null;
  score: number | null;          // vector similarity score (0-1)
  soldDate?: string | null;      // close date for sold comps
  source?: "bbo_vector" | "bbo_search" | "rentcast"; // origin of this comp
}

/**
 * Response from POST /api/internal/cma/by-listing
 */
export interface CmaByListingResponse {
  data: {
    subject: CmaSubject;
    comparables: CmaComparable[];
    source: "vector" | "sql_fallback";
  };
  meta: {
    total: number;
    source: "vector" | "sql_fallback";
  };
}

// ─── Neighborhood Types ────────────────────────────────────────

/**
 * Response from GET /api/internal/neighborhoods/:zipCode/summary
 * Mirrors BBO's neighborhoods DB row (drizzle/schema.ts).
 */
export interface NeighborhoodSummary {
  id: number;
  zipCode: string;
  city: string | null;
  stateOrProvince: string | null;
  county: string | null;
  name: string | null;
  schoolRating: number | null;      // 1-10
  walkScore: number | null;         // 0-100
  crimeIndex: number | null;        // lower = safer
  medianHomePrice: string | null;   // e.g. "850000"
  medianHouseholdIncome: string | null;
  populationDensity: number | null;
  medianAge: number | null;
  profileText: string | null;       // AI-generated neighbourhood description
  highlights: unknown;              // jsonb array of bullet strings
  createdAt: string;
  updatedAt: string;
}

// ─── Vector Search (legacy / direct embedding path) ───────────

export interface VectorSearchResult {
  listing: ListingData;
  score: number;
  media: MediaItem[];
}

export interface VectorSearchResponse {
  data: VectorSearchResult[];
  meta: {
    total: number;
    embeddingModel: string;
  };
}

// ─── Other Response Types ──────────────────────────────────────

export interface SyncStatusResponse {
  data: {
    properties: { lastSync: string; status: string; recordCount: number };
    media: { lastSync: string; status: string; recordCount: number };
    members: { lastSync: string; status: string; recordCount: number };
  };
}

// ─── Request Types ─────────────────────────────────────────────

export interface SearchFilters {
  search?: string;
  status?: string;
  city?: string;
  stateOrProvince?: string;
  postalCode?: string;
  minPrice?: number;
  maxPrice?: number;
  propertyType?: string;
  minBedrooms?: number;
  maxBedrooms?: number;
  minBathrooms?: number;
  page?: number;
  perPage?: number;
  limit?: number;
  cursor?: string;
}

export interface AddressLookupInput {
  address: string;
  city?: string;
  stateOrProvince?: string;
  postalCode?: string;
}

export interface ProximitySearchInput {
  latitude: number;
  longitude: number;
  radiusKm?: number;
  limit?: number;
}

export interface VectorSearchParams {
  embedding: number[];
  topK?: number;
  filters?: SearchFilters;
}

// ─── API Error ─────────────────────────────────────────────────

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Array<{ field: string; message: string; code: string }>;
  };
}

export class ListingDataServiceError extends Error {
  constructor(
    public statusCode: number,
    public errorCode: string,
    message: string,
  ) {
    super(message);
    this.name = "ListingDataServiceError";
  }
}
