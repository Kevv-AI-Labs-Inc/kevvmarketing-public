/**
 * Listing-Data Service API Client (BBO)
 *
 * HTTP client for the BBO REST API (Kevv API Platform).
 * All listing data is fetched from BBO; the marketing-app never
 * reads listing tables directly.
 *
 * Auth: Bearer token via LISTING_DATA_SERVICE_API_KEY env var.
 * Base URL: LISTING_DATA_SERVICE_URL env var.
 *
 * Stable endpoints  → /api/v1/...
 * Internal endpoints → /api/internal/...
 */

import axios, { AxiosInstance, AxiosError } from "axios";
import { ENV } from "../_core/env";
import type {
  // Listing lookup
  ListingData,
  ListingResponse,
  ListingSearchResponse,
  AddressResolveResponse,
  AddressCandidatesResponse,
  AddressLookupInput,
  // CMA
  CmaByListingResponse,
  // Neighborhood
  NeighborhoodSummary,
  // Vector (legacy)
  VectorSearchResponse,
  VectorSearchParams,
  // Health
  SyncStatusResponse,
  SearchFilters,
  ApiErrorResponse,
} from "./types";
import { ListingDataServiceError } from "./types";

type RawListingRecord = Record<string, unknown>;

type RawListingFull = {
  source?: "local" | "mlsgrid" | "MLSGrid" | "manual";
  fallbackUsed?: boolean;
  freshness?: string | null;
  lookup?: {
    input?: string;
    matchedBy?: string;
  };
  property?: RawListingRecord | null;
  media?: import("./types").MediaItem[] | null;
  imageUrls?: string[] | null;
  thumbnailUrl?: string | null;
};

type RawListingSearchResponse = {
  items?: RawListingRecord[] | null;
  nextCursor?: string | null;
};

type RawBatchListingResponse = {
  items?: RawListingRecord[] | null;
  notFound?: string[] | null;
};

type RawListingMediaResponse = {
  media?: import("./types").MediaItem[] | null;
  imageUrls?: string[] | null;
  thumbnailUrl?: string | null;
};

type RawVectorSearchResponse = {
  data?: Array<{
    listing?: RawListingRecord | null;
    score?: number | null;
    media?: import("./types").MediaItem[] | null;
  }> | null;
  meta?: {
    total?: number;
    embeddingModel?: string;
  } | null;
};

function asString(value: unknown) {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function asNullableString(value: unknown) {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function asNullableNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeListingData(record: RawListingRecord | null | undefined): ListingData {
  const row = record ?? {};

  return {
    listingKey: asString(row.listingKey),
    listingId: asString(row.listingId),
    standardStatus: asString(row.standardStatus ?? row.status),
    unparsedAddress: asString(row.unparsedAddress ?? row.address),
    city: asString(row.city),
    stateOrProvince: asString(row.stateOrProvince ?? row.state),
    postalCode: asString(row.postalCode),
    latitude: asString(row.latitude),
    longitude: asString(row.longitude),
    listPrice: asString(row.listPrice ?? row.price),
    propertyType: asString(row.propertyType),
    bedroomsTotal: asNullableNumber(row.bedroomsTotal ?? row.bedrooms),
    bathroomsTotalInteger: asNullableNumber(
      row.bathroomsTotalInteger ?? row.bathrooms,
    ),
    livingArea: asString(row.livingArea),
    publicRemarks: asString(row.publicRemarks),
    listAgentFullName: asString(row.listAgentFullName),
    listOfficeName: asString(row.listOfficeName),
    yearBuilt: asNullableNumber(row.yearBuilt) ?? undefined,
    garageSpaces: asNullableNumber(row.garageSpaces) ?? undefined,
    lotSizeAcres: asNullableString(row.lotSizeAcres) ?? undefined,
    associationFee: asNullableString(row.associationFee) ?? undefined,
    daysOnMarket: asNullableNumber(row.daysOnMarket) ?? undefined,
    originalListPrice: asNullableString(row.originalListPrice) ?? undefined,
    closePrice: asNullableString(row.closePrice) ?? undefined,
    closeDate: asNullableString(row.closeDate) ?? undefined,
    thumbnailUrl: asNullableString(row.thumbnailUrl),
    modificationTimestamp: asNullableString(row.modificationTimestamp),
    countyOrParish: asNullableString(row.countyOrParish),
    lotSizeArea: asNullableNumber(row.lotSizeArea),
  };
}

function normalizeListingResponse(raw: RawListingFull): ListingResponse {
  const imageUrls = Array.isArray(raw.imageUrls)
    ? raw.imageUrls.filter((value): value is string => typeof value === "string")
    : [];
  const media = Array.isArray(raw.media) ? raw.media : [];

  return {
    data: normalizeListingData(raw.property),
    source: raw.source === "manual" ? "manual" : "MLSGrid",
    fallbackUsed: Boolean(raw.fallbackUsed),
    freshness: raw.freshness ?? null,
    media,
    imageUrls,
    lookup:
      raw.lookup && typeof raw.lookup === "object"
        ? {
            input: typeof raw.lookup.input === "string" ? raw.lookup.input : "",
            matchedBy:
              typeof raw.lookup.matchedBy === "string"
                ? raw.lookup.matchedBy
                : "",
          }
        : undefined,
    thumbnailUrl:
      typeof raw.thumbnailUrl === "string"
        ? raw.thumbnailUrl
        : imageUrls[0] ?? null,
  };
}

function normalizeSearchFilters(filters: SearchFilters) {
  return {
    q: filters.search?.trim() || undefined,
    city: filters.city?.trim() || undefined,
    stateOrProvince: filters.stateOrProvince?.trim() || undefined,
    postalCode: filters.postalCode?.trim() || undefined,
    minPrice: filters.minPrice,
    maxPrice: filters.maxPrice,
    bedsMin: filters.minBedrooms,
    bathsMin: filters.minBathrooms,
    status: filters.status?.trim() || undefined,
    propertyType: filters.propertyType?.trim() || undefined,
    limit: filters.limit ?? filters.perPage ?? 24,
    cursor: filters.cursor,
  };
}

function normalizeSearchResponse(
  raw: RawListingSearchResponse,
  requestedLimit: number,
): ListingSearchResponse {
  const items = Array.isArray(raw.items)
    ? raw.items.map((item) => normalizeListingData(item))
    : [];

  return {
    data: items,
    meta: {
      total: items.length,
      page: 1,
      perPage: requestedLimit,
      totalPages: items.length > 0 ? 1 : 0,
    },
    nextCursor: raw.nextCursor ?? null,
  };
}

// ─── Client Singleton ──────────────────────────────────────────

let _client: AxiosInstance | null = null;

function getClient(): AxiosInstance {
  if (_client) return _client;

  const baseURL = ENV.listingDataServiceUrl;
  if (!baseURL) {
    throw new Error(
      "LISTING_DATA_SERVICE_URL is not configured. " +
        "Set this env var to point to the BBO listing-data-service.",
    );
  }

  _client = axios.create({
    baseURL,
    timeout: 10_000,
    headers: {
      "Content-Type": "application/json",
      ...(ENV.listingDataServiceApiKey
        ? { Authorization: `Bearer ${ENV.listingDataServiceApiKey}` }
        : {}),
    },
  });

  // Unwrap BBO error envelopes into ListingDataServiceError
  _client.interceptors.response.use(
    (response) => response,
    (error: AxiosError<ApiErrorResponse>) => {
      if (error.response) {
        const { status, data } = error.response;
        const msg = data?.error?.message ?? error.message;
        const code = data?.error?.code ?? "unknown_error";
        throw new ListingDataServiceError(status, code, msg);
      }
      throw new ListingDataServiceError(
        502,
        "service_unreachable",
        `BBO service unreachable: ${error.message}`,
      );
    },
  );

  return _client;
}

// ─── Stable Endpoints (/api/v1) ────────────────────────────────

/**
 * GET /api/v1/listings/by-key/:listingKey
 * Return a full listing by its canonical listingKey.
 */
export async function getListing(listingKey: string): Promise<ListingResponse> {
  const res = await getClient().get<RawListingFull>(
    `/api/v1/listings/by-key/${encodeURIComponent(listingKey)}`,
  );
  return normalizeListingResponse(res.data);
}

/**
 * GET /api/v1/listings/:mls
 * Return a full listing by MLS / listingId.
 */
export async function getListingByMls(mlsId: string): Promise<ListingResponse> {
  const res = await getClient().get<RawListingFull>(
    `/api/v1/listings/${encodeURIComponent(mlsId)}`,
  );
  return normalizeListingResponse(res.data);
}

/**
 * POST /api/v1/listings/by-address
 * Strict single-listing address resolver.
 *
 * Returns the matched listing on 200.
 * Throws ListingDataServiceError(404) if not found.
 * Throws ListingDataServiceError(409, "AMBIGUOUS_ADDRESS") if multiple
 * candidates exist — caller should fall back to getAddressCandidates().
 */
export async function resolveByAddress(
  input: AddressLookupInput,
): Promise<AddressResolveResponse> {
  const res = await getClient().post<AddressResolveResponse>(
    "/api/v1/listings/by-address",
    input,
  );
  return res.data;
}

/**
 * POST /api/v1/listings/address-candidates
 * Fuzzy address search — returns ranked candidates with confidence scores.
 * Use this to power disambiguation UIs or as a pre-resolve step.
 *
 * limit: 1-15, default 8
 */
export async function getAddressCandidates(
  input: AddressLookupInput & { limit?: number },
): Promise<AddressCandidatesResponse> {
  const res = await getClient().post<unknown[]>(
    "/api/v1/listings/address-candidates",
    input,
  );
  return {
    data: Array.isArray(res.data) ? (res.data as AddressCandidatesResponse["data"]) : [],
  };
}

/**
 * POST /api/v1/listings/by-location
 * Spatial proximity search — find listings near a lat/lng coordinate.
 * Uses Haversine formula on BBO's stored coordinates.
 */
export async function getListingsByLocation(input: {
  latitude: number;
  longitude: number;
  radiusKm?: number;
  limit?: number;
}): Promise<{ items: Array<{ data: ListingData; imageUrls?: string[]; distanceKm?: number }> }> {
  const res = await getClient().post(
    "/api/v1/listings/by-location",
    input,
  );
  return res.data;
}

/**
 * POST /api/v1/listings/search  (was GET in v0 client — BBO requires POST)
 * Search listings with structured filters.
 */
export async function searchListings(
  filters: SearchFilters,
): Promise<ListingSearchResponse> {
  const payload = normalizeSearchFilters(filters);
  const res = await getClient().post<RawListingSearchResponse>(
    "/api/v1/listings/search",
    payload,
  );
  return normalizeSearchResponse(res.data, payload.limit ?? 24);
}

/**
 * POST /api/v1/listings/batch
 * Fetch multiple listing summaries by listingKeys in a single round-trip.
 */
export async function getListingsBatch(
  keys: string[],
): Promise<Map<string, ListingResponse>> {
  const res = await getClient().post<RawBatchListingResponse>(
    "/api/v1/listings/batch",
    { listingKeys: keys },
  );
  const map = new Map<string, ListingResponse>();
  for (const item of res.data.items ?? []) {
    const data = normalizeListingData(item);
    if (!data.listingKey) continue;
    const thumbnailUrl = data.thumbnailUrl ?? null;
    map.set(data.listingKey, {
      data,
      source: "MLSGrid",
      fallbackUsed: false,
      freshness: data.modificationTimestamp ?? null,
      media: [],
      imageUrls: thumbnailUrl ? [thumbnailUrl] : [],
      thumbnailUrl,
    });
  }
  return map;
}

/**
 * GET /api/v1/listings/:listingKey/media
 * Return media rows and resolved image URLs for a listing.
 */
export async function getListingMedia(
  listingKey: string,
): Promise<{
  data: import("./types").MediaItem[];
  imageUrls: string[];
  thumbnailUrl: string | null;
}> {
  const res = await getClient().get<RawListingMediaResponse>(
    `/api/v1/listings/${encodeURIComponent(listingKey)}/media`,
  );
  const imageUrls = Array.isArray(res.data.imageUrls)
    ? res.data.imageUrls.filter((value): value is string => typeof value === "string")
    : [];

  return {
    data: Array.isArray(res.data.media) ? res.data.media : [],
    imageUrls,
    thumbnailUrl:
      typeof res.data.thumbnailUrl === "string"
        ? res.data.thumbnailUrl
        : imageUrls[0] ?? null,
  };
}

/**
 * GET /api/v1/sync/status
 * BBO aggregate sync health check.
 */
export async function getSyncStatus(): Promise<SyncStatusResponse> {
  const res = await getClient().get<SyncStatusResponse>("/api/v1/sync/status");
  return res.data;
}

// ─── Internal Endpoints (/api/internal) ────────────────────────

/**
 * POST /api/internal/cma/by-listing
 * Return CMA comparables for a subject listing using BBO's
 * vector search (or SQL fallback).
 *
 * BBO handles embedding generation internally — no need to call
 * generateEmbedding() on our side.
 *
 * limit: 1-20, default 10
 */
export async function getCmaByListing(
  listingKey: string,
  limit = 5,
): Promise<CmaByListingResponse> {
  const res = await getClient().post<CmaByListingResponse>(
    "/api/internal/cma/by-listing",
    { listingKey, limit },
  );
  return res.data;
}

/**
 * GET /api/internal/listings/:listingKey/similar
 * Return similar active/recent listings for a subject.
 * (Lighter-weight than CMA — no closed-sales filter.)
 *
 * limit: 1-20, default 8
 */
export async function getSimilarListings(
  listingKey: string,
  limit = 8,
): Promise<{
  subject: import("./types").CmaSubject;
  items: import("./types").CmaComparable[];
  meta: { total: number; source: "vector" | "sql_fallback" };
}> {
  const res = await getClient().get(
    `/api/internal/listings/${encodeURIComponent(listingKey)}/similar`,
    { params: { limit } },
  );
  return res.data;
}

/**
 * GET /api/internal/neighborhoods/:zipCode/summary
 * Return neighborhood profile for a ZIP code.
 * Includes schoolRating, walkScore, medianHomePrice, profileText, etc.
 *
 * Returns null if BBO has no data for that ZIP.
 */
export async function getNeighborhoodSummary(
  zipCode: string,
): Promise<NeighborhoodSummary | null> {
  try {
    const res = await getClient().get<NeighborhoodSummary>(
      `/api/internal/neighborhoods/${encodeURIComponent(zipCode)}/summary`,
    );
    return res.data;
  } catch (err) {
    // 404 = no neighborhood data for this ZIP — not an error, just return null
    if (err instanceof ListingDataServiceError && err.statusCode === 404) {
      return null;
    }
    throw err;
  }
}

// ─── Legacy: direct vector search (kept for other use-cases) ───

/**
 * POST /api/v1/vector/search
 * Low-level vector similarity search using a pre-computed embedding.
 * For home-value estimation prefer getCmaByListing() which handles
 * embedding generation and filtering internally.
 */
export async function vectorSearch(
  params: VectorSearchParams,
): Promise<VectorSearchResponse> {
  const res = await getClient().post<RawVectorSearchResponse>(
    "/api/v1/vector/search",
    params,
  );
  return {
    data: Array.isArray(res.data.data)
      ? res.data.data.map((item) => ({
          listing: normalizeListingData(item.listing ?? {}),
          score:
            typeof item.score === "number" && Number.isFinite(item.score)
              ? item.score
              : 0,
          media: Array.isArray(item.media) ? item.media : [],
        }))
      : [],
    meta: {
      total: res.data.meta?.total ?? 0,
      embeddingModel: res.data.meta?.embeddingModel ?? "",
    },
  };
}

// ─── Namespace export ──────────────────────────────────────────

export const listingDataClient = {
  // Stable
  getListing,
  getListingByMls,
  resolveByAddress,
  getAddressCandidates,
  getListingsByLocation,
  searchListings,
  getListingsBatch,
  getListingMedia,
  getSyncStatus,
  // Internal
  getCmaByListing,
  getSimilarListings,
  getNeighborhoodSummary,
  // Legacy
  vectorSearch,
};
