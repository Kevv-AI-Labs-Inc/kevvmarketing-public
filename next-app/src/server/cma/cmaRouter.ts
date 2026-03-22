/**
 * CMA Router — tRPC endpoints for Comparative Market Analysis.
 */

import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import { getDb } from "../db";
import { protectedProcedure, router } from "../_core/trpc";
import { cmaReports } from "../../drizzle/schema";
import { runCMAAnalysis } from "./cmaAnalyzer";
import { buildCMAReport, generateCMAPdf } from "./cmaReportGenerator";
import type { AgentBranding } from "./cmaReportGenerator";

export const cmaRouter = router({
  /**
   * Run CMA analysis for a listing.
   */
  analyze: protectedProcedure
    .input(
      z.object({
        listingKey: z.string(),
        branding: z.object({
          name: z.string(),
          email: z.string(),
          phone: z.string(),
          logoUrl: z.string().optional(),
          company: z.string().optional(),
        }),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Run analysis
      const cmaResult = await runCMAAnalysis(input.listingKey);

      // Build report
      const report = buildCMAReport(cmaResult, input.branding as AgentBranding);

      // Generate PDF
      const pdfUrl = await generateCMAPdf(report);

      // Save to database
      const targetData = cmaResult.target as unknown as Record<string, unknown>;
      const compsData = cmaResult.comps.map((c) => ({
        listing: c.listing,
        adjustments: c.adjustments,
      })) as Array<Record<string, unknown>>;

      const [saved] = await db
        .insert(cmaReports)
        .values({
          agentId: ctx.user?.id ?? null,
          listingKey: input.listingKey,
          address: cmaResult.target.unparsedAddress,
          targetData,
          compsData,
          aiAnalysis: cmaResult.aiAnalysis,
          suggestedPriceLow: cmaResult.suggestedPriceLow,
          suggestedPriceHigh: cmaResult.suggestedPriceHigh,
          marketTrends: cmaResult.marketTrends,
          branding: input.branding,
          pdfUrl,
          status: "ready",
        })
        .returning();

      return { report: saved, presentation: report };
    }),

  /**
   * List CMA reports for the authenticated agent.
   */
  list: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const reports = await db
      .select()
      .from(cmaReports)
      .orderBy(desc(cmaReports.createdAt));

    return { data: reports };
  }),

  /**
   * Get a CMA report by ID.
   */
  get: protectedProcedure
    .input(z.object({ reportId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const [report] = await db
        .select()
        .from(cmaReports)
        .where(eq(cmaReports.id, input.reportId))
        .limit(1);

      if (!report) throw new Error("Report not found");
      return report;
    }),

  /**
   * Delete a CMA report.
   */
  delete: protectedProcedure
    .input(z.object({ reportId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      await db
        .delete(cmaReports)
        .where(eq(cmaReports.id, input.reportId));
      return { success: true };
    }),
});
