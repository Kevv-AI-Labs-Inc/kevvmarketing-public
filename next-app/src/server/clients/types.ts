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

/** Response from GET /api/v1/listings/by-address. */
export interface AddressResolveResponse {
  source: "local" | "mlsgrid";
  fallbackUsed: boolean;
  property: ListingData;
  media: MediaItem[];
  imageUrls: string[];
  imageCount: number;
  freshness?: {
    lastSyncedAt?: string | null;
    modifiedAt?: string | null;
    isStale?: boolean;
  } | null;
}

/** One candidate from GET /api/v1/listings/address-candidates. */
export interface AddressCandidate {
  listingKey: string;
  listingId: string;
  unparsedAddress: string;
  city: string;
  stateOrProvince: string;
  postalCode: string;
  standardStatus: string;
}

export interface AddressCandidatesResponse {
  data: AddressCandidate[];
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
