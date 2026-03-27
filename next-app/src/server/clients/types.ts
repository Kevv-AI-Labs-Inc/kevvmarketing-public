/**
 * Shared types for listing-data-service API responses.
 * These mirror the contract defined in api-design/SKILL.md.
 */

// ─── Core Types ────────────────────────────────────────────

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
}

export interface ListingResponse {
  data: ListingData;
  source: "MLSGrid" | "manual";
  fallbackUsed: boolean;
  freshness: string;
  media: MediaItem[];
  imageUrls: string[];
}

export interface ListingSearchResponse {
  data: ListingData[];
  meta: {
    total: number;
    page: number;
    perPage: number;
    totalPages: number;
  };
}

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

export interface SyncStatusResponse {
  data: {
    properties: { lastSync: string; status: string; recordCount: number };
    media: { lastSync: string; status: string; recordCount: number };
    members: { lastSync: string; status: string; recordCount: number };
  };
}

// ─── Request Types ─────────────────────────────────────────

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
  page?: number;
  perPage?: number;
}

export interface VectorSearchParams {
  embedding: number[];
  topK?: number;
  filters?: SearchFilters;
}

// ─── API Error ─────────────────────────────────────────────

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
