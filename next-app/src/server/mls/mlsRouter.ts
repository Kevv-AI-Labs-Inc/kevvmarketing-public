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
  livingArea?: number | null;
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

const LDS_URL = ENV.listingDataServiceUrl.replace(/\/+$/, "");
const LDS_KEY = ENV.listingDataServiceApiKey;

function ldsConfigured(): boolean {
  return LDS_URL.length > 0;
}

async function ldsGet<T = unknown>(
  path: string,
  params?: Record<string, string | undefined>
): Promise<T | null> {
  if (!ldsConfigured()) return null;
  const url = new URL(path, LDS_URL);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== "") url.searchParams.set(k, v);
    }
  }
  try {
    const res = await fetch(url.toString(), {
      headers: {
        ...(LDS_KEY ? { "x-api-key": LDS_KEY } : {}),
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      console.error(`[MLS] LDS ${path} responded ${res.status}`);
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    console.error(`[MLS] LDS fetch failed for ${path}:`, err);
    return null;
  }
}

async function ldsPost<T = unknown>(
  path: string,
  body?: Record<string, unknown>
): Promise<T | null> {
  if (!ldsConfigured()) return null;
  const url = new URL(path, LDS_URL);
  try {
    const res = await fetch(url.toString(), {
      method: "POST",
      headers: {
        ...(LDS_KEY ? { "x-api-key": LDS_KEY } : {}),
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) {
      console.error(`[MLS] LDS POST ${path} responded ${res.status}`);
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    console.error(`[MLS] LDS POST failed for ${path}:`, err);
    return null;
  }
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
      const data = await ldsGet<LdsProperty[]>("/api/v1/properties", {
        search: input.search,
        city: input.city,
        minPrice: input.minPrice?.toString(),
        maxPrice: input.maxPrice?.toString(),
        propertyType: input.propertyType,
        status: input.status,
        limit: input.limit.toString(),
        offset: input.offset.toString(),
      });
      return (data ?? []) as LdsProperty[];
    }),

  /**
   * getPropertyById — single property detail with media.
   * Called by: Listings detail dialog, NewListings, Studios
   */
  getPropertyById: protectedProcedure
    .input(z.object({ listingKey: z.string() }))
    .query(async ({ input }) => {
      if (!input.listingKey) return null;
      const data = await ldsGet<LdsProperty>(
        `/api/v1/properties/${encodeURIComponent(input.listingKey)}`
      );
      return data ?? null;
    }),

  /**
   * getPropertiesByKeys — fetch multiple properties by listing keys.
   * Called by: MagicShareStudio
   */
  getPropertiesByKeys: protectedProcedure
    .input(z.object({ listingKeys: z.array(z.string()) }))
    .query(async ({ input }) => {
      if (input.listingKeys.length === 0) return [];
      const data = await ldsPost<LdsProperty[]>("/api/v1/properties/by-keys", {
        listingKeys: input.listingKeys,
      });
      return (data ?? []) as LdsProperty[];
    }),

});
