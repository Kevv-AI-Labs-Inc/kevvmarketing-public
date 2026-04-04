/**
 * MLS Router — proxies property data from the listing-data-service.
 *
 * The marketing-app does not own property/media tables any more.
 * This router fetches data from the external listing-data-service API
 * and exposes it to the frontend via tRPC.
 *
 * When LISTING_DATA_SERVICE_URL is not configured, every endpoint
 * returns safe defaults so the app remains functional (just empty).
 */

import { z } from "zod";
import { protectedProcedure, router } from "../trpc";
import { ENV } from "../_core/env";
import {
  getAddressCandidates,
  getListing,
  getListingByMls,
  getListingsBatch,
  resolveByAddress,
  searchListings,
} from "../clients/listingDataClient";
import type { AddressLookupInput, ListingData } from "../clients/types";
import { ListingDataServiceError } from "../clients/types";

// ─── Helpers ────────────────────────────────────────────────

/**
 * Typed shape of a property returned by listing-data-service.
 * Kept loose (all optional) because the upstream schema is external.
 */
export interface LdsProperty {
  id?: number | string | null;
  listingKey?: string | null;
  listingId?: string | null;
  unparsedAddress?: string | null;
  city?: string | null;
  stateOrProvince?: string | null;
  postalCode?: string | null;
  latitude?: string | number | null;
  longitude?: string | number | null;
  listPrice?: string | null;
  bedrooms?: number | null;
  bedroomsTotal?: number | null;
  bathroomsFull?: number | null;
  bathroomsHalf?: number | null;
  bathroomsTotalInteger?: number | null;
  livingArea?: string | number | null;
  standardStatus?: string | null;
  propertyType?: string | null;
  media?: Array<{ url?: string; mediaURL?: string; id?: number | string; order?: number; type?: string }> | null;
  thumbnailUrl?: string | null;
  daysOnMarket?: number | null;
  mlsStatus?: string | null;
  listDate?: string | null;
  modificationTimestamp?: string | null;
  countyOrParish?: string | null;
  lotSizeArea?: number | null;
  yearBuilt?: number | null;
  publicRemarks?: string | null;
  [key: string]: unknown; // allow extra fields from upstream API
}

function ldsConfigured(): boolean {
  return ENV.listingDataServiceUrl.trim().length > 0;
}

function toLdsProperty(input: Record<string, unknown>): LdsProperty {
  return {
    ...input,
    id:
      typeof input.id === "number" || typeof input.id === "string"
        ? input.id
        : null,
    listingKey:
      typeof input.listingKey === "string" ? input.listingKey : null,
    listingId:
      typeof input.listingId === "string" ? input.listingId : null,
    unparsedAddress:
      typeof input.unparsedAddress === "string" ? input.unparsedAddress : null,
    city: typeof input.city === "string" ? input.city : null,
    stateOrProvince:
      typeof input.stateOrProvince === "string" ? input.stateOrProvince : null,
    postalCode:
      typeof input.postalCode === "string" ? input.postalCode : null,
    latitude:
      typeof input.latitude === "string" || typeof input.latitude === "number"
        ? input.latitude
        : null,
    longitude:
      typeof input.longitude === "string" || typeof input.longitude === "number"
        ? input.longitude
        : null,
    listPrice:
      typeof input.listPrice === "string" ? input.listPrice : null,
    bedroomsTotal:
      typeof input.bedroomsTotal === "number" ? input.bedroomsTotal : null,
    bathroomsTotalInteger:
      typeof input.bathroomsTotalInteger === "number"
        ? input.bathroomsTotalInteger
        : null,
    livingArea:
      typeof input.livingArea === "string" || typeof input.livingArea === "number"
        ? input.livingArea
        : null,
    propertyType:
      typeof input.propertyType === "string" ? input.propertyType : null,
    standardStatus:
      typeof input.standardStatus === "string" ? input.standardStatus : null,
    publicRemarks:
      typeof input.publicRemarks === "string" ? input.publicRemarks : null,
    thumbnailUrl:
      typeof input.thumbnailUrl === "string" ? input.thumbnailUrl : null,
    daysOnMarket:
      typeof input.daysOnMarket === "number" ? input.daysOnMarket : null,
    mlsStatus:
      typeof input.mlsStatus === "string" ? input.mlsStatus : null,
    modificationTimestamp:
      typeof input.modificationTimestamp === "string"
        ? input.modificationTimestamp
        : null,
    countyOrParish:
      typeof input.countyOrParish === "string" ? input.countyOrParish : null,
    lotSizeArea:
      typeof input.lotSizeArea === "number" ? input.lotSizeArea : null,
    yearBuilt:
      typeof input.yearBuilt === "number" ? input.yearBuilt : null,
  };
}

function normalizeText(value?: string | null) {
  return value?.trim().toLowerCase() ?? "";
}

function isLikelyMlsLookup(query: string) {
  const trimmed = query.trim();
  if (!trimmed) return false;
  if (/^\d{5,}$/.test(trimmed)) return true;
  if (/^KEY\d+$/i.test(trimmed)) return true;
  return /^[A-Z0-9-]{5,30}$/i.test(trimmed) && !/\s/.test(trimmed);
}

function parseAddressQuery(query: string): AddressLookupInput {
  const parts = query
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  const address = parts[0] ?? query.trim();
  const city = parts.length >= 2 ? parts[1] : undefined;
  const stateZip = parts.length >= 3 ? parts[2] : undefined;
  const match = stateZip?.match(/^([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?)$/);

  return {
    address,
    city,
    stateOrProvince: match?.[1] ?? stateZip,
    postalCode: match?.[2],
  };
}

function matchesFilters(
  listing: ListingData,
  input: {
    city?: string;
    minPrice?: number;
    maxPrice?: number;
    propertyType?: string;
    status?: string;
  },
) {
  if (input.status && normalizeText(listing.standardStatus) !== normalizeText(input.status)) {
    return false;
  }

  if (input.city && normalizeText(listing.city) !== normalizeText(input.city)) {
    return false;
  }

  if (input.propertyType && normalizeText(listing.propertyType) !== normalizeText(input.propertyType)) {
    return false;
  }

  const price = Number(listing.listPrice);
  if (Number.isFinite(price)) {
    if (typeof input.minPrice === "number" && price < input.minPrice) return false;
    if (typeof input.maxPrice === "number" && price > input.maxPrice) return false;
  }

  return true;
}

async function resolveSearchFallback(input: {
  search?: string;
  city?: string;
  minPrice?: number;
  maxPrice?: number;
  propertyType?: string;
  status?: string;
}): Promise<LdsProperty[]> {
  const query = input.search?.trim();
  if (!query) return [];

  const collected = new Map<string, LdsProperty>();

  const addIfMatch = (listing: ListingData) => {
    if (!listing.listingKey || !matchesFilters(listing, input)) return;
    if (collected.has(listing.listingKey)) return;
    collected.set(
      listing.listingKey,
      toLdsProperty(listing as unknown as Record<string, unknown>),
    );
  };

  if (isLikelyMlsLookup(query)) {
    try {
      const exact = await getListingByMls(query);
      addIfMatch(exact.data);
    } catch {
      if (/^KEY/i.test(query)) {
        try {
          const exactByKey = await getListing(query);
          addIfMatch(exactByKey.data);
        } catch {
          // ignore exact-by-key fallback failures
        }
      }
    }
  }

  if (collected.size > 0) {
    return Array.from(collected.values());
  }

  const parsedAddress = parseAddressQuery(query);

  try {
    const resolved = await resolveByAddress(parsedAddress);
    addIfMatch(resolved.property);
  } catch (error) {
    if (
      error instanceof ListingDataServiceError &&
      (error.statusCode === 404 || error.statusCode === 409)
    ) {
      try {
        const candidates = await getAddressCandidates({ ...parsedAddress, limit: 5 });
        for (const candidate of candidates.data ?? []) {
          try {
            if (candidate.listingKey) {
              const hydrated = await getListing(candidate.listingKey);
              addIfMatch(hydrated.data);
            } else if (candidate.listingId) {
              const hydrated = await getListingByMls(candidate.listingId);
              addIfMatch(hydrated.data);
            }
          } catch {
            // ignore candidate hydration failures and continue
          }

          if (collected.size > 0) break;
        }
      } catch {
        // ignore address candidate lookup failures
      }
    } else {
      console.warn("[MLS] resolveByAddress fallback failed:", error);
    }
  }

  return Array.from(collected.values());
}

// ─── Router ─────────────────────────────────────────────────

export const mlsRouter = router({
  /**
   * getProperties — paginated property search.
   * Called by: Listings, NewListings, CMAStudio, SmartMatch, Studios, MagicShareStudio
   */
  getProperties: protectedProcedure
    .input(
      z.object({
        search: z.string().optional(),
        city: z.string().optional(),
        minPrice: z.number().optional(),
        maxPrice: z.number().optional(),
        propertyType: z.string().optional(),
        status: z.string().optional(),
        limit: z.number().min(1).max(100).optional().default(24),
        offset: z.number().min(0).optional().default(0),
      })
    )
    .query(async ({ input }) => {
      if (!ldsConfigured()) return [] as LdsProperty[];
      try {
        const data = await searchListings({
          search: input.search,
          city: input.city,
          minPrice: input.minPrice,
          maxPrice: input.maxPrice,
          propertyType: input.propertyType,
          status: input.status,
          perPage: input.limit,
        });
        const results = data.data.map((item) =>
          toLdsProperty(item as unknown as Record<string, unknown>),
        );
        if (results.length > 0 || !input.search?.trim()) {
          return results;
        }

        return await resolveSearchFallback(input);
      } catch (error) {
        console.error("[MLS] getProperties failed:", error);
        return [] as LdsProperty[];
      }
    }),

  /**
   * getPropertyById — single property detail with media.
   * Called by: Listings detail dialog, NewListings, Studios
   */
  getPropertyById: protectedProcedure
    .input(z.object({ listingKey: z.string() }))
    .query(async ({ input }) => {
      if (!input.listingKey) return null;
      if (!ldsConfigured()) return null;
      try {
        const data = await getListing(input.listingKey);
        return toLdsProperty({
          ...data.data,
          media: data.media,
          imageUrls: data.imageUrls,
          thumbnailUrl: data.thumbnailUrl ?? data.imageUrls[0] ?? null,
        });
      } catch (error) {
        console.error("[MLS] getPropertyById failed:", error);
        return null;
      }
    }),

  /**
   * getPropertiesByKeys — fetch multiple properties by listing keys.
   * Called by: MagicShareStudio
   */
  getPropertiesByKeys: protectedProcedure
    .input(z.object({ listingKeys: z.array(z.string()) }))
    .query(async ({ input }) => {
      if (input.listingKeys.length === 0) return [];
      if (!ldsConfigured()) return [] as LdsProperty[];
      try {
        const data = await getListingsBatch(input.listingKeys);
        return input.listingKeys
          .map((listingKey) => {
            const item = data.get(listingKey);
            if (!item?.data) return null;
            return toLdsProperty({
              ...item.data,
              thumbnailUrl: item.thumbnailUrl ?? item.imageUrls?.[0] ?? null,
            });
          })
          .filter((item): item is LdsProperty => item !== null);
      } catch (error) {
        console.error("[MLS] getPropertiesByKeys failed:", error);
        return [] as LdsProperty[];
      }
    }),

});
