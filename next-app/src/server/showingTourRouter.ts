/**
 * Showing Tour Router — shareable route planning for property showings.
 *
 * This tool keeps the scope intentionally small:
 * - add listings by MLS / address search in the dashboard
 * - preview an optimized or manual route
 * - generate a shareable client link
 */

import { randomBytes } from "node:crypto";
import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { showingTours, shareSessions } from "../drizzle/schema";
import { analyzeRoute, type RouteAnalysisResult } from "./mapProviders";
import { formatDistance, formatDuration } from "./mapProviders/format";

const routeModeSchema = z.enum(["optimized", "manual"]);

const propertyIdsSchema = z.array(z.string().trim()).min(2).max(10);

const previewRouteInputSchema = z.object({
  propertyIds: propertyIdsSchema,
  routeMode: routeModeSchema.default("optimized"),
});

const createTourInputSchema = previewRouteInputSchema.extend({
  agentName: z.string().trim().max(255).optional(),
  agentEmail: z.string().trim().email().optional(),
  agentPhone: z.string().trim().max(50).optional(),
  agentLogoUrl: z.string().trim().url().optional(),
  clientName: z.string().trim().max(255).optional(),
  clientEmail: z.string().trim().email().optional(),
  tourDate: z.string().trim().optional(),
});

type RouteMode = z.infer<typeof routeModeSchema>;

type TourListing = {
  listingKey: string;
  listingId: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  latitude: number | null;
  longitude: number | null;
  listPrice: string | null;
  propertyType: string | null;
  bedroomsTotal: number | null;
  bathroomsTotalInteger: number | null;
  livingArea: string | null;
  publicRemarks: string | null;
  standardStatus: string | null;
};

type RouteCandidate = {
  listingKey: string;
  address: string | null;
  latitude: number;
  longitude: number;
};

function uniquePropertyIds(keys: string[]) {
  return Array.from(
    new Set(keys.map((key) => key.trim()).filter((key) => key.length > 0))
  );
}

function formatPrice(price: string | null): string {
  if (!price) return "N/A";
  const num = Number(price);
  if (!Number.isFinite(num)) return price;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(num);
}

function toNumberOrNull(value: string | number | null | undefined) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function buildAddress(listing: Pick<TourListing, "address" | "city" | "state" | "postalCode">) {
  if (listing.address?.trim()) return listing.address.trim();
  return [listing.city, listing.state, listing.postalCode]
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .join(", ");
}

function buildRouteCandidates(listings: TourListing[]): RouteCandidate[] {
  return listings
    .map((listing) => {
      const latitude = toNumberOrNull(listing.latitude);
      const longitude = toNumberOrNull(listing.longitude);
      if (latitude === null || longitude === null) return null;
      return {
        listingKey: listing.listingKey,
        address: buildAddress(listing) || null,
        latitude,
        longitude,
      };
    })
    .filter((item): item is RouteCandidate => item !== null);
}

function buildGoogleMapsUrl(stops: RouteCandidate[]) {
  if (stops.length < 2) return null;

  const origin = `${stops[0].latitude},${stops[0].longitude}`;
  const destination = `${stops[stops.length - 1].latitude},${stops[stops.length - 1].longitude}`;
  const url = new URL("https://www.google.com/maps/dir/");
  url.searchParams.set("api", "1");
  url.searchParams.set("origin", origin);
  url.searchParams.set("destination", destination);
  url.searchParams.set("travelmode", "driving");

  const middleStops = stops.slice(1, -1);
  if (middleStops.length > 0) {
    url.searchParams.set(
      "waypoints",
      middleStops
        .map((stop) => `${stop.latitude},${stop.longitude}`)
        .join("|")
    );
  }

  return url.toString();
}

function orderListingsByKeys(listings: TourListing[], orderedKeys: string[]) {
  const byKey = new Map(listings.map((listing) => [listing.listingKey, listing]));
  const seen = new Set<string>();
  const ordered: TourListing[] = [];

  for (const key of orderedKeys) {
    if (seen.has(key)) continue;
    const listing = byKey.get(key);
    if (!listing) continue;
    seen.add(key);
    ordered.push(listing);
  }

  for (const listing of listings) {
    if (seen.has(listing.listingKey)) continue;
    seen.add(listing.listingKey);
    ordered.push(listing);
  }

  return ordered;
}

async function fetchTourListings(propertyIds: string[]) {
  const { getListingMedia, getListingsBatch } = await import("./clients/listingDataClient");

  const normalizedKeys = uniquePropertyIds(propertyIds);
  const listingsMap = await getListingsBatch(normalizedKeys);

  const listings: TourListing[] = [];
  for (const key of normalizedKeys) {
    const response = listingsMap.get(key);
    if (!response?.data) continue;
    const data = response.data;
    listings.push({
      listingKey: data.listingKey ?? key,
      listingId: data.listingId ?? null,
      address: data.unparsedAddress ?? null,
      city: data.city ?? null,
      state: data.stateOrProvince ?? null,
      postalCode: data.postalCode ?? null,
      latitude: toNumberOrNull(data.latitude),
      longitude: toNumberOrNull(data.longitude),
      listPrice: data.listPrice ?? null,
      propertyType: data.propertyType ?? null,
      bedroomsTotal: data.bedroomsTotal ?? null,
      bathroomsTotalInteger: data.bathroomsTotalInteger ?? null,
      livingArea: data.livingArea ?? null,
      publicRemarks: data.publicRemarks ?? null,
      standardStatus: data.standardStatus ?? null,
    });
  }

  if (listings.length < 2) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Only ${listings.length} valid listings found. At least 2 are required.`,
    });
  }

  const missingKeys = normalizedKeys.filter(
    (key) => !listings.some((listing) => listing.listingKey === key)
  );

  const photoMap = new Map<string, string>();
  await Promise.allSettled(
    listings.map(async (listing) => {
      try {
        const media = await getListingMedia(listing.listingKey);
        const firstUrl = media.data?.[0]?.mediaURL;
        if (firstUrl) photoMap.set(listing.listingKey, firstUrl);
      } catch {
        // Media is optional for the route builder.
      }
    })
  );

  return { listings, missingKeys, photoMap };
}

async function buildRoutePayload(listings: TourListing[], routeMode: RouteMode, photoMap: Map<string, string>) {
  const routeCandidates = buildRouteCandidates(listings);
  let routeResult: RouteAnalysisResult | null = null;
  let routeError: string | null = null;

  if (routeCandidates.length >= 2) {
    try {
      routeResult = await analyzeRoute({
        stops: routeCandidates,
        optimizeWaypointOrder: routeMode === "optimized",
      });
    } catch (error) {
      routeError = error instanceof Error ? error.message : String(error);
      console.warn("[ShowingTour] Route analysis failed:", routeError);
    }
  } else {
    routeError = "Not enough listings with coordinates to analyze a route.";
  }

  const orderedCandidates = routeResult
    ? routeResult.optimizedOrder
        .map((index) => routeCandidates[index] ?? null)
        .filter((candidate): candidate is RouteCandidate => candidate !== null)
    : routeCandidates;

  const orderedListingKeys = orderedCandidates.length > 0
    ? [
        ...orderedCandidates.map((candidate) => candidate.listingKey),
        ...listings
          .map((listing) => listing.listingKey)
          .filter((key) => !orderedCandidates.some((candidate) => candidate.listingKey === key)),
      ]
    : listings.map((listing) => listing.listingKey);

  const orderedListings = orderListingsByKeys(listings, orderedListingKeys);

  const legByDestinationKey = new Map<
    string,
    { durationText: string; durationInTrafficText: string | null; distanceText: string }
  >();

  if (routeResult) {
    for (let index = 1; index < orderedCandidates.length; index += 1) {
      const candidate = orderedCandidates[index];
      const leg = routeResult.legs[index - 1];
      if (!candidate || !leg) continue;
      legByDestinationKey.set(candidate.listingKey, {
        durationText: leg.durationText,
        durationInTrafficText: leg.durationInTrafficText,
        distanceText: leg.distanceText,
      });
    }
  }

  const googleMapsUrl = buildGoogleMapsUrl(orderedCandidates);
  const totalDistanceText = routeResult
    ? formatDistance(routeResult.totalDistanceMeters)
    : null;
  const totalDurationText = routeResult
    ? routeResult.totalDurationInTrafficSeconds
      ? formatDuration(routeResult.totalDurationInTrafficSeconds)
      : formatDuration(routeResult.totalDurationSeconds)
    : null;

  return {
    routeResult,
    routeError,
    orderedListingKeys,
    orderedListings,
    tourPlan: {
      generatedAt: new Date().toISOString(),
      totalStops: orderedListings.length,
      route: {
        mode: routeMode,
        status: routeResult ? routeMode : "fallback",
        usedOptimization: routeResult?.usedOptimization ?? false,
        googleMapsUrl,
        totalDistanceMeters: routeResult?.totalDistanceMeters ?? null,
        totalDurationSeconds: routeResult?.totalDurationSeconds ?? null,
        totalDistanceText,
        totalDurationText,
        message: routeResult ? null : routeError,
        legs: routeResult
          ? routeResult.legs.map((leg) => ({
              fromStopIndex: leg.fromStopIndex,
              toStopIndex: leg.toStopIndex,
              distanceText: leg.distanceText,
              durationText: leg.durationText,
              durationInTrafficText: leg.durationInTrafficText,
            }))
          : [],
      },
      stops: orderedListings.map((listing, index) => {
        const routeLeg = legByDestinationKey.get(listing.listingKey) ?? null;
        return {
          order: index + 1,
          listingKey: listing.listingKey,
          address: buildAddress(listing) || null,
          city: listing.city,
          stateOrProvince: listing.state,
          postalCode: listing.postalCode,
          latitude: listing.latitude,
          longitude: listing.longitude,
          price: formatPrice(listing.listPrice),
          beds: listing.bedroomsTotal,
          baths: listing.bathroomsTotalInteger,
          sqft: listing.livingArea,
          propertyType: listing.propertyType,
          publicRemarks: listing.publicRemarks?.slice(0, 500) ?? null,
          photoUrl: photoMap.get(listing.listingKey) ?? null,
          driveFromPreviousText:
            index === 0 ? null : routeLeg?.durationInTrafficText ?? routeLeg?.durationText ?? null,
          distanceFromPreviousText: index === 0 ? null : routeLeg?.distanceText ?? null,
        };
      }),
    },
    routeStatus: routeResult ? routeMode : "fallback",
    totalDistanceText,
    totalDurationText,
    googleMapsUrl,
  };
}

export const showingTourRouter = router({
  previewRoute: protectedProcedure
    .input(previewRouteInputSchema)
    .mutation(async ({ input }) => {
      const { listings, missingKeys, photoMap } = await fetchTourListings(input.propertyIds);
      const payload = await buildRoutePayload(listings, input.routeMode, photoMap);

      return {
        propertyCount: payload.orderedListings.length,
        missingKeys,
        orderedListingKeys: payload.orderedListingKeys,
        routeMode: input.routeMode,
        routeStatus: payload.routeStatus,
        totalDistance: payload.totalDistanceText,
        totalDuration: payload.totalDurationText,
        googleMapsUrl: payload.googleMapsUrl,
        usedOptimization: payload.tourPlan.route.usedOptimization,
        message: payload.tourPlan.route.message,
        stops: payload.tourPlan.stops,
      };
    }),

  createTour: protectedProcedure
    .input(createTourInputSchema)
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "DB unavailable",
        });
      }

      const { listings, missingKeys, photoMap } = await fetchTourListings(input.propertyIds);
      const payload = await buildRoutePayload(listings, input.routeMode, photoMap);

      const token = randomBytes(16).toString("hex");
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      const tourDate = input.tourDate ?? new Date().toISOString().split("T")[0];
      const agentName = input.agentName || ctx.user.name || "Your Agent";
      const agentEmail = input.agentEmail || ctx.user.email || null;

      const agentBranding = {
        agentName,
        agentTitle: "Real Estate Advisor",
        brokerageName: "",
        phone: input.agentPhone ?? "",
        email: agentEmail ?? "",
        avatarUrl: ctx.user.picture ?? "",
        companyLogoUrl: input.agentLogoUrl ?? "",
        accentColor: "#1F5A4A",
      };

      const title = input.clientName
        ? `Showing Tour • ${input.clientName}`
        : `Showing Tour • ${tourDate}`;

      const introMessage = input.clientName
        ? `Hi ${input.clientName}! Here is your showing route for ${tourDate}. Open the route, review each stop, and let me know if you want to adjust the order.`
        : `Here is your showing route for ${tourDate}. Open the route, review each stop, and let me know if you want to adjust the order.`;

      const tourPlan = {
        ...payload.tourPlan,
        tourDate,
      };

      await db.insert(shareSessions).values({
        token,
        status: "active",
        sessionType: "listing_share",
        title,
        introMessage,
        clientName: input.clientName || null,
        createdByOpenId: ctx.user.openId,
        createdByCompanyId: null,
        createdByApiKeyId: null,
        createdByName: agentName,
        createdByEmail: agentEmail,
        agentBranding,
        shareConfig: { shareMode: "classic", routeKind: "showing_tour" },
        listingKeys: payload.orderedListingKeys,
        tourPlan,
        expiresAt,
        createdAt: now,
        updatedAt: now,
      });

      const tourResult = await db
        .insert(showingTours)
        .values({
          propertyIds: payload.orderedListingKeys,
          agentName,
          agentEmail,
          agentPhone: input.agentPhone,
          agentLogoUrl: input.agentLogoUrl,
          clientName: input.clientName || null,
          clientEmail: input.clientEmail || null,
          tourDate: input.tourDate ? new Date(input.tourDate) : undefined,
          optimizedRoute: payload.routeResult
            ? {
                optimizedOrder: payload.routeResult.optimizedOrder,
                totalDistanceMeters: payload.routeResult.totalDistanceMeters,
                totalDurationSeconds: payload.routeResult.totalDurationSeconds,
                legs: payload.routeResult.legs.map((leg) => ({
                  fromIndex: leg.fromStopIndex,
                  toIndex: leg.toStopIndex,
                  distanceText: leg.distanceText,
                  durationText: leg.durationText,
                })),
              }
            : undefined,
          pdfUrl: null,
          status: payload.routeResult ? "optimized" : "draft",
        })
        .returning();

      const origin = process.env.NEXT_PUBLIC_APP_URL || null;
      const sharePath = `/s/${token}`;
      const shareUrl = origin ? `${origin}${sharePath}` : sharePath;

      return {
        tourId: tourResult[0].id,
        shareToken: token,
        sharePath,
        shareUrl,
        propertyCount: payload.orderedListings.length,
        missingKeys,
        orderedListingKeys: payload.orderedListingKeys,
        routeMode: input.routeMode,
        routeStatus: payload.routeStatus,
        totalDistance: payload.totalDistanceText,
        totalDuration: payload.totalDurationText,
        googleMapsUrl: payload.googleMapsUrl,
        stops: tourPlan.stops,
      };
    }),

  get: protectedProcedure
    .input(z.object({ tourId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "DB unavailable",
        });
      }

      const tours = await db
        .select()
        .from(showingTours)
        .where(eq(showingTours.id, input.tourId))
        .limit(1);

      const tour = tours[0];
      if (!tour) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Tour not found" });
      }

      return tour;
    }),

  list: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(50).default(20),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "DB unavailable",
        });
      }

      return db
        .select({
          id: showingTours.id,
          agentName: showingTours.agentName,
          clientName: showingTours.clientName,
          tourDate: showingTours.tourDate,
          propertyIds: showingTours.propertyIds,
          status: showingTours.status,
          createdAt: showingTours.createdAt,
        })
        .from(showingTours)
        .orderBy(desc(showingTours.createdAt))
        .limit(input.limit);
    }),
});
