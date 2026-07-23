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
 * Contract endpoints live under /api/v1/.
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
  AddressCandidate,
  AddressLookupInput,
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
  totalCount?: number;
  hasMore?: boolean;
  limit?: number;
  offset?: number;
};

type RawBatchListingResponse = {
  results?: Array<RawListingFull & { listingKey?: string; error?: string }> | null;
};

type RawAddressCandidatesResponse = {
  candidates?: AddressCandidate[] | null;
};

type RawListingMediaResponse = {
  media?: import("./types").MediaItem[] | null;
  imageUrls?: string[] | null;
  thumbnailUrl?: string | null;
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
  const limit = filters.limit ?? filters.perPage ?? 24;
  const page = Math.max(filters.page ?? 1, 1);
  const cursorOffset = Number(filters.cursor);
  const offset =
    filters.cursor && Number.isInteger(cursorOffset) && cursorOffset >= 0
      ? cursorOffset
      : (page - 1) * limit;

  return {
    q: filters.search?.trim() || undefined,
    city: filters.city?.trim() || undefined,
    stateOrProvince: filters.stateOrProvince?.trim() || undefined,
    postalCode: filters.postalCode?.trim() || undefined,
    priceMin: filters.minPrice,
    priceMax: filters.maxPrice,
    bedsMin: filters.minBedrooms,
    bathsMin: filters.minBathrooms,
    status: filters.status?.trim() || undefined,
    propertyType: filters.propertyType?.trim() || undefined,
    limit,
    offset,
  };
}

function normalizeSearchResponse(
  raw: RawListingSearchResponse,
  requestedLimit: number,
): ListingSearchResponse {
  const items = Array.isArray(raw.items)
    ? raw.items.map((item) => normalizeListingData(item))
    : [];
  const limit = raw.limit ?? requestedLimit;
  const offset = raw.offset ?? 0;
  const total = raw.totalCount ?? items.length;

  return {
    data: items,
    meta: {
      total,
      page: Math.floor(offset / Math.max(limit, 1)) + 1,
      perPage: limit,
      totalPages: total > 0 ? Math.ceil(total / Math.max(limit, 1)) : 0,
    },
    nextCursor: raw.hasMore ? String(offset + limit) : null,
  };
}

function combinedAddress(input: AddressLookupInput) {
  return [input.address, input.city, input.stateOrProvince, input.postalCode]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(", ");
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
 * GET /api/v1/listings/by-address
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
  const res = await getClient().get<AddressResolveResponse>(
    "/api/v1/listings/by-address",
    { params: { address: combinedAddress(input) } },
  );
  return res.data;
}

/**
 * GET /api/v1/listings/address-candidates
 * Return address candidates for disambiguation.
 */
export async function getAddressCandidates(
  input: AddressLookupInput & { limit?: number },
): Promise<AddressCandidatesResponse> {
  const res = await getClient().get<RawAddressCandidatesResponse>(
    "/api/v1/listings/address-candidates",
    { params: { address: combinedAddress(input) } },
  );
  return {
    data: Array.isArray(res.data.candidates) ? res.data.candidates : [],
  };
}

/**
 * GET /api/v1/listings/search
 * Search listings with structured filters.
 */
export async function searchListings(
  filters: SearchFilters,
): Promise<ListingSearchResponse> {
  const payload = normalizeSearchFilters(filters);
  const res = await getClient().get<RawListingSearchResponse>(
    "/api/v1/listings/search",
    { params: payload },
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
    { keys },
  );
  const map = new Map<string, ListingResponse>();
  for (const item of res.data.results ?? []) {
    if (item.error) continue;
    const normalized = normalizeListingResponse(item);
    const data = normalized.data;
    if (!data.listingKey) continue;
    map.set(data.listingKey, normalized);
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
};
