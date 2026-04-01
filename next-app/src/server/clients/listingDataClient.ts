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
  const res = await getClient().get<ListingResponse>(
    `/api/v1/listings/by-key/${encodeURIComponent(listingKey)}`,
  );
  return res.data;
}

/**
 * GET /api/v1/listings/:mls
 * Return a full listing by MLS / listingId.
 */
export async function getListingByMls(mlsId: string): Promise<ListingResponse> {
  const res = await getClient().get<ListingResponse>(
    `/api/v1/listings/${encodeURIComponent(mlsId)}`,
  );
  return res.data;
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
  const res = await getClient().post<AddressCandidatesResponse>(
    "/api/v1/listings/address-candidates",
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
  const res = await getClient().post<ListingSearchResponse>(
    "/api/v1/listings/search",
    filters,
  );
  return res.data;
}

/**
 * POST /api/v1/listings/batch
 * Fetch multiple listing summaries by listingKeys in a single round-trip.
 */
export async function getListingsBatch(
  keys: string[],
): Promise<Map<string, ListingResponse>> {
  const res = await getClient().post<{ items: ListingResponse[]; notFound: string[] }>(
    "/api/v1/listings/batch",
    { listingKeys: keys },
  );
  const map = new Map<string, ListingResponse>();
  for (const item of res.data.items) {
    map.set(item.data.listingKey, item);
  }
  return map;
}

/**
 * GET /api/v1/listings/:listingKey/media
 * Return media rows and resolved image URLs for a listing.
 */
export async function getListingMedia(
  listingKey: string,
): Promise<{ data: import("./types").MediaItem[] }> {
  const res = await getClient().get(
    `/api/v1/listings/${encodeURIComponent(listingKey)}/media`,
  );
  return res.data;
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
  const res = await getClient().post<VectorSearchResponse>(
    "/api/v1/vector/search",
    params,
  );
  return res.data;
}

// ─── Namespace export ──────────────────────────────────────────

export const listingDataClient = {
  // Stable
  getListing,
  getListingByMls,
  resolveByAddress,
  getAddressCandidates,
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
