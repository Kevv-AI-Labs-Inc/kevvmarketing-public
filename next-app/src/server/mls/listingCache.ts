/**
 * Server-side Listing Cache
 *
 * Wraps BBO listing-data-service calls with Next.js `unstable_cache`
 * so that listing pages can be rendered via ISR (Incremental Static
 * Regeneration) instead of hitting BBO on every request.
 *
 * Cache strategy:
 *  - New listings feed: revalidate every 5 minutes (300s)
 *  - Search results:    revalidate every 10 minutes (600s)
 *  - Single listing:    revalidate every 30 minutes (1800s)
 *
 * This reduces BBO API calls from 1-per-pageview to 1-per-revalidation
 * interval, cutting API cost and latency to near zero for cached hits.
 */

import { unstable_cache } from "next/cache";
import { searchListings, getListing } from "@/server/clients/listingDataClient";
import type {
  ListingData,
  ListingSearchResponse,
  ListingResponse,
  SearchFilters,
} from "@/server/clients/types";

// ─── New Listings Feed ─────────────────────────────────────────

export type NewListingItem = {
  listingKey: string;
  listingId: string;
  unparsedAddress: string;
  city: string;
  stateOrProvince: string;
  postalCode: string;
  listPrice: string;
  propertyType: string;
  standardStatus: string;
  bedroomsTotal: number | null;
  bathroomsTotalInteger: number | null;
  livingArea: string;
  daysOnMarket: number | null;
  modificationTimestamp: string | null;
  thumbnailUrl: string | null;
  latitude: string;
  longitude: string;
};

/**
 * Slim down a full ListingData to only the fields the card grid needs.
 * This keeps the serialized ISR payload small.
 */
function toNewListingItem(row: ListingData): NewListingItem {
  return {
    listingKey: row.listingKey,
    listingId: row.listingId,
    unparsedAddress: row.unparsedAddress,
    city: row.city,
    stateOrProvince: row.stateOrProvince,
    postalCode: row.postalCode,
    listPrice: row.listPrice,
    propertyType: row.propertyType,
    standardStatus: row.standardStatus,
    bedroomsTotal: row.bedroomsTotal,
    bathroomsTotalInteger: row.bathroomsTotalInteger,
    livingArea: row.livingArea,
    daysOnMarket: row.daysOnMarket ?? null,
    modificationTimestamp: (row as unknown as Record<string, unknown>).modificationTimestamp as string | null ?? null,
    thumbnailUrl: (row as unknown as Record<string, unknown>).thumbnailUrl as string | null ?? null,
    latitude: row.latitude,
    longitude: row.longitude,
  };
}

/**
 * Fetch active listings from BBO, cached for 5 minutes.
 * Used by the New Listings page (RSC).
 */
export const getCachedNewListings = unstable_cache(
  async (limit = 60): Promise<NewListingItem[]> => {
    try {
      const response: ListingSearchResponse = await searchListings({
        status: "Active",
        perPage: Math.min(limit, 100),
        page: 1,
      });
      return (response.data ?? []).map(toNewListingItem);
    } catch (error) {
      console.error("[listingCache] getCachedNewListings failed:", error);
      return [];
    }
  },
  ["new-listings-feed"],
  { revalidate: 300, tags: ["new-listings"] }
);

// ─── Search Results ────────────────────────────────────────────

export type ListingSearchResult = {
  items: NewListingItem[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
};

/**
 * Search listings with structured filters, cached for 10 minutes.
 * Cache key includes all filter params so different searches
 * don't collide.
 */
export const getCachedListingSearch = unstable_cache(
  async (filters: SearchFilters): Promise<ListingSearchResult> => {
    try {
      const response = await searchListings(filters);
      return {
        items: (response.data ?? []).map(toNewListingItem),
        total: response.meta?.total ?? 0,
        page: response.meta?.page ?? 1,
        perPage: response.meta?.perPage ?? 24,
        totalPages: response.meta?.totalPages ?? 1,
      };
    } catch (error) {
      console.error("[listingCache] getCachedListingSearch failed:", error);
      return { items: [], total: 0, page: 1, perPage: 24, totalPages: 0 };
    }
  },
  ["listing-search"],
  { revalidate: 600, tags: ["listing-search"] }
);

// ─── Single Listing Detail ─────────────────────────────────────

export type CachedListingDetail = {
  data: ListingData;
  media: Array<{ mediaKey: string; mediaURL: string; mediaType: string; order: number }>;
  imageUrls: string[];
  source: string;
} | null;

/**
 * Fetch a single listing with media, cached for 30 minutes.
 * Used by listing detail modals / pages.
 */
export const getCachedListingDetail = unstable_cache(
  async (listingKey: string): Promise<CachedListingDetail> => {
    try {
      const response: ListingResponse = await getListing(listingKey);
      return {
        data: response.data,
        media: response.media ?? [],
        imageUrls: response.imageUrls ?? [],
        source: response.source,
      };
    } catch (error) {
      console.error("[listingCache] getCachedListingDetail failed:", error);
      return null;
    }
  },
  ["listing-detail"],
  { revalidate: 1800, tags: ["listing-detail"] }
);
