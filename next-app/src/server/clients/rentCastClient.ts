/**
 * RentCast API Client — property valuation + comparable sales data.
 *
 * Endpoints used:
 *   GET /v1/avm/value    — Automated Valuation Model (sale price estimate + comps)
 *   GET /v1/properties   — Property details lookup by address
 *
 * Auth: API key via X-Api-Key header.
 * Free tier: 50 calls/month.
 * Docs: https://developers.rentcast.io/reference
 */

import axios, { AxiosInstance, AxiosError } from "axios";
import { ENV } from "../_core/env";

// ─── Types ────────────────────────────────────────────────────

export interface RentCastProperty {
  id?: string;
  formattedAddress?: string;
  addressLine1?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  county?: string;
  latitude?: number;
  longitude?: number;
  propertyType?: string;
  bedrooms?: number;
  bathrooms?: number;
  squareFootage?: number;
  lotSize?: number;
  yearBuilt?: number;
  lastSaleDate?: string;
  lastSalePrice?: number;
  features?: Record<string, unknown>;
}

export interface RentCastComparable {
  id?: string;
  formattedAddress?: string;
  addressLine1?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  latitude?: number;
  longitude?: number;
  squareFootage?: number;
  bedrooms?: number;
  bathrooms?: number;
  yearBuilt?: number;
  propertyType?: string;
  lastSaleDate?: string;
  lastSalePrice?: number;
  price?: number;
  listedDate?: string;
  daysOnMarket?: number;
  distance?: number;
  correlation?: number;
}

export interface RentCastAvmResponse {
  price?: number;
  priceRangeLow?: number;
  priceRangeHigh?: number;
  pricePerSquareFoot?: number;
  listPrice?: number;
  lastSalePrice?: number;
  lastSaleDate?: string;
  comparables?: RentCastComparable[];
  propertyDetails?: RentCastProperty;
}

export class RentCastError extends Error {
  constructor(
    public statusCode: number,
    public errorCode: string,
    message: string,
  ) {
    super(message);
    this.name = "RentCastError";
  }
}

// ─── Client Singleton ─────────────────────────────────────────

let _client: AxiosInstance | null = null;

function getClient(): AxiosInstance {
  if (_client) return _client;

  const apiKey = ENV.rentcastApiKey;
  if (!apiKey) {
    throw new RentCastError(
      500,
      "not_configured",
      "RENTCAST_API_KEY is not configured.",
    );
  }

  _client = axios.create({
    baseURL: "https://api.rentcast.io",
    timeout: 15_000,
    headers: {
      Accept: "application/json",
      "X-Api-Key": apiKey,
    },
  });

  _client.interceptors.response.use(
    (response) => response,
    (error: AxiosError) => {
      if (error.response) {
        const { status, data } = error.response;
        const msg =
          typeof data === "object" && data !== null && "message" in data
            ? String((data as Record<string, unknown>).message)
            : error.message;
        throw new RentCastError(status, `http_${status}`, msg);
      }
      throw new RentCastError(
        502,
        "service_unreachable",
        `RentCast unreachable: ${error.message}`,
      );
    },
  );

  return _client;
}

// ─── Public API ───────────────────────────────────────────────

/**
 * Check if RentCast is configured (API key present).
 */
export function isRentCastConfigured(): boolean {
  return ENV.rentcastApiKey.trim().length > 0;
}

/**
 * GET /v1/avm/value — Automated Valuation Model.
 *
 * Returns estimated sale price + comparable sales for an address.
 * This is the primary endpoint for CMA enrichment.
 *
 * @param address - Full street address (e.g. "123 Main St, Irvine, CA 92618")
 * @param compCount - Number of comparable sales to return (1-25, default 5)
 */
export async function getPropertyValuation(
  address: string,
  compCount = 5,
): Promise<RentCastAvmResponse> {
  const res = await getClient().get<RentCastAvmResponse>("/v1/avm/value", {
    params: {
      address,
      compCount: Math.min(Math.max(compCount, 1), 25),
    },
  });
  return res.data;
}

/**
 * GET /v1/properties — Property details lookup.
 *
 * Returns detailed property data for an address (beds, baths, sqft, yearBuilt, etc.)
 * Useful for auto-filling subject property details when not in MLS.
 *
 * @param address - Full street address
 */
export async function getPropertyDetails(
  address: string,
): Promise<RentCastProperty | null> {
  try {
    const res = await getClient().get<RentCastProperty[]>("/v1/properties", {
      params: { address, limit: 1 },
    });
    const items = Array.isArray(res.data) ? res.data : [];
    return items[0] ?? null;
  } catch (err) {
    if (err instanceof RentCastError && err.statusCode === 404) {
      return null;
    }
    throw err;
  }
}

// ─── Namespace export ─────────────────────────────────────────

export const rentCastClient = {
  isConfigured: isRentCastConfigured,
  getPropertyValuation,
  getPropertyDetails,
};
