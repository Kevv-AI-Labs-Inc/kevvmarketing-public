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
import { getListing, getListingsBatch, searchListings } from "../clients/listingDataClient";

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
        return data.data.map((item) =>
          toLdsProperty(item as unknown as Record<string, unknown>),
        );
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
