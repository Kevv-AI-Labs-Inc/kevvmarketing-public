/**
 * Showing Tour Router — Smart route-optimized property tours
 *
 * Creates a shareable link (like Magic Share) with embedded Google Maps
 * route and property details. The client receives a beautiful dynamic page,
 * not a static PDF.
 *
 * Endpoints:
 * - createTour: Input listing keys + agent info → optimize route → return share link
 * - get: Retrieve a tour by ID
 * - list: List all tours
 */

import { randomBytes } from "node:crypto";
import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { publicProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import {
    showingTours,
    shareSessions,
} from "../drizzle/schema";
// TODO: properties, media, and neighborhoods data will come from listing-data-service API
// import { properties, media, neighborhoods } from "../drizzle/schema";
import { analyzeRoute, type RouteAnalysisResult } from "./mapProviders";

// ─── Helpers ──────────────────────────────────────────────────


function formatPrice(price: string | null): string {
    if (!price) return "N/A";
    const num = parseFloat(price);
    if (isNaN(num)) return price;
    return "$" + num.toLocaleString("en-US");
}

// ─── Router ─────────────────────────────────────────────────

export const showingTourRouter = router({
    /**
     * One-shot: create tour → optimize route → generate share link
     *
     * The client gets a shareable URL like /s/{token} that opens a
     * dynamic page with embedded Google Maps route + property details.
     */
    createTour: publicProcedure
        .input(
            z.object({
                propertyIds: z.array(z.string()).min(2).max(25),
                agentName: z.string().optional(),
                agentEmail: z.string().email().optional(),
                agentPhone: z.string().optional(),
                agentLogoUrl: z.string().url().optional(),
                clientName: z.string().optional(),
                clientEmail: z.string().email().optional(),
                tourDate: z.string().optional(), // ISO date string
                startAddress: z.string().optional(),
            })
        )
        .mutation(async ({ input }) => {
            const db = await getDb();
            if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

            // ── 1. Fetch property details from listing-data-service ──
            const { getListingsBatch, getListingMedia } = await import("./clients/listingDataClient");
            const listingsMap = await getListingsBatch(input.propertyIds);

            const props = input.propertyIds
                .map((key) => {
                    const response = listingsMap.get(key);
                    if (!response?.data) return null;
                    const d = response.data;
                    return {
                        listingKey: d.listingKey ?? key,
                        listingId: d.listingId ?? null,
                        address: d.unparsedAddress ?? null,
                        city: d.city ?? null,
                        state: d.stateOrProvince ?? null,
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
                    };
                })
                .filter((p): p is NonNullable<typeof p> => p !== null);

            if (props.length < 2) {
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: `Only ${props.length} properties found. Need at least 2.`,
                });
            }

            // Get first photo per property from listing-data-service
            const photoMap = new Map<string, string>();
            await Promise.allSettled(
                input.propertyIds.map(async (key) => {
                    try {
                        const mediaResponse = await getListingMedia(key);
                        const firstUrl = mediaResponse.data?.[0]?.mediaURL;
                        if (firstUrl) photoMap.set(key, firstUrl);
                    } catch { /* skip */ }
                })
            );

            // Neighborhood data (simplified — no direct DB access)
            const hoodMap = new Map<string, { walkScore: unknown }>();

            // ── 2. Build validated listing keys (DB order) ──
            const validListingKeys = props.map((p) => p.listingKey);
            const missingKeys = input.propertyIds.filter(
                (id) => !validListingKeys.includes(id)
            );

            // ── 3. Optimize route via Google Directions ──
            const stops = props
                .filter((p) => p.latitude && p.longitude)
                .map((p) => ({
                    listingKey: p.listingKey,
                    address: p.address,
                    latitude: parseFloat(p.latitude!),
                    longitude: parseFloat(p.longitude!),
                }));

            let routeResult: RouteAnalysisResult | null = null;
            let routeError: string | null = null;

            if (stops.length >= 2) {
                try {
                    routeResult = await analyzeRoute({
                        stops,
                        optimizeWaypointOrder: true,
                    });
                } catch (err) {
                    routeError = err instanceof Error ? err.message : String(err);
                    console.warn("[ShowingTour] Route optimization failed:", routeError);
                }
            }

            // ── 4. Build tour plan for the share session ──
            const tourPlan = {
                generatedAt: new Date().toISOString(),
                totalStops: props.length,
                tourDate: input.tourDate ?? new Date().toISOString().split("T")[0],
                route: routeResult
                    ? {
                        status: "ready" as const,
                        optimizedOrder: routeResult.optimizedOrder,
                        totalDistanceMeters: routeResult.totalDistanceMeters,
                        totalDurationSeconds: routeResult.totalDurationSeconds,
                        legs: routeResult.legs.map((leg) => ({
                            fromStopIndex: leg.fromStopIndex,
                            toStopIndex: leg.toStopIndex,
                            distanceText: leg.distanceText,
                            durationText: leg.durationText,
                        })),
                        path: routeResult.path.map((p) => ({
                            lat: p.latitude,
                            lng: p.longitude,
                        })),
                    }
                    : { status: "error" as const, message: routeError ?? "Not enough coordinates" },
                stops: (routeResult
                    ? routeResult.optimizedOrder.map((idx, order) => {
                        const p = props.find(
                            (pr) => pr.listingKey === stops[idx]?.listingKey
                        );
                        if (!p) return null;
                        const zip5 = p.postalCode?.substring(0, 5);
                        const hood = zip5 ? hoodMap.get(zip5) : null;
                        return {
                            order: order + 1,
                            listingKey: p.listingKey,
                            address: p.address,
                            city: p.city,
                            stateOrProvince: p.state,
                            postalCode: p.postalCode,
                            latitude: p.latitude,
                            longitude: p.longitude,
                            price: formatPrice(p.listPrice),
                            beds: p.bedroomsTotal,
                            baths: p.bathroomsTotalInteger,
                            sqft: p.livingArea,
                            propertyType: p.propertyType,
                            publicRemarks: p.publicRemarks?.substring(0, 500),
                            photoUrl: photoMap.get(p.listingKey) ?? null,
                            walkScore: hood?.walkScore ?? null,
                        };
                    })
                    : props.map((p, idx) => {
                        const zip5 = p.postalCode?.substring(0, 5);
                        const hood = zip5 ? hoodMap.get(zip5) : null;
                        return {
                            order: idx + 1,
                            listingKey: p.listingKey,
                            address: p.address,
                            city: p.city,
                            stateOrProvince: p.state,
                            postalCode: p.postalCode,
                            latitude: p.latitude,
                            longitude: p.longitude,
                            price: formatPrice(p.listPrice),
                            beds: p.bedroomsTotal,
                            baths: p.bathroomsTotalInteger,
                            sqft: p.livingArea,
                            propertyType: p.propertyType,
                            publicRemarks: p.publicRemarks?.substring(0, 500),
                            photoUrl: photoMap.get(p.listingKey) ?? null,
                            walkScore: hood?.walkScore ?? null,
                        };
                    })
                ).filter(Boolean),
            };

            // ── 5. Create share session with unique token ──
            const token = randomBytes(16).toString("hex");
            const now = new Date();
            const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

            const agentBranding = {
                agentName: input.agentName ?? "Your Agent",
                agentTitle: "Real Estate Advisor",
                brokerageName: "",
                phone: input.agentPhone ?? "",
                email: input.agentEmail ?? "",
                avatarUrl: "",
                companyLogoUrl: input.agentLogoUrl ?? "",
                accentColor: "#1F5A4A",
            };

            await db.insert(shareSessions).values({
                token,
                status: "active",
                title: `Showing Tour - ${input.clientName ?? tourPlan.tourDate}`,
                introMessage: input.clientName
                    ? `Hi ${input.clientName}! Here's your personalized showing tour for ${tourPlan.tourDate}. The route has been optimized for the shortest drive time.`
                    : `Your showing tour for ${tourPlan.tourDate}. The route has been optimized for the shortest drive time.`,
                clientName: input.clientName?.trim() ?? null,
                createdByOpenId: "showing-tour",
                createdByCompanyId: null,
                createdByApiKeyId: null,
                createdByName: input.agentName ?? null,
                createdByEmail: input.agentEmail ?? null,
                agentBranding,
                listingKeys: validListingKeys,
                tourPlan,
                expiresAt,
                createdAt: now,
                updatedAt: now,
            });

            // ── 6. Also save to showing_tours table for admin tracking ──
            const tourResult = await db
                .insert(showingTours)
                .values({
                    propertyIds: validListingKeys,
                    agentName: input.agentName,
                    agentEmail: input.agentEmail,
                    agentPhone: input.agentPhone,
                    agentLogoUrl: input.agentLogoUrl,
                    clientName: input.clientName,
                    clientEmail: input.clientEmail,
                    tourDate: input.tourDate ? new Date(input.tourDate) : undefined,
                    startAddress: input.startAddress,
                    optimizedRoute: routeResult
                        ? {
                            optimizedOrder: routeResult.optimizedOrder,
                            totalDistanceMeters: routeResult.totalDistanceMeters,
                            totalDurationSeconds: routeResult.totalDurationSeconds,
                            legs: routeResult.legs.map((leg) => ({
                                fromIndex: leg.fromStopIndex,
                                toIndex: leg.toStopIndex,
                                distanceText: leg.distanceText,
                                durationText: leg.durationText,
                            })),
                        }
                        : undefined,
                    pdfUrl: null, // No PDF — using share link instead
                    status: "optimized",
                })
                .returning();

            // ── 7. Build share URL ──
            const origin = process.env.NEXT_PUBLIC_APP_URL || null;
            const sharePath = `/s/${token}`;
            const shareUrl = origin ? `${origin}${sharePath}` : sharePath;

            const totalMiles = routeResult
                ? (routeResult.totalDistanceMeters / 1609.34).toFixed(1)
                : null;
            const totalMinutes = routeResult
                ? Math.round(routeResult.totalDurationSeconds / 60)
                : null;

            return {
                tourId: tourResult[0].id,
                shareToken: token,
                sharePath,
                shareUrl,
                totalDistance: totalMiles ? `${totalMiles} mi` : null,
                totalDuration: totalMinutes ? `${totalMinutes} min` : null,
                propertyCount: validListingKeys.length,
                missingKeys,
                routeStatus: routeResult ? "optimized" : "fallback",
                stops: tourPlan.stops,
            };
        }),

    /**
     * Get a tour by ID.
     */
    get: publicProcedure
        .input(z.object({ tourId: z.number() }))
        .query(async ({ input }) => {
            const db = await getDb();
            if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

            const tours = await db
                .select()
                .from(showingTours)
                .where(eq(showingTours.id, input.tourId))
                .limit(1);

            const tour = tours[0];
            if (!tour) throw new TRPCError({ code: "NOT_FOUND", message: "Tour not found" });

            return tour;
        }),

    /**
     * List recent tours.
     */
    list: publicProcedure
        .input(
            z.object({
                limit: z.number().min(1).max(50).default(20),
            })
        )
        .query(async ({ input }) => {
            const db = await getDb();
            if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

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
