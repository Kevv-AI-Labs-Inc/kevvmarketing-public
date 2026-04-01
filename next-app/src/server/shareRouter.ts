import { randomBytes } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import {
  agentProfiles,
  homeValueLinks,
  shareLeads,
  shareSessionEvents,
  shareSessions,
  users,
} from "../drizzle/schema";
// TODO: properties and media data will come from listing-data-service API
// import { properties, media } from "../drizzle/schema";
import {
  analyzeRoute,
  geocodeAddress,
  resolveRouteProvider,
  type EtaProvider,
  type RouteStopInput,
} from "./mapProviders";
import { recordUsage, type ApiKeyContext, validateApiKey } from "./apiKeyAuth";
import { ENV } from "./_core/env";
import { getDb } from "./db";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { triggerLeadAutomation } from "./leads/leadAutomationService";
import { captureLead } from "./leads/leadCaptureService";
import { generateAreaMagnetReport } from "./share/areaMagnetService";
import { recalculateScore } from "./tracking/engagementScorer";
// TODO: image URLs will come from listing-data-service API

type Database = NonNullable<Awaited<ReturnType<typeof getDb>>>;

type ListingPreview = {
  listingKey: string;
  listingId: string | null;
  unparsedAddress: string | null;
  city: string | null;
  stateOrProvince: string | null;
  postalCode: string | null;
  latitude: string | null;
  longitude: string | null;
  listPrice: string | null;
  propertyType: string | null;
  bedroomsTotal: number | null;
  bathroomsTotalInteger: number | null;
  livingArea: string | null;
  publicRemarks: string | null;
  standardStatus: string | null;
};

type TourConfig = {
  enabled: boolean;
  startTime?: string;
  slotMinutes: number;
  travelMinutes: number;
  orderingMode: "auto_nearest" | "manual";
  etaProvider: EtaProvider;
  optimizeWaypointOrder: boolean;
};

const agentBrandingSchema = z
  .object({
    agentName: z.string().trim().min(1).max(120).optional(),
    agentTitle: z.string().trim().max(120).optional(),
    brokerageName: z.string().trim().max(160).optional(),
    phone: z.string().trim().max(50).optional(),
    email: z.string().trim().email().optional(),
    wechatId: z.string().trim().max(100).optional(),
    avatarUrl: z.string().trim().max(1000).optional(),
    companyLogoUrl: z.string().trim().max(1000).optional(),
    accentColor: z.string().trim().max(20).optional(),
  })
  .default({});

const tourConfigSchema = z.object({
  enabled: z.boolean().default(true),
  startTime: z.string().trim().optional(),
  slotMinutes: z.number().int().min(20).max(180).default(45),
  travelMinutes: z.number().int().min(0).max(90).default(15),
  orderingMode: z.enum(["auto_nearest", "manual"]).default("auto_nearest"),
  etaProvider: z.enum(["google", "none"]).optional(),
  optimizeWaypointOrder: z.boolean().default(false),
});

const externalListingSchema = z.object({
  id: z.string().trim().min(1).max(64),
  url: z.string().trim().max(2000),
  address: z.string().trim().min(1).max(500),
  title: z.string().trim().max(255).optional(),
  price: z.string().trim().max(50).optional(),
  beds: z.number().int().min(0).max(50).optional(),
  baths: z.number().min(0).max(50).optional(),
  sqft: z.string().trim().max(50).optional(),
  source: z.string().trim().max(50).optional(),
  notes: z.string().trim().max(1000).optional(),
});

const shareConfigSchema = z.object({
  strategyPoints: z.array(z.string().trim().min(1).max(200)).max(10).optional(),
});

const shareSessionTypeSchema = z.enum(["listing_share", "area_magnet"]);
const areaMagnetScopeTypeSchema = z.enum(["zip", "neighborhood", "building"]);
const areaMagnetTypeSchema = z.enum([
  "spring_market",
  "school_move_up",
  "off_market_brief",
  "renovation_roi",
]);
const areaMagnetAudienceSchema = z.enum(["seller", "buyer", "investor", "move_up"]);
const areaMagnetToneSchema = z.enum(["advisory", "urgent", "luxury"]);
const captureFieldSchema = z.enum(["email", "phone"]);

const createAreaMagnetInputSchema = z.object({
  scopeType: areaMagnetScopeTypeSchema,
  query: z.string().trim().min(2).max(120),
  magnetType: areaMagnetTypeSchema,
  audience: areaMagnetAudienceSchema,
  captureFields: z.array(captureFieldSchema).min(1).max(2).default(["email"]),
  tone: areaMagnetToneSchema.default("advisory"),
  expiresInDays: z.number().int().min(1).max(90).optional(),
  agentBranding: agentBrandingSchema,
});

const submitLeadInputSchema = z
  .object({
    token: z.string().trim().min(8).max(128),
    name: z.string().trim().max(255).optional(),
    email: z.string().trim().max(320).optional(),
    phone: z.string().trim().max(64).optional(),
    intent: z.string().trim().max(120).optional(),
    notes: z.string().trim().max(1000).optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.email && !value.phone) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Email or phone is required.",
        path: ["email"],
      });
    }

    if (value.email && !z.string().email().safeParse(value.email).success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Email is invalid.",
        path: ["email"],
      });
    }
  });

type ExternalListingInput = z.infer<typeof externalListingSchema>;

const createSessionInputSchema = z.object({
  title: z.string().trim().min(1).max(255),
  introMessage: z.string().trim().max(3000).optional(),
  clientName: z.string().trim().max(255).optional(),
  shareConfig: shareConfigSchema.optional(),
  listingKeys: z.array(z.string().trim().min(1)).max(30),
  externalListings: z.array(externalListingSchema).max(15).optional(),
  expiresInDays: z.number().int().min(1).max(90).optional(),
  agentBranding: agentBrandingSchema,
  tour: tourConfigSchema.optional(),
});

const buyerTourInputSchema = z.object({
  listingKeys: z.array(z.string().trim().min(1)).min(1).max(30),
  tour: tourConfigSchema.optional(),
});

let ensureShareTablesPromise: Promise<void> | null = null;

const apiKeyProcedure = publicProcedure.use(async ({ ctx, next }) => {
  const authHeader = ctx.headers?.get?.("authorization") ?? undefined;
  const apiKeyCtx = await validateApiKey(authHeader);

  if (!apiKeyCtx) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Invalid or missing API key. Use Authorization: Bearer bbo_sk_xxx",
    });
  }

  return next({ ctx: { ...ctx, apiKey: apiKeyCtx } });
});

function requireApiKey(ctx: { apiKey?: ApiKeyContext }): ApiKeyContext {
  if (!ctx.apiKey) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Invalid or missing API key. Use Authorization: Bearer bbo_sk_xxx",
    });
  }
  return ctx.apiKey;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function toNumber(value: string | number | null | undefined): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function normalizeOptionalString(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
    Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) *
    Math.sin(dLng / 2);

  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getHeaderValue(
  headers: Headers | Record<string, unknown>,
  name: string
): string | null {
  if (typeof (headers as Headers).get === "function") {
    const value = (headers as Headers).get(name);
    return value && value.trim().length > 0 ? value.trim() : null;
  }

  const record = headers as Record<string, unknown>;
  const direct = record[name] ?? record[name.toLowerCase()];
  if (Array.isArray(direct)) {
    const first = direct[0];
    return typeof first === "string" && first.trim().length > 0
      ? first.trim()
      : null;
  }
  return typeof direct === "string" && direct.trim().length > 0
    ? direct.trim()
    : null;
}

function inferOrigin(headers: Headers | Record<string, unknown>): string | null {
  const forwardedHost = getHeaderValue(headers, "x-forwarded-host");
  const host = getHeaderValue(headers, "host");
  const forwardedProto = getHeaderValue(headers, "x-forwarded-proto");

  const hostValue = forwardedHost?.split(",")[0]?.trim() || host;
  if (!hostValue) return null;

  const protoValue =
    forwardedProto?.split(",")[0]?.trim() ||
    (hostValue.includes("localhost") ? "http" : "https");

  return `${protoValue}://${hostValue}`;
}

function normalizeTourConfig(input?: z.infer<typeof tourConfigSchema>): TourConfig {
  const defaultEtaProvider: EtaProvider =
    ENV.mapRouteProvider === "none" ? "none" : "google";

  return {
    enabled: input?.enabled ?? true,
    startTime: input?.startTime,
    slotMinutes: input?.slotMinutes ?? 45,
    travelMinutes: input?.travelMinutes ?? 15,
    orderingMode: input?.orderingMode ?? "auto_nearest",
    etaProvider: input?.etaProvider ?? defaultEtaProvider,
    optimizeWaypointOrder: input?.optimizeWaypointOrder ?? false,
  };
}

function normalizeAccentColor(value: string | undefined): string {
  if (!value) return "#1F5A4A";
  const trimmed = value.trim();
  if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(trimmed)) {
    return trimmed;
  }
  return "#1F5A4A";
}

function normalizeBranding(
  branding: z.infer<typeof agentBrandingSchema>,
  defaults: {
    name: string;
    title: string;
    email?: string | null;
  }
) {
  return {
    agentName: branding.agentName?.trim() || defaults.name,
    agentTitle: branding.agentTitle?.trim() || defaults.title,
    brokerageName: branding.brokerageName?.trim() || "",
    phone: branding.phone?.trim() || "",
    email: branding.email?.trim() || defaults.email || "",
    wechatId: branding.wechatId?.trim() || "",
    avatarUrl: branding.avatarUrl?.trim() || "",
    companyLogoUrl: branding.companyLogoUrl?.trim() || "",
    accentColor: normalizeAccentColor(branding.accentColor),
  };
}

function buildApiOwnerId(apiKey: ApiKeyContext, actorId?: string): string {
  const company = apiKey.companyId !== null ? String(apiKey.companyId) : "global";
  const actor = actorId?.trim() || "system";
  return `api:${company}:${actor}`;
}

function buildTourPlan(listings: ListingPreview[], config: TourConfig, externalListings?: ExternalListingInput[]) {
  const slotMinutes = config.slotMinutes;
  const travelMinutes = config.travelMinutes;

  const parsedStart = config.startTime ? new Date(config.startTime) : new Date();
  const startTime = Number.isNaN(parsedStart.getTime()) ? new Date() : parsedStart;

  // Convert external listings to ListingPreview-compatible format for unified processing
  const externalAsListings: ListingPreview[] = (externalListings ?? []).map((ext) => ({
    listingKey: `ext_${ext.id}`,
    listingId: null,
    unparsedAddress: ext.address,
    city: null,
    stateOrProvince: null,
    postalCode: null,
    latitude: null,
    longitude: null,
    listPrice: ext.price ?? null,
    propertyType: null,
    bedroomsTotal: ext.beds ?? null,
    bathroomsTotalInteger: ext.baths !== undefined ? Math.floor(ext.baths) : null,
    livingArea: ext.sqft ?? null,
    publicRemarks: null,
    standardStatus: null,
  }));

  const allListings = [...listings, ...externalAsListings];

  let orderedListings: ListingPreview[];
  if (config.orderingMode === "manual") {
    orderedListings = [...allListings];
  } else {
    const withCoords: Array<
      ListingPreview & {
        latitudeValue: number;
        longitudeValue: number;
      }
    > = [];
    const withoutCoords: ListingPreview[] = [];

    for (const listing of allListings) {
      const lat = toNumber(listing.latitude);
      const lng = toNumber(listing.longitude);
      if (lat === null || lng === null) {
        withoutCoords.push(listing);
        continue;
      }

      withCoords.push({
        ...listing,
        latitudeValue: lat,
        longitudeValue: lng,
      });
    }

    const orderedWithCoords: Array<(typeof withCoords)[number]> = [];
    if (withCoords.length > 0) {
      let seedIndex = 0;
      let seedPrice = -Infinity;

      for (let i = 0; i < withCoords.length; i += 1) {
        const price = toNumber(withCoords[i].listPrice);
        if (price !== null && price > seedPrice) {
          seedPrice = price;
          seedIndex = i;
        }
      }

      const remaining = [...withCoords];
      orderedWithCoords.push(remaining.splice(seedIndex, 1)[0]);

      while (remaining.length > 0) {
        const last = orderedWithCoords[orderedWithCoords.length - 1];
        let bestIndex = 0;
        let bestDistance = Number.POSITIVE_INFINITY;

        for (let i = 0; i < remaining.length; i += 1) {
          const current = remaining[i];
          const distance = haversineKm(
            last.latitudeValue,
            last.longitudeValue,
            current.latitudeValue,
            current.longitudeValue
          );

          if (distance < bestDistance) {
            bestDistance = distance;
            bestIndex = i;
          }
        }

        orderedWithCoords.push(remaining.splice(bestIndex, 1)[0]);
      }
    }

    orderedListings = [...orderedWithCoords, ...withoutCoords];
  }

  const stops = [] as Array<{
    order: number;
    listingKey: string;
    listingId: string | null;
    address: string | null;
    city: string | null;
    stateOrProvince: string | null;
    postalCode: string | null;
    latitude: string | null;
    longitude: string | null;
    startAt: string;
    endAt: string;
    isExternal?: boolean;
  }>;

  let currentStart = new Date(startTime);
  for (let i = 0; i < orderedListings.length; i += 1) {
    const listing = orderedListings[i];
    const endAt = new Date(currentStart.getTime() + slotMinutes * 60_000);

    stops.push({
      order: i + 1,
      listingKey: listing.listingKey,
      listingId: listing.listingId,
      address: listing.unparsedAddress,
      city: listing.city,
      stateOrProvince: listing.stateOrProvince,
      postalCode: listing.postalCode,
      latitude: listing.latitude,
      longitude: listing.longitude,
      startAt: currentStart.toISOString(),
      endAt: endAt.toISOString(),
      isExternal: listing.listingKey.startsWith("ext_"),
    });

    currentStart = new Date(endAt.getTime() + travelMinutes * 60_000);
  }

  const totalDurationMinutes =
    orderedListings.length > 0
      ? orderedListings.length * slotMinutes +
      Math.max(orderedListings.length - 1, 0) * travelMinutes
      : 0;

  return {
    generatedAt: new Date().toISOString(),
    startTime: startTime.toISOString(),
    slotMinutes,
    travelMinutes,
    orderingMode: config.orderingMode,
    etaProvider: config.etaProvider,
    optimizeWaypointOrder: config.optimizeWaypointOrder,
    totalStops: orderedListings.length,
    totalDurationMinutes,
    stops,
  };
}

function formatDistanceMeters(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0 km";
  if (value < 1000) return `${Math.round(value)} m`;
  return `${(value / 1000).toFixed(1)} km`;
}

function formatDurationSeconds(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0 min";
  const minutes = Math.max(1, Math.round(value / 60));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours <= 0) return `${minutes} min`;
  if (rest === 0) return `${hours}h`;
  return `${hours}h ${rest}m`;
}

function parseEtaProvider(value: unknown, fallback: EtaProvider): EtaProvider {
  // Backward compatibility: migrate legacy "azure/mapbox" tour plans to Google.
  if (value === "google" || value === "azure" || value === "mapbox") return "google";
  if (value === "none") return "none";
  return fallback;
}

function parseOptimizeWaypointOrder(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  return fallback;
}

function getOrderedListingKeysFromTourPlan(
  tourPlan: Record<string, unknown> | null,
  fallbackKeys: string[]
): string[] {
  if (!tourPlan) return fallbackKeys;
  const rawStops = tourPlan.stops;
  if (!Array.isArray(rawStops)) return fallbackKeys;

  const sorted = rawStops
    .filter((item) => item && typeof item === "object")
    .map((item) => {
      const source = item as Record<string, unknown>;
      const listingKey =
        typeof source.listingKey === "string" ? source.listingKey.trim() : "";
      const orderNumber =
        typeof source.order === "number" && Number.isFinite(source.order)
          ? source.order
          : Number.MAX_SAFE_INTEGER;
      return { listingKey, orderNumber };
    })
    .filter((item) => item.listingKey.length > 0)
    .sort((a, b) => a.orderNumber - b.orderNumber)
    .map((item) => item.listingKey);

  if (sorted.length === 0) return fallbackKeys;

  const seen = new Set<string>();
  const merged: string[] = [];
  for (const key of sorted) {
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(key);
  }
  for (const key of fallbackKeys) {
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(key);
  }

  return merged;
}

type RouteStopCandidate = {
  listingKey: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
};

function buildGeocodeAddress(listing: ListingPreview): string | null {
  const segments = [
    listing.unparsedAddress,
    listing.city,
    listing.stateOrProvince,
    listing.postalCode,
  ]
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  if (segments.length === 0) return null;
  return segments.join(", ");
}

function buildRouteStopCandidates(
  listings: ListingPreview[],
  orderedListingKeys: string[]
): RouteStopCandidate[] {
  const byKey = new Map(listings.map((item) => [item.listingKey, item]));
  const routeStops: RouteStopCandidate[] = [];
  const seen = new Set<string>();

  const append = (listingKey: string) => {
    if (seen.has(listingKey)) return;
    seen.add(listingKey);

    const listing = byKey.get(listingKey);
    if (!listing) return;

    routeStops.push({
      listingKey: listing.listingKey,
      address: buildGeocodeAddress(listing),
      latitude: toNumber(listing.latitude),
      longitude: toNumber(listing.longitude),
    });
  };

  orderedListingKeys.forEach(append);
  listings.forEach((item) => append(item.listingKey));
  return routeStops;
}

async function resolveRouteStopsForAnalysis(params: {
  db: Database;
  listings: ListingPreview[];
  orderedListingKeys: string[];
  provider: "google";
}) {
  const candidates = buildRouteStopCandidates(params.listings, params.orderedListingKeys);
  const resolvedCoords = new Map<string, { latitude: number; longitude: number }>();

  for (const candidate of candidates) {
    if (candidate.latitude === null || candidate.longitude === null) continue;
    resolvedCoords.set(candidate.listingKey, {
      latitude: candidate.latitude,
      longitude: candidate.longitude,
    });
  }

  const missingCandidates = candidates.filter(
    (candidate) =>
      !resolvedCoords.has(candidate.listingKey) &&
      typeof candidate.address === "string" &&
      candidate.address.trim().length > 0
  );

  const geocodedUpdates: Array<{
    listingKey: string;
    latitude: number;
    longitude: number;
  }> = [];
  let geocodeAttemptedCount = 0;
  let geocodeFailedCount = 0;

  const batchSize = 4;
  for (let i = 0; i < missingCandidates.length; i += batchSize) {
    const batch = missingCandidates.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(async (candidate) => {
        geocodeAttemptedCount += 1;
        try {
          const geocoded = await geocodeAddress({
            provider: params.provider,
            address: candidate.address as string,
          });
          return {
            listingKey: candidate.listingKey,
            latitude: geocoded.latitude,
            longitude: geocoded.longitude,
          };
        } catch (error) {
          geocodeFailedCount += 1;
          console.warn(
            `[RouteAnalysis] Failed to geocode listing ${candidate.listingKey}:`,
            error
          );
          return null;
        }
      })
    );

    for (const result of batchResults) {
      if (!result) continue;
      resolvedCoords.set(result.listingKey, {
        latitude: result.latitude,
        longitude: result.longitude,
      });
      geocodedUpdates.push(result);
    }
  }

  // TODO: properties table moved to listing-data-service.
  // Geocoded coordinates should be persisted via listing-data-service API.
  if (geocodedUpdates.length > 0) {
    console.log(`[RouteAnalysis] Geocoded ${geocodedUpdates.length} listings (persist via listing-data-service API pending).`);
  }

  const routeStops: RouteStopInput[] = candidates.flatMap((candidate) => {
    const coords = resolvedCoords.get(candidate.listingKey);
    if (!coords) return [];
    return [
      {
        listingKey: candidate.listingKey,
        address: candidate.address,
        latitude: coords.latitude,
        longitude: coords.longitude,
      },
    ];
  });

  return {
    routeStops,
    geocodedFromAddressCount: geocodedUpdates.length,
    unresolvedCoordinateCount: Math.max(candidates.length - routeStops.length, 0),
    geocodeAttemptedCount,
    geocodeFailedCount,
  };
}

async function buildRouteAnalysisPayload(params: {
  db: Database;
  listings: ListingPreview[];
  orderedListingKeys: string[];
  etaProvider: EtaProvider;
  optimizeWaypointOrder: boolean;
}) {
  let resolvedProvider: "google" | null = null;
  if (params.etaProvider !== "none") {
    try {
      resolvedProvider = resolveRouteProvider(params.etaProvider);
    } catch (error) {
      return {
        status: "error" as const,
        provider: null,
        message:
          error instanceof Error
            ? error.message
            : "Google route provider is not configured for route analysis.",
        stopCount: 0,
        optimizedOrderKeys: [] as string[],
        usedOptimization: false,
        optimizeWaypointOrder: params.optimizeWaypointOrder,
        totalDistanceMeters: 0,
        totalDistanceText: "0 km",
        totalDurationSeconds: 0,
        totalDurationText: "0 min",
        totalDurationInTrafficSeconds: null as number | null,
        totalDurationInTrafficText: null as string | null,
        geocodedFromAddressCount: 0,
        unresolvedCoordinateCount: 0,
        geocodeAttemptedCount: 0,
        geocodeFailedCount: 0,
        stops: [] as Array<{
          listingKey: string;
          address: string | null;
          lat: number;
          lng: number;
        }>,
        legs: [] as Array<{
          fromKey: string;
          toKey: string;
          fromAddress: string | null;
          toAddress: string | null;
          distanceMeters: number;
          distanceText: string;
          durationSeconds: number;
          durationText: string;
          durationInTrafficSeconds: number | null;
          durationInTrafficText: string | null;
        }>,
        path: [] as Array<{ lat: number; lng: number }>,
      };
    }
  }

  const routeResolution =
    resolvedProvider === null
      ? {
        routeStops: [] as RouteStopInput[],
        geocodedFromAddressCount: 0,
        unresolvedCoordinateCount: 0,
        geocodeAttemptedCount: 0,
        geocodeFailedCount: 0,
      }
      : await resolveRouteStopsForAnalysis({
        db: params.db,
        listings: params.listings,
        orderedListingKeys: params.orderedListingKeys,
        provider: resolvedProvider,
      });

  const routeStops = routeResolution.routeStops;
  const identityOrderKeys = routeStops.map((item) => item.listingKey);
  const base = {
    stopCount: routeStops.length,
    optimizedOrderKeys: identityOrderKeys,
    usedOptimization: false,
    optimizeWaypointOrder: params.optimizeWaypointOrder,
    totalDistanceMeters: 0,
    totalDistanceText: "0 km",
    totalDurationSeconds: 0,
    totalDurationText: "0 min",
    totalDurationInTrafficSeconds: null as number | null,
    totalDurationInTrafficText: null as string | null,
    geocodedFromAddressCount: routeResolution.geocodedFromAddressCount,
    unresolvedCoordinateCount: routeResolution.unresolvedCoordinateCount,
    geocodeAttemptedCount: routeResolution.geocodeAttemptedCount,
    geocodeFailedCount: routeResolution.geocodeFailedCount,
    stops: routeStops.map((stop) => ({
      listingKey: stop.listingKey,
      address: stop.address,
      lat: stop.latitude,
      lng: stop.longitude,
    })),
    legs: [] as Array<{
      fromKey: string;
      toKey: string;
      fromAddress: string | null;
      toAddress: string | null;
      distanceMeters: number;
      distanceText: string;
      durationSeconds: number;
      durationText: string;
      durationInTrafficSeconds: number | null;
      durationInTrafficText: string | null;
    }>,
    path: [] as Array<{ lat: number; lng: number }>,
  };

  if (params.etaProvider === "none") {
    return {
      status: "disabled" as const,
      provider: null,
      message: "Route ETA provider is disabled for this share session.",
      ...base,
    };
  }

  if (routeStops.length < 2) {
    const geocodeHint =
      routeResolution.geocodeAttemptedCount > 0 &&
        routeResolution.geocodeFailedCount === routeResolution.geocodeAttemptedCount
        ? " Geocoding failed for all missing coordinates. Check server map API key permissions."
        : "";
    return {
      status: "error" as const,
      provider: null,
      message:
        `Not enough coordinate-ready listings to compute route analysis (requires at least 2, ready ${routeStops.length}, unresolved ${routeResolution.unresolvedCoordinateCount}).${geocodeHint}`,
      ...base,
    };
  }

  try {
    const result = await analyzeRoute({
      provider: resolvedProvider ?? params.etaProvider,
      stops: routeStops,
      optimizeWaypointOrder: params.optimizeWaypointOrder,
      departureTime: new Date(),
    });

    const optimizedOrderKeys = result.optimizedOrder
      .map((index) => routeStops[index]?.listingKey)
      .filter((item): item is string => typeof item === "string");

    const legs = result.legs.map((leg) => {
      const from = routeStops[leg.fromStopIndex];
      const to = routeStops[leg.toStopIndex];
      return {
        fromKey: from?.listingKey ?? "",
        toKey: to?.listingKey ?? "",
        fromAddress: from?.address ?? null,
        toAddress: to?.address ?? null,
        distanceMeters: leg.distanceMeters,
        distanceText: leg.distanceText,
        durationSeconds: leg.durationSeconds,
        durationText: leg.durationText,
        durationInTrafficSeconds: leg.durationInTrafficSeconds,
        durationInTrafficText: leg.durationInTrafficText,
      };
    });

    const totalDurationInTrafficText =
      result.totalDurationInTrafficSeconds !== null
        ? formatDurationSeconds(result.totalDurationInTrafficSeconds)
        : null;

    return {
      status: "ready" as const,
      provider: result.provider,
      message: null,
      ...base,
      stopCount: routeStops.length,
      optimizedOrderKeys:
        optimizedOrderKeys.length === routeStops.length
          ? optimizedOrderKeys
          : identityOrderKeys,
      usedOptimization: result.usedOptimization,
      totalDistanceMeters: result.totalDistanceMeters,
      totalDistanceText: formatDistanceMeters(result.totalDistanceMeters),
      totalDurationSeconds: result.totalDurationSeconds,
      totalDurationText: formatDurationSeconds(result.totalDurationSeconds),
      totalDurationInTrafficSeconds: result.totalDurationInTrafficSeconds,
      totalDurationInTrafficText,
      legs,
      path: result.path.map((point) => ({
        lat: point.latitude,
        lng: point.longitude,
      })),
    };
  } catch (error) {
    return {
      status: "error" as const,
      provider: null,
      message:
        error instanceof Error
          ? error.message
          : "Route analysis failed unexpectedly.",
      ...base,
    };
  }
}

async function ensureShareTables(db: Database): Promise<void> {
  if (!ensureShareTablesPromise) {
    ensureShareTablesPromise = (async () => {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "share_sessions" (
          "id" serial PRIMARY KEY NOT NULL,
          "token" varchar(64) NOT NULL,
          "status" varchar(20) DEFAULT 'active' NOT NULL,
          "session_type" varchar(32) DEFAULT 'listing_share' NOT NULL,
          "title" varchar(255),
          "intro_message" text,
          "client_name" varchar(255),
          "created_by_open_id" varchar(64) NOT NULL,
          "created_by_company_id" integer,
          "created_by_api_key_id" integer,
          "created_by_name" varchar(255),
          "created_by_email" varchar(320),
          "agent_branding" jsonb NOT NULL,
          "share_config" jsonb,
          "magnet_scope" jsonb,
          "magnet_payload" jsonb,
          "listing_keys" jsonb NOT NULL,
          "tour_plan" jsonb,
          "external_listings" jsonb,
          "wechat_share_config" jsonb,
          "expires_at" timestamp,
          "view_count" integer DEFAULT 0 NOT NULL,
          "last_viewed_at" timestamp,
          "created_at" timestamp DEFAULT now() NOT NULL,
          "updated_at" timestamp DEFAULT now() NOT NULL
        );
      `);

      await db.execute(sql`ALTER TABLE "share_sessions" ADD COLUMN IF NOT EXISTS "created_by_company_id" integer;`);
      await db.execute(sql`ALTER TABLE "share_sessions" ADD COLUMN IF NOT EXISTS "created_by_api_key_id" integer;`);
      await db.execute(sql`ALTER TABLE "share_sessions" ADD COLUMN IF NOT EXISTS "share_config" jsonb;`);
      await db.execute(sql`ALTER TABLE "share_sessions" ADD COLUMN IF NOT EXISTS "session_type" varchar(32) DEFAULT 'listing_share';`);
      await db.execute(sql`ALTER TABLE "share_sessions" ADD COLUMN IF NOT EXISTS "magnet_scope" jsonb;`);
      await db.execute(sql`ALTER TABLE "share_sessions" ADD COLUMN IF NOT EXISTS "magnet_payload" jsonb;`);
      await db.execute(sql`ALTER TABLE "share_sessions" ADD COLUMN IF NOT EXISTS "external_listings" jsonb;`);
      await db.execute(sql`ALTER TABLE "share_sessions" ADD COLUMN IF NOT EXISTS "wechat_share_config" jsonb;`);

      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "share_session_events" (
          "id" serial PRIMARY KEY NOT NULL,
          "share_session_id" integer NOT NULL,
          "event_type" varchar(50) NOT NULL,
          "event_data" jsonb,
          "created_at" timestamp DEFAULT now() NOT NULL
        );
      `);

      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "share_leads" (
          "id" serial PRIMARY KEY NOT NULL,
          "share_session_id" integer NOT NULL,
          "name" varchar(255),
          "email" varchar(320),
          "phone" varchar(64),
          "intent" varchar(120),
          "notes" text,
          "created_at" timestamp DEFAULT now() NOT NULL
        );
      `);

      await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS "share_sessions_token_unique" ON "share_sessions" ("token");`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS "share_sessions_creator_idx" ON "share_sessions" ("created_by_open_id", "created_at" DESC);`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS "share_sessions_company_idx" ON "share_sessions" ("created_by_company_id", "created_at" DESC);`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS "share_sessions_api_key_idx" ON "share_sessions" ("created_by_api_key_id", "created_at" DESC);`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS "share_session_events_session_idx" ON "share_session_events" ("share_session_id", "created_at" DESC);`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS "share_leads_session_idx" ON "share_leads" ("share_session_id", "created_at" DESC);`);
    })().catch((error) => {
      ensureShareTablesPromise = null;
      throw error;
    });
  }

  await ensureShareTablesPromise;
}

async function getListingsByKeys(
  _db: Database,
  listingKeys: string[]
): Promise<ListingPreview[]> {
  if (listingKeys.length === 0) return [];

  // Fetch from listing-data-service API instead of direct DB query
  const { getListingsBatch } = await import("./clients/listingDataClient");
  const listingsMap = await getListingsBatch(listingKeys);
  const ordered: ListingPreview[] = [];

  for (const key of listingKeys) {
    const response = listingsMap.get(key);
    if (response?.data) {
      const d = response.data;
      ordered.push({
        listingKey: d.listingKey ?? key,
        listingId: d.listingId ?? null,
        unparsedAddress: d.unparsedAddress ?? null,
        city: d.city ?? null,
        stateOrProvince: d.stateOrProvince ?? null,
        postalCode: d.postalCode ?? null,
        latitude: d.latitude ?? null,
        longitude: d.longitude ?? null,
        listPrice: d.listPrice ?? null,
        propertyType: d.propertyType ?? null,
        bedroomsTotal: d.bedroomsTotal ?? null,
        bathroomsTotalInteger: d.bathroomsTotalInteger ?? null,
        livingArea: d.livingArea ?? null,
        publicRemarks: d.publicRemarks ?? null,
        standardStatus: d.standardStatus ?? null,
      });
    }
  }

  return ordered;
}

async function getListingMediaMap(_db: Database, listingKeys: string[]) {
  if (listingKeys.length === 0) {
    return new Map<string, string[]>();
  }

  // Fetch media from listing-data-service API instead of direct DB query
  const { getListingMedia } = await import("./clients/listingDataClient");
  const byKey = new Map<string, string[]>();

  await Promise.allSettled(
    listingKeys.map(async (key) => {
      try {
        const response = await getListingMedia(key);
        const urls = response.data
          ?.map((item: { mediaURL?: string }) => item.mediaURL)
          .filter((url: unknown): url is string => typeof url === "string" && url.length > 0)
          ?? [];
        if (urls.length > 0) byKey.set(key, urls);
      } catch {
        // Media not available for this listing
      }
    })
  );

  return byKey;
}

async function generateUniqueToken(db: Database): Promise<string> {
  for (let i = 0; i < 8; i += 1) {
    const token = randomBytes(18).toString("base64url");
    const existing = await db
      .select({ id: shareSessions.id })
      .from(shareSessions)
      .where(eq(shareSessions.token, token))
      .limit(1);

    if (existing.length === 0) {
      return token;
    }
  }

  throw new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: "Unable to create a unique share token.",
  });
}

type SessionListRow = {
  id: number;
  token: string;
  status: string;
  sessionType: string;
  title: string | null;
  clientName: string | null;
  listingKeys: unknown;
  magnetScope: unknown;
  tourPlan: unknown;
  viewCount: number;
  lastViewedAt: Date | null;
  createdAt: Date;
  expiresAt: Date | null;
};

type SessionActivitySummary = {
  totalEvents: number;
  listingOpenCount: number;
  contactClickCount: number;
  wechatCopyCount: number;
  tourInterestCount: number;
  routeRequestCount: number;
  leadCount: number;
  lastActivityAt: Date | null;
  followUpSignal: "new" | "warm" | "hot" | "quiet";
};

function deriveFollowUpSignal(
  row: SessionListRow,
  summary: Omit<SessionActivitySummary, "followUpSignal">
): SessionActivitySummary["followUpSignal"] {
  const now = Date.now();
  const hoursSinceCreated = (now - row.createdAt.getTime()) / 36e5;
  const lastActivityAt = summary.lastActivityAt ?? row.lastViewedAt ?? row.createdAt;
  const hoursSinceActivity = (now - lastActivityAt.getTime()) / 36e5;

  if (
    summary.leadCount > 0 ||
    summary.contactClickCount > 0 ||
    summary.tourInterestCount > 0 ||
    summary.routeRequestCount > 0
  ) {
    return "hot";
  }

  if (row.viewCount >= 4 || summary.listingOpenCount >= 3 || summary.wechatCopyCount > 0) {
    return "warm";
  }

  if (hoursSinceCreated <= 24 && row.viewCount <= 1 && summary.totalEvents <= 1) {
    return "new";
  }

  if (hoursSinceActivity <= 24 && (row.viewCount > 0 || summary.totalEvents > 0)) {
    return "warm";
  }

  return "quiet";
}

function getScopeLabel(magnetScope: unknown) {
  const record = asRecord(magnetScope);
  const label = record?.normalizedLabel;
  const query = record?.query;
  if (typeof label === "string" && label.trim().length > 0) return label.trim();
  if (typeof query === "string" && query.trim().length > 0) return query.trim();
  return null;
}

async function buildSessionActivityMap(db: Database, rows: SessionListRow[]) {
  const bySession = new Map<number, SessionActivitySummary>();
  if (rows.length === 0) return bySession;

  for (const row of rows) {
    const base = {
      totalEvents: 0,
      listingOpenCount: 0,
      contactClickCount: 0,
      wechatCopyCount: 0,
      tourInterestCount: 0,
      routeRequestCount: 0,
      leadCount: 0,
      lastActivityAt: row.lastViewedAt ?? row.createdAt,
    };

    bySession.set(row.id, {
      ...base,
      followUpSignal: deriveFollowUpSignal(row, base),
    });
  }

  const leadRows = await db
    .select({
      shareSessionId: shareLeads.shareSessionId,
      leadCount: sql<number>`count(*)`,
      lastLeadAt: sql<Date | null>`max(${shareLeads.createdAt})`,
    })
    .from(shareLeads)
    .where(inArray(shareLeads.shareSessionId, rows.map((row) => row.id)))
    .groupBy(shareLeads.shareSessionId);

  for (const lead of leadRows) {
    const current = bySession.get(lead.shareSessionId);
    if (!current) continue;
    current.leadCount = Number(lead.leadCount) || 0;
    if (lead.lastLeadAt && (!current.lastActivityAt || lead.lastLeadAt.getTime() > current.lastActivityAt.getTime())) {
      current.lastActivityAt = lead.lastLeadAt;
    }
  }

  const eventRows = await db
    .select({
      shareSessionId: shareSessionEvents.shareSessionId,
      eventType: shareSessionEvents.eventType,
      createdAt: shareSessionEvents.createdAt,
    })
    .from(shareSessionEvents)
    .where(inArray(shareSessionEvents.shareSessionId, rows.map((row) => row.id)))
    .orderBy(desc(shareSessionEvents.createdAt));

  for (const event of eventRows) {
    const current = bySession.get(event.shareSessionId);
    if (!current) continue;

    current.totalEvents += 1;

    switch (event.eventType) {
      case "listing_open":
        current.listingOpenCount += 1;
        break;
      case "contact_click":
        current.contactClickCount += 1;
        break;
      case "wechat_copy":
        current.wechatCopyCount += 1;
        break;
      case "tour_interest":
        current.tourInterestCount += 1;
        break;
      case "route_request":
        current.routeRequestCount += 1;
        break;
      default:
        break;
    }

    if (!current.lastActivityAt || event.createdAt.getTime() > current.lastActivityAt.getTime()) {
      current.lastActivityAt = event.createdAt;
    }
  }

  for (const row of rows) {
    const current = bySession.get(row.id);
    if (!current) continue;
    current.followUpSignal = deriveFollowUpSignal(row, current);
  }

  return bySession;
}

function serializeSessionRow(
  row: SessionListRow,
  summary?: SessionActivitySummary
) {
  const keys = asStringArray(row.listingKeys);
  const tourRecord = asRecord(row.tourPlan);
  const tourStops = Array.isArray(tourRecord?.stops)
    ? tourRecord.stops.length
    : 0;
  const leadCount = summary?.leadCount ?? 0;

  return {
    token: row.token,
    sharePath: `/s/${row.token}`,
    status: row.status,
    sessionType: row.sessionType,
    title: row.title,
    clientName: row.clientName,
    scopeLabel: getScopeLabel(row.magnetScope),
    listingCount: keys.length,
    tourStops,
    viewCount: row.viewCount,
    leadCount,
    lastViewedAt: row.lastViewedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt?.toISOString() ?? null,
    lastActivityAt: summary?.lastActivityAt?.toISOString() ?? row.lastViewedAt?.toISOString() ?? null,
    followUpSignal: summary?.followUpSignal ?? (Date.now() - row.createdAt.getTime() <= 24 * 60 * 60 * 1000 ? "new" : "quiet"),
    eventCounts: {
      total: summary?.totalEvents ?? 0,
      listingOpen: summary?.listingOpenCount ?? 0,
      contactClick: summary?.contactClickCount ?? 0,
      wechatCopy: summary?.wechatCopyCount ?? 0,
      tourInterest: summary?.tourInterestCount ?? 0,
      routeRequest: summary?.routeRequestCount ?? 0,
      leadSubmit: leadCount,
    },
  };
}

export const shareRouter = router({
  createSession: protectedProcedure
    .input(createSessionInputSchema)
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database not available",
        });
      }

      await ensureShareTables(db);

      const listingKeys = Array.from(
        new Set(
          input.listingKeys.map((key) => key.trim()).filter((key) => key.length > 0)
        )
      );

      const externalListings = input.externalListings ?? [];

      const listings = await getListingsByKeys(db, listingKeys);
      if (listings.length === 0 && externalListings.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No valid listing keys or external listings were provided.",
        });
      }

      const validListingKeys = listings.map((item) => item.listingKey);
      const missingListingKeys = listingKeys.filter(
        (key) => !validListingKeys.includes(key)
      );

      const tourConfig = normalizeTourConfig(input.tour);
      const tourPlan = tourConfig.enabled
        ? buildTourPlan(listings, tourConfig, externalListings)
        : null;

      const token = await generateUniqueToken(db);
      const now = new Date();
      const expiresAt =
        input.expiresInDays !== undefined
          ? new Date(now.getTime() + input.expiresInDays * 24 * 60 * 60 * 1000)
          : null;

      const normalizedBranding = normalizeBranding(input.agentBranding, {
        name: ctx.user.name || "Agent",
        title: "Real Estate Advisor",
        email: ctx.user.email,
      });

      await db.insert(shareSessions).values({
        token,
        status: "active",
        sessionType: "listing_share",
        title: input.title.trim(),
        introMessage: input.introMessage?.trim() || null,
        clientName: input.clientName?.trim() || null,
        createdByOpenId: ctx.user.openId,
        createdByCompanyId: null,
        createdByApiKeyId: null,
        createdByName: ctx.user.name ?? null,
        createdByEmail: ctx.user.email ?? null,
        agentBranding: normalizedBranding,
        shareConfig: input.shareConfig ?? null,
        magnetScope: null,
        magnetPayload: null,
        listingKeys: validListingKeys,
        tourPlan,
        expiresAt,
        createdAt: now,
        updatedAt: now,
        ...(externalListings.length > 0 ? { externalListings } : {}),
      });

      const origin = inferOrigin(ctx.headers);
      const sharePath = `/s/${token}`;

      return {
        token,
        sharePath,
        shareUrl: origin ? `${origin}${sharePath}` : null,
        missingListingKeys,
        listingCount: validListingKeys.length,
        externalListingCount: externalListings.length,
        tourPlan,
      };
    }),

  createAreaMagnet: protectedProcedure
    .input(createAreaMagnetInputSchema)
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database not available",
        });
      }

      await ensureShareTables(db);

      let generated: Awaited<ReturnType<typeof generateAreaMagnetReport>>;
      try {
        generated = await generateAreaMagnetReport(input);
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            error instanceof Error
              ? error.message
              : "Area magnet generation failed.",
        });
      }

      const token = await generateUniqueToken(db);
      const now = new Date();
      const expiresAt =
        input.expiresInDays !== undefined
          ? new Date(now.getTime() + input.expiresInDays * 24 * 60 * 60 * 1000)
          : null;

      const normalizedBranding = normalizeBranding(input.agentBranding, {
        name: ctx.user.name || "Agent",
        title: "Local Market Advisor",
        email: ctx.user.email,
      });

      await db.insert(shareSessions).values({
        token,
        status: "active",
        sessionType: "area_magnet",
        title: generated.title,
        introMessage: generated.introMessage,
        clientName: null,
        createdByOpenId: ctx.user.openId,
        createdByCompanyId: null,
        createdByApiKeyId: null,
        createdByName: ctx.user.name ?? null,
        createdByEmail: ctx.user.email ?? null,
        agentBranding: normalizedBranding,
        shareConfig: generated.shareConfig,
        magnetScope: generated.magnetScope,
        magnetPayload: generated.magnetPayload,
        listingKeys: generated.listingKeys,
        tourPlan: null,
        expiresAt,
        createdAt: now,
        updatedAt: now,
      });

      const origin = inferOrigin(ctx.headers);
      const sharePath = `/s/${token}`;
      const payloadRecord = asRecord(generated.magnetPayload);

      return {
        token,
        sharePath,
        shareUrl: origin ? `${origin}${sharePath}` : null,
        sessionType: "area_magnet",
        title: generated.title,
        scopeLabel: generated.magnetScope.normalizedLabel,
        listingCount: generated.listingKeys.length,
        generatedBy: generated.generatedBy,
        preview: {
          summary: generated.introMessage,
          strategyPoints: generated.strategyPoints,
          metrics: Array.isArray(payloadRecord?.metrics) ? payloadRecord.metrics : [],
        },
      };
    }),

  listMine: protectedProcedure
    .input(z.object({ sessionType: shareSessionTypeSchema.optional() }).optional())
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database not available",
        });
      }

      await ensureShareTables(db);

      const conditions = [eq(shareSessions.createdByOpenId, ctx.user.openId)];
      if (input?.sessionType) {
        conditions.push(eq(shareSessions.sessionType, input.sessionType));
      }
      const predicate = conditions.length === 1 ? conditions[0] : and(...conditions);

      const rows = await db
        .select({
          id: shareSessions.id,
          token: shareSessions.token,
          status: shareSessions.status,
          sessionType: shareSessions.sessionType,
          title: shareSessions.title,
          clientName: shareSessions.clientName,
          listingKeys: shareSessions.listingKeys,
          magnetScope: shareSessions.magnetScope,
          tourPlan: shareSessions.tourPlan,
          viewCount: shareSessions.viewCount,
          lastViewedAt: shareSessions.lastViewedAt,
          createdAt: shareSessions.createdAt,
          expiresAt: shareSessions.expiresAt,
        })
        .from(shareSessions)
        .where(predicate)
        .orderBy(desc(shareSessions.createdAt))
        .limit(100);

      const activityBySession = await buildSessionActivityMap(db, rows);
      return rows.map((row) => serializeSessionRow(row, activityBySession.get(row.id)));
    }),

  /**
   * Unified share center — merges:
   *  1. shareSessions (listing_share, area_magnet)
   *  2. homeValueLinks
   *  3. agent public profile (as a permanent "share")
   */
  listUnified: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Database not available",
      });
    }

    await ensureShareTables(db);

    type UnifiedShareItem = {
      id: string;
      shareType: "listing_share" | "area_magnet" | "home_value" | "agent_site";
      title: string;
      description: string;
      sharePath: string;
      status: string;
      ogImageUrl: string | null;
      viewCount: number;
      leadCount: number;
      createdAt: string;
      expiresAt: string | null;
      lastActivityAt: string | null;
      followUpSignal: string;
      clientName: string | null;
      eventCounts: {
        total: number;
        listingOpen: number;
        contactClick: number;
        wechatCopy: number;
        tourInterest: number;
        routeRequest: number;
        leadSubmit: number;
      };
      listingCount: number;
    };

    const items: UnifiedShareItem[] = [];

    // ── 1. shareSessions (listing_share + area_magnet) ──
    const shareRows = await db
      .select({
        id: shareSessions.id,
        token: shareSessions.token,
        status: shareSessions.status,
        sessionType: shareSessions.sessionType,
        title: shareSessions.title,
        clientName: shareSessions.clientName,
        listingKeys: shareSessions.listingKeys,
        magnetScope: shareSessions.magnetScope,
        tourPlan: shareSessions.tourPlan,
        viewCount: shareSessions.viewCount,
        lastViewedAt: shareSessions.lastViewedAt,
        createdAt: shareSessions.createdAt,
        expiresAt: shareSessions.expiresAt,
        agentBranding: shareSessions.agentBranding,
      })
      .from(shareSessions)
      .where(eq(shareSessions.createdByOpenId, ctx.user.openId))
      .orderBy(desc(shareSessions.createdAt))
      .limit(100);

    const activityBySession = await buildSessionActivityMap(db, shareRows);

    for (const row of shareRows) {
      const summary = activityBySession.get(row.id);
      const keys = asStringArray(row.listingKeys);
      const branding = asRecord(row.agentBranding);
      const leadCount = summary?.leadCount ?? 0;

      items.push({
        id: `share_${row.id}`,
        shareType: row.sessionType as "listing_share" | "area_magnet",
        title: row.title || "Untitled Share",
        description: row.clientName
          ? `${row.clientName} · ${keys.length} listings`
          : `${keys.length} listings`,
        sharePath: `/s/${row.token}`,
        status: row.status,
        ogImageUrl: (typeof branding?.avatarUrl === "string" ? branding.avatarUrl : null),
        viewCount: row.viewCount,
        leadCount,
        createdAt: row.createdAt.toISOString(),
        expiresAt: row.expiresAt?.toISOString() ?? null,
        lastActivityAt: summary?.lastActivityAt?.toISOString() ?? row.lastViewedAt?.toISOString() ?? null,
        followUpSignal: summary?.followUpSignal ?? (Date.now() - row.createdAt.getTime() <= 24 * 60 * 60 * 1000 ? "new" : "quiet"),
        clientName: row.clientName,
        eventCounts: {
          total: summary?.totalEvents ?? 0,
          listingOpen: summary?.listingOpenCount ?? 0,
          contactClick: summary?.contactClickCount ?? 0,
          wechatCopy: summary?.wechatCopyCount ?? 0,
          tourInterest: summary?.tourInterestCount ?? 0,
          routeRequest: summary?.routeRequestCount ?? 0,
          leadSubmit: leadCount,
        },
        listingCount: keys.length,
      });
    }

    // ── 2. homeValueLinks ──
    try {
      const hvLinks = await db
        .select()
        .from(homeValueLinks)
        .where(eq(homeValueLinks.userId, ctx.user.id))
        .orderBy(desc(homeValueLinks.createdAt))
        .limit(50);

      for (const link of hvLinks) {
        items.push({
          id: `hv_${link.id}`,
          shareType: "home_value",
          title: link.label || link.ogTitle || "Home Value Link",
          description: link.ogDescription || `Source: ${link.source}`,
          sharePath: `/hv/${link.token}`,
          status: link.status,
          ogImageUrl: link.ogImageUrl ?? null,
          viewCount: link.viewCount,
          leadCount: link.leadCount,
          createdAt: link.createdAt.toISOString(),
          expiresAt: null,
          lastActivityAt: link.updatedAt.toISOString(),
          followUpSignal: link.leadCount > 0 ? "hot" : link.viewCount > 0 ? "warm" : "new",
          clientName: null,
          eventCounts: {
            total: link.viewCount + link.valuationCount + link.leadCount,
            listingOpen: 0,
            contactClick: 0,
            wechatCopy: 0,
            tourInterest: 0,
            routeRequest: 0,
            leadSubmit: link.leadCount,
          },
          listingCount: 0,
        });
      }
    } catch {
      // homeValueLinks table may not exist yet — skip silently
    }

    // ── 3. agentProfile (permanent share) ──
    try {
      const [profile] = await db
        .select({
          id: agentProfiles.id,
          slug: agentProfiles.slug,
          name: agentProfiles.name,
          title: agentProfiles.title,
          photoUrl: agentProfiles.photoUrl,
          status: agentProfiles.status,
          createdAt: agentProfiles.createdAt,
          lastPublishedAt: agentProfiles.lastPublishedAt,
        })
        .from(agentProfiles)
        .where(eq(agentProfiles.userId, ctx.user.id))
        .limit(1);

      if (profile && profile.status === "active") {
        items.push({
          id: `agent_${profile.id}`,
          shareType: "agent_site",
          title: profile.name,
          description: profile.title || "Agent Public Profile",
          sharePath: `/agents/${profile.slug}`,
          status: "active",
          ogImageUrl: profile.photoUrl ?? null,
          viewCount: 0,
          leadCount: 0,
          createdAt: profile.createdAt.toISOString(),
          expiresAt: null,
          lastActivityAt: profile.lastPublishedAt?.toISOString() ?? profile.createdAt.toISOString(),
          followUpSignal: "new",
          clientName: null,
          eventCounts: { total: 0, listingOpen: 0, contactClick: 0, wechatCopy: 0, tourInterest: 0, routeRequest: 0, leadSubmit: 0 },
          listingCount: 0,
        });
      }
    } catch {
      // agent profile may not exist — skip
    }

    // Sort by createdAt desc
    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return items;
  }),

  revokeSession: protectedProcedure
    .input(z.object({ token: z.string().trim().min(8).max(128) }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database not available",
        });
      }

      await ensureShareTables(db);

      const updated = await db
        .update(shareSessions)
        .set({ status: "revoked", updatedAt: new Date() })
        .where(
          and(
            eq(shareSessions.token, input.token),
            eq(shareSessions.createdByOpenId, ctx.user.openId)
          )
        )
        .returning({ id: shareSessions.id });

      if (updated.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Share session not found." });
      }

      return { success: true };
    }),

  generateBuyerTour: protectedProcedure
    .input(buyerTourInputSchema)
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database not available",
        });
      }

      const listingKeys = Array.from(
        new Set(
          input.listingKeys.map((key) => key.trim()).filter((key) => key.length > 0)
        )
      );

      const listings = await getListingsByKeys(db, listingKeys);
      if (listings.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No valid listing keys were found.",
        });
      }

      const tourConfig = normalizeTourConfig(input.tour);
      const tourPlan = buildTourPlan(listings, tourConfig);

      return {
        listingCount: listings.length,
        tourPlan,
      };
    }),

  analyzeBuyerRoute: protectedProcedure
    .input(buyerTourInputSchema)
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database not available",
        });
      }

      const listingKeys = Array.from(
        new Set(
          input.listingKeys.map((key) => key.trim()).filter((key) => key.length > 0)
        )
      );
      const listings = await getListingsByKeys(db, listingKeys);
      if (listings.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No valid listing keys were found.",
        });
      }

      const tourConfig = normalizeTourConfig(input.tour);
      const routeAnalysis = await buildRouteAnalysisPayload({
        db,
        listings,
        orderedListingKeys: listingKeys,
        etaProvider: tourConfig.etaProvider,
        optimizeWaypointOrder: tourConfig.optimizeWaypointOrder,
      });

      return {
        listingCount: listings.length,
        routeAnalysis,
      };
    }),

  apiCreateSession: apiKeyProcedure
    .input(
      createSessionInputSchema.extend({
        actorId: z.string().trim().max(64).optional(),
        kevvUserId: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database not available",
        });
      }

      const apiKey = requireApiKey(ctx);
      const startTime = Date.now();

      try {
        await ensureShareTables(db);

        const listingKeys = Array.from(
          new Set(
            input.listingKeys
              .map((key) => key.trim())
              .filter((key) => key.length > 0)
          )
        );

        const listings = await getListingsByKeys(db, listingKeys);
        if (listings.length === 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "No valid listing keys were found.",
          });
        }

        const validListingKeys = listings.map((item) => item.listingKey);
        const missingListingKeys = listingKeys.filter(
          (key) => !validListingKeys.includes(key)
        );

        const tourConfig = normalizeTourConfig(input.tour);
        const tourPlan = tourConfig.enabled
          ? buildTourPlan(listings, tourConfig)
          : null;

        const token = await generateUniqueToken(db);
        const now = new Date();
        const expiresAt =
          input.expiresInDays !== undefined
            ? new Date(
              now.getTime() + input.expiresInDays * 24 * 60 * 60 * 1000
            )
            : null;

        const normalizedBranding = normalizeBranding(input.agentBranding, {
          name: input.actorId?.trim() || apiKey.label || "API Agent",
          title: "Real Estate Advisor",
        });

        await db.insert(shareSessions).values({
          token,
          status: "active",
          sessionType: "listing_share",
          title: input.title.trim(),
          introMessage: input.introMessage?.trim() || null,
          clientName: input.clientName?.trim() || null,
          createdByOpenId: buildApiOwnerId(apiKey, input.actorId),
          createdByCompanyId: apiKey.companyId ?? null,
          createdByApiKeyId: apiKey.apiKeyId,
          createdByName: normalizedBranding.agentName,
          createdByEmail:
            normalizedBranding.email.length > 0
              ? normalizedBranding.email
              : null,
          agentBranding: normalizedBranding,
          shareConfig: input.shareConfig ?? null,
          magnetScope: null,
          magnetPayload: null,
          listingKeys: validListingKeys,
          tourPlan,
          expiresAt,
          createdAt: now,
          updatedAt: now,
        });

        const origin = inferOrigin(ctx.headers);
        const sharePath = `/s/${token}`;

        await recordUsage({
          apiKeyId: apiKey.apiKeyId,
          companyId: apiKey.companyId ?? undefined,
          kevvUserId: input.kevvUserId,
          endpoint: "share.apiCreateSession",
          responseTimeMs: Date.now() - startTime,
          success: true,
        });

        return {
          token,
          sharePath,
          shareUrl: origin ? `${origin}${sharePath}` : null,
          missingListingKeys,
          listingCount: validListingKeys.length,
          tourPlan,
        };
      } catch (error) {
        await recordUsage({
          apiKeyId: apiKey.apiKeyId,
          companyId: apiKey.companyId ?? undefined,
          kevvUserId: input.kevvUserId,
          endpoint: "share.apiCreateSession",
          responseTimeMs: Date.now() - startTime,
          success: false,
          errorMessage:
            error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    }),

  apiListSessions: apiKeyProcedure
    .input(
      z
        .object({
          limit: z.number().int().min(1).max(200).default(100),
          kevvUserId: z.number().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database not available",
        });
      }

      const apiKey = requireApiKey(ctx);
      const startTime = Date.now();

      try {
        await ensureShareTables(db);
        const scopeCondition =
          apiKey.companyId !== null
            ? eq(shareSessions.createdByCompanyId, apiKey.companyId)
            : eq(shareSessions.createdByApiKeyId, apiKey.apiKeyId);

        const rows = await db
          .select({
            id: shareSessions.id,
            token: shareSessions.token,
            status: shareSessions.status,
            sessionType: shareSessions.sessionType,
            title: shareSessions.title,
            clientName: shareSessions.clientName,
            listingKeys: shareSessions.listingKeys,
            magnetScope: shareSessions.magnetScope,
            tourPlan: shareSessions.tourPlan,
            viewCount: shareSessions.viewCount,
            lastViewedAt: shareSessions.lastViewedAt,
            createdAt: shareSessions.createdAt,
            expiresAt: shareSessions.expiresAt,
          })
          .from(shareSessions)
          .where(scopeCondition)
          .orderBy(desc(shareSessions.createdAt))
          .limit(input?.limit ?? 100);

        const activityBySession = await buildSessionActivityMap(db, rows);

        await recordUsage({
          apiKeyId: apiKey.apiKeyId,
          companyId: apiKey.companyId ?? undefined,
          kevvUserId: input?.kevvUserId,
          endpoint: "share.apiListSessions",
          responseTimeMs: Date.now() - startTime,
          success: true,
        });

        return rows.map((row) => serializeSessionRow(row, activityBySession.get(row.id)));
      } catch (error) {
        await recordUsage({
          apiKeyId: apiKey.apiKeyId,
          companyId: apiKey.companyId ?? undefined,
          kevvUserId: input?.kevvUserId,
          endpoint: "share.apiListSessions",
          responseTimeMs: Date.now() - startTime,
          success: false,
          errorMessage:
            error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    }),

  apiRevokeSession: apiKeyProcedure
    .input(
      z.object({
        token: z.string().trim().min(8).max(128),
        kevvUserId: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database not available",
        });
      }

      const apiKey = requireApiKey(ctx);
      const startTime = Date.now();

      try {
        await ensureShareTables(db);
        const scopeCondition =
          apiKey.companyId !== null
            ? eq(shareSessions.createdByCompanyId, apiKey.companyId)
            : eq(shareSessions.createdByApiKeyId, apiKey.apiKeyId);

        const updated = await db
          .update(shareSessions)
          .set({ status: "revoked", updatedAt: new Date() })
          .where(and(eq(shareSessions.token, input.token), scopeCondition))
          .returning({ id: shareSessions.id });

        if (updated.length === 0) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Share session not found.",
          });
        }

        await recordUsage({
          apiKeyId: apiKey.apiKeyId,
          companyId: apiKey.companyId ?? undefined,
          kevvUserId: input.kevvUserId,
          endpoint: "share.apiRevokeSession",
          responseTimeMs: Date.now() - startTime,
          success: true,
        });

        return { success: true };
      } catch (error) {
        await recordUsage({
          apiKeyId: apiKey.apiKeyId,
          companyId: apiKey.companyId ?? undefined,
          kevvUserId: input.kevvUserId,
          endpoint: "share.apiRevokeSession",
          responseTimeMs: Date.now() - startTime,
          success: false,
          errorMessage:
            error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    }),

  apiGenerateBuyerTour: apiKeyProcedure
    .input(
      buyerTourInputSchema.extend({
        kevvUserId: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database not available",
        });
      }

      const apiKey = requireApiKey(ctx);
      const startTime = Date.now();

      try {
        const listingKeys = Array.from(
          new Set(
            input.listingKeys
              .map((key) => key.trim())
              .filter((key) => key.length > 0)
          )
        );

        const listings = await getListingsByKeys(db, listingKeys);
        if (listings.length === 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "No valid listing keys were found.",
          });
        }

        const tourConfig = normalizeTourConfig(input.tour);
        const tourPlan = buildTourPlan(listings, tourConfig);

        await recordUsage({
          apiKeyId: apiKey.apiKeyId,
          companyId: apiKey.companyId ?? undefined,
          kevvUserId: input.kevvUserId,
          endpoint: "share.apiGenerateBuyerTour",
          responseTimeMs: Date.now() - startTime,
          success: true,
        });

        return {
          listingCount: listings.length,
          tourPlan,
        };
      } catch (error) {
        await recordUsage({
          apiKeyId: apiKey.apiKeyId,
          companyId: apiKey.companyId ?? undefined,
          kevvUserId: input.kevvUserId,
          endpoint: "share.apiGenerateBuyerTour",
          responseTimeMs: Date.now() - startTime,
          success: false,
          errorMessage:
            error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    }),

  apiAnalyzeBuyerRoute: apiKeyProcedure
    .input(
      buyerTourInputSchema.extend({
        kevvUserId: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database not available",
        });
      }

      const apiKey = requireApiKey(ctx);
      const startTime = Date.now();

      try {
        const listingKeys = Array.from(
          new Set(
            input.listingKeys
              .map((key) => key.trim())
              .filter((key) => key.length > 0)
          )
        );
        const listings = await getListingsByKeys(db, listingKeys);
        if (listings.length === 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "No valid listing keys were found.",
          });
        }

        const tourConfig = normalizeTourConfig(input.tour);
        const routeAnalysis = await buildRouteAnalysisPayload({
          db,
          listings,
          orderedListingKeys: listingKeys,
          etaProvider: tourConfig.etaProvider,
          optimizeWaypointOrder: tourConfig.optimizeWaypointOrder,
        });

        await recordUsage({
          apiKeyId: apiKey.apiKeyId,
          companyId: apiKey.companyId ?? undefined,
          kevvUserId: input.kevvUserId,
          endpoint: "share.apiAnalyzeBuyerRoute",
          responseTimeMs: Date.now() - startTime,
          success: true,
        });

        return {
          listingCount: listings.length,
          routeAnalysis,
        };
      } catch (error) {
        await recordUsage({
          apiKeyId: apiKey.apiKeyId,
          companyId: apiKey.companyId ?? undefined,
          kevvUserId: input.kevvUserId,
          endpoint: "share.apiAnalyzeBuyerRoute",
          responseTimeMs: Date.now() - startTime,
          success: false,
          errorMessage:
            error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    }),

  getRouteAnalysis: publicProcedure
    .input(z.object({ token: z.string().trim().min(8).max(128) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database not available",
        });
      }

      await ensureShareTables(db);

      const rows = await db
        .select({
          id: shareSessions.id,
          status: shareSessions.status,
          token: shareSessions.token,
          listingKeys: shareSessions.listingKeys,
          tourPlan: shareSessions.tourPlan,
          expiresAt: shareSessions.expiresAt,
        })
        .from(shareSessions)
        .where(eq(shareSessions.token, input.token))
        .limit(1);

      const session = rows[0];
      if (!session || session.status !== "active") {
        throw new TRPCError({ code: "NOT_FOUND", message: "Share link not found." });
      }

      if (session.expiresAt && session.expiresAt.getTime() <= Date.now()) {
        await db
          .update(shareSessions)
          .set({ status: "expired", updatedAt: new Date() })
          .where(eq(shareSessions.id, session.id));
        throw new TRPCError({ code: "NOT_FOUND", message: "Share link has expired." });
      }

      const listingKeys = asStringArray(session.listingKeys);
      const listings = await getListingsByKeys(db, listingKeys);
      const tourPlanRecord = asRecord(session.tourPlan);

      const defaultEtaProvider: EtaProvider =
        ENV.mapRouteProvider === "none" ? "none" : "google";
      const etaProvider = parseEtaProvider(
        tourPlanRecord?.etaProvider,
        defaultEtaProvider
      );
      const optimizeWaypointOrder = parseOptimizeWaypointOrder(
        tourPlanRecord?.optimizeWaypointOrder,
        false
      );

      const orderedListingKeys = getOrderedListingKeysFromTourPlan(
        tourPlanRecord,
        listingKeys
      );
      const routeAnalysis = await buildRouteAnalysisPayload({
        db,
        listings,
        orderedListingKeys,
        etaProvider,
        optimizeWaypointOrder,
      });

      return {
        token: session.token,
        listingCount: listings.length,
        etaProvider,
        optimizeWaypointOrder,
        routeAnalysis,
      };
    }),

  getSessionByToken: publicProcedure
    .input(z.object({ token: z.string().trim().min(8).max(128) }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database not available",
        });
      }

      await ensureShareTables(db);

      const rows = await db
        .select()
        .from(shareSessions)
        .where(eq(shareSessions.token, input.token))
        .limit(1);

      const session = rows[0];
      if (!session || session.status !== "active") {
        throw new TRPCError({ code: "NOT_FOUND", message: "Share link not found." });
      }

      if (session.expiresAt && session.expiresAt.getTime() <= Date.now()) {
        await db
          .update(shareSessions)
          .set({ status: "expired", updatedAt: new Date() })
          .where(eq(shareSessions.id, session.id));

        throw new TRPCError({ code: "NOT_FOUND", message: "Share link has expired." });
      }

      const listingKeys = asStringArray(session.listingKeys);
      const listings = await getListingsByKeys(db, listingKeys);
      const mediaMap = await getListingMediaMap(db, listingKeys);

      const enrichedListings = listings.map((listing) => ({
        ...listing,
        images: mediaMap.get(listing.listingKey) ?? [],
      }));

      const agentBranding = asRecord(session.agentBranding) ?? {};
      const shareConfig = asRecord(session.shareConfig) ?? {};
      const tourPlan = asRecord(session.tourPlan);
      const externalListings = Array.isArray(session.externalListings)
        ? session.externalListings
        : [];

      await db
        .update(shareSessions)
        .set({
          viewCount: sql`${shareSessions.viewCount} + 1`,
          lastViewedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(shareSessions.id, session.id));

      // Fire-and-forget view event tracking.
      void db.insert(shareSessionEvents).values({
        shareSessionId: session.id,
        eventType: "view",
        eventData: {
          userAgent: ctx.headers.get("user-agent") ?? null,
        },
      });

      return {
        session: {
          token: session.token,
          sessionType: session.sessionType,
          title: session.title,
          introMessage: session.introMessage,
          clientName: session.clientName,
          viewCount: (session.viewCount ?? 0) + 1,
          createdAt: session.createdAt.toISOString(),
          expiresAt: session.expiresAt?.toISOString() ?? null,
        },
        agentBranding,
        shareConfig,
        magnetScope: asRecord(session.magnetScope),
        magnetPayload: asRecord(session.magnetPayload),
        tourPlan,
        externalListings,
        listings: enrichedListings,
      };
    }),

  submitLead: publicProcedure
    .input(submitLeadInputSchema)
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database not available",
        });
      }

      await ensureShareTables(db);

      const rows = await db
        .select({
          id: shareSessions.id,
          token: shareSessions.token,
          title: shareSessions.title,
          status: shareSessions.status,
          expiresAt: shareSessions.expiresAt,
          sessionType: shareSessions.sessionType,
          createdByEmail: shareSessions.createdByEmail,
          magnetPayload: shareSessions.magnetPayload,
        })
        .from(shareSessions)
        .where(eq(shareSessions.token, input.token))
        .limit(1);

      const session = rows[0];
      if (!session || session.status !== "active") {
        throw new TRPCError({ code: "NOT_FOUND", message: "Share link not found." });
      }

      if (session.expiresAt && session.expiresAt.getTime() <= Date.now()) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Share link has expired." });
      }

      if (session.sessionType !== "area_magnet") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Lead capture is only enabled for area magnet sessions.",
        });
      }

      const magnetPayload = asRecord(session.magnetPayload) ?? {};
      const capture = asRecord(magnetPayload.capture) ?? {};
      const captureFields = asStringArray(capture.fields).filter(
        (field): field is "email" | "phone" => field === "email" || field === "phone"
      );
      const requiredFields = captureFields.length > 0 ? captureFields : ["email"];

      const name = normalizeOptionalString(input.name);
      const email = normalizeOptionalString(input.email);
      const phone = normalizeOptionalString(input.phone);
      const intent = normalizeOptionalString(input.intent);
      const notes = normalizeOptionalString(input.notes);

      if (requiredFields.includes("email") && !email) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Email is required." });
      }
      if (requiredFields.includes("phone") && !phone) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Phone is required." });
      }
      if (!email && !phone) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Email or phone is required." });
      }

      await db.insert(shareLeads).values({
        shareSessionId: session.id,
        name,
        email,
        phone,
        intent,
        notes,
      });

      await db.insert(shareSessionEvents).values({
        shareSessionId: session.id,
        eventType: "lead_submit",
        eventData: {
          hasEmail: Boolean(email),
          hasPhone: Boolean(phone),
          intent,
        },
      });

      const [owner] =
        session.createdByEmail
          ? await db
              .select()
              .from(users)
              .where(eq(users.email, session.createdByEmail))
              .limit(1)
          : [];

      const [ownerProfile] =
        owner
          ? await db
              .select()
              .from(agentProfiles)
              .where(eq(agentProfiles.userId, owner.id))
              .limit(1)
          : [];

      if (owner) {
        const unifiedLead = await captureLead(
          {
            agentId: owner.id,
            agentProfileId: ownerProfile?.id ?? undefined,
            source: session.sessionType === "area_magnet" ? "area_magnet" : "magic_share",
            sourceRef: session.token,
            name: name ?? undefined,
            email: email ?? undefined,
            phone: phone ?? undefined,
            intent: intent ?? undefined,
            notes: notes ?? undefined,
            summary: `Lead captured from ${session.sessionType} share session ${session.title ?? session.token}.`,
            score: intent?.toLowerCase().includes("sell") ? "hot" : "warm",
            tags: [session.sessionType === "area_magnet" ? "area-magnet" : "magic-share"],
            eventType: "share_lead_submit",
            eventData: {
              shareSessionId: session.id,
              sessionType: session.sessionType,
            },
            sourceId: String(session.id),
          },
          db
        );

        await triggerLeadAutomation(
          {
            agentId: owner.id,
            contactId: unifiedLead.id,
            source: session.sessionType === "area_magnet" ? "area_magnet" : "magic_share",
            title: `${unifiedLead.name || "New lead"} submitted from a share page`,
            description: `${session.title ?? "Share page"} converted a lead through ${session.sessionType}.`,
            priority: unifiedLead.score === "hot" ? "high" : "medium",
            suggestedAction: "contact_now",
            actionData: {
              shareSessionId: session.id,
            },
          },
          db
        );

        await recalculateScore(unifiedLead.id, owner.id);
      }

      return { success: true };
    }),

  trackEvent: publicProcedure
    .input(
      z.object({
        token: z.string().trim().min(8).max(128),
        eventType: z.string().trim().min(2).max(50),
        eventData: z.record(z.string(), z.any()).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database not available",
        });
      }

      await ensureShareTables(db);

      const rows = await db
        .select({ id: shareSessions.id })
        .from(shareSessions)
        .where(eq(shareSessions.token, input.token))
        .limit(1);

      const session = rows[0];
      if (!session) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Share link not found." });
      }

      await db.insert(shareSessionEvents).values({
        shareSessionId: session.id,
        eventType: input.eventType,
        eventData: input.eventData ?? null,
      });

      return { success: true };
    }),
});
