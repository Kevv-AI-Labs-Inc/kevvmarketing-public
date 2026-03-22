/**
 * Vector Router — stub for CMA vector-search features.
 *
 * Called by: CMAStudio.tsx
 * Endpoints: vector.listCmaDashboard, vector.generateCmaDashboard
 *
 * TODO: Wire up to the actual vector embedding service
 * when the listing-data-service exposes CMA endpoints.
 */

import { z } from "zod";
import { router, protectedProcedure } from "../trpc";

export const vectorRouter = router({
  /**
   * listCmaDashboard — List recent CMA analyses.
   */
  listCmaDashboard: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(50).optional().default(20),
      })
    )
    .query(async () => {
      // Stub: return empty history until the vector service is connected
      return [] as Array<{
        id: number;
        subjectListingKey: string;
        subjectAddress: string | null;
        comparableCount: number;
        comparableKeys: string[];
        createdAt: string;
      }>;
    }),

  /**
   * generateCmaDashboard — Generate a CMA analysis for a given listing.
   */
  generateCmaDashboard: protectedProcedure
    .input(
      z.object({
        listingKey: z.string().min(1),
        limit: z.number().min(1).max(20).optional().default(8),
      })
    )
    .mutation(async ({ input }) => {
      // Stub: return empty CMA result until the vector service is connected
      return {
        subject: {
          listingKey: input.listingKey,
          listingId: null,
          address: null,
          city: null,
          postalCode: null,
          price: null,
          propertyType: null,
          bedrooms: null,
          bathrooms: null,
          livingArea: null,
        },
        comparables: [],
        source: "sql_fallback" as const,
        meta: {
          total: 0,
          responseTimeMs: 0,
          source: "stub",
        },
        message: "CMA vector service not yet connected",
      };
    }),
});
