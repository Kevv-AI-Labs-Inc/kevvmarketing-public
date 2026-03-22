/**
 * Listing-Data Service API Client
 *
 * HTTP client for the listing-data-service REST API.
 * Replaces direct DB queries to properties/media/neighborhoods tables.
 *
 * All listing data is fetched from the listing-data-service;
 * the marketing-app never reads listing tables directly.
 */

import axios, { AxiosInstance, AxiosError } from "axios";
import { ENV } from "../_core/env";
import type {
  ListingResponse,
  ListingSearchResponse,
  VectorSearchResponse,
  SyncStatusResponse,
  SearchFilters,
  VectorSearchParams,
  ApiErrorResponse,
} from "./types";
import { ListingDataServiceError } from "./types";

// ─── Client Singleton ──────────────────────────────────────

let _client: AxiosInstance | null = null;

function getClient(): AxiosInstance {
  if (_client) return _client;

  const baseURL = ENV.listingDataServiceUrl;
  if (!baseURL) {
    throw new Error(
      "LISTING_DATA_SERVICE_URL is not configured. " +
        "Set this env var to point to the listing-data-service."
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

  // Response interceptor: unwrap errors into ListingDataServiceError
  _client.interceptors.response.use(
    (response) => response,
    (error: AxiosError<ApiErrorResponse>) => {
      if (error.response) {
        const { status, data } = error.response;
        const msg = data?.error?.message ?? error.message;
        const code = data?.error?.code ?? "unknown_error";
        throw new ListingDataServiceError(status, code, msg);
      }
      // Network error / timeout
      throw new ListingDataServiceError(
        502,
        "service_unreachable",
        `listing-data-service unreachable: ${error.message}`
      );
    }
  );

  return _client;
}

// ─── Public API ────────────────────────────────────────────

/**
 * Get a single listing by its listingKey.
 */
export async function getListing(
  listingKey: string
): Promise<ListingResponse> {
  const res = await getClient().get<ListingResponse>(
    `/api/v1/listings/by-key/${encodeURIComponent(listingKey)}`
  );
  return res.data;
}

/**
 * Get a single listing by its MLS ID.
 */
export async function getListingByMls(
  mlsId: string
): Promise<ListingResponse> {
  const res = await getClient().get<ListingResponse>(
    `/api/v1/listings/${encodeURIComponent(mlsId)}`
  );
  return res.data;
}

/**
 * Search listings with filters (status, city, price range, etc.)
 */
export async function searchListings(
  filters: SearchFilters
): Promise<ListingSearchResponse> {
  const res = await getClient().get<ListingSearchResponse>(
    "/api/v1/listings/search",
    { params: filters }
  );
  return res.data;
}

/**
 * Semantic vector search for listings by embedding similarity.
 */
export async function vectorSearch(
  params: VectorSearchParams
): Promise<VectorSearchResponse> {
  const res = await getClient().post<VectorSearchResponse>(
    "/api/v1/vector/search",
    params
  );
  return res.data;
}

/**
 * Get media items for a specific listing.
 */
export async function getListingMedia(
  listingKey: string
): Promise<{ data: import("./types").MediaItem[] }> {
  const res = await getClient().get(
    `/api/v1/listings/${encodeURIComponent(listingKey)}/media`
  );
  return res.data;
}

/**
 * Health check / sync status of the listing-data-service.
 */
export async function getSyncStatus(): Promise<SyncStatusResponse> {
  const res = await getClient().get<SyncStatusResponse>(
    "/api/v1/system/sync-status"
  );
  return res.data;
}

/**
 * Fetch multiple listings by keys in parallel (convenience helper).
 * Returns a Map<listingKey, ListingResponse> for easy lookup.
 */
export async function getListingsBatch(
  keys: string[]
): Promise<Map<string, ListingResponse>> {
  const results = await Promise.allSettled(
    keys.map((key) => getListing(key))
  );

  const map = new Map<string, ListingResponse>();
  for (let i = 0; i < keys.length; i++) {
    const result = results[i];
    if (result.status === "fulfilled") {
      map.set(keys[i], result.value);
    }
    // Skip failed lookups silently — caller can check map.has(key)
  }
  return map;
}

// Namespace export for consumers that import { listingDataClient }
export const listingDataClient = {
  getListing,
  getListingByMls,
  searchListings,
  vectorSearch,
  getListingMedia,
  getSyncStatus,
  getListingsBatch,
};
