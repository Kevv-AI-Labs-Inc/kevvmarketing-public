/**
 * CMA Router — tRPC endpoints for Next-Gen Comparative Market Analysis.
 *
 * Endpoints:
 *   cma.generate     — Run the 5-stage CMA pipeline (BBO + Tavily + Vision → report)
 *   cma.uploadPhoto  — Upload interior photos to R2 for Vision analysis
 *   cma.list         — List saved CMA reports for the authenticated agent
 *   cma.get          — Get a CMA report by ID
 *   cma.delete       — Delete a CMA report
 */

import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import { getDb } from "../db";
import { protectedProcedure, router } from "../_core/trpc";
import { cmaReports } from "../../drizzle/schema";
import { runCMAPipeline } from "./cmaAnalyzer";
import type { CMAReportResult } from "./cmaAnalyzer";
import { storagePut } from "../storage";

// ─── Input Schemas ─────────────────────────────────────────────

const brandingSchema = z.object({
  name: z.string(),
  email: z.string(),
  phone: z.string(),
  logoUrl: z.string().optional(),
  company: z.string().optional(),
});

const manualInputSchema = z.object({
  address: z.string(),
  city: z.string(),
  state: z.string(),
  zipCode: z.string(),
  price: z.string().optional(),
  beds: z.number().optional(),
  baths: z.number().optional(),
  sqft: z.number().optional(),
  yearBuilt: z.number().optional(),
  propertyType: z.string().optional(),
  highlights: z.string().optional(),
});

const generateInput = z.object({
  // Data source: MLS listing (preferred) or manual input
  listingKey: z.string().optional(),
  manualInput: manualInputSchema.optional(),
  // Interior photos for Vision analysis (R2 URLs from cma.uploadPhoto)
  photoUrls: z.array(z.string()).max(6).optional(),
  // Pipeline configuration
  compLimit: z.number().min(3).max(15).default(8),
  enableWebSearch: z.boolean().default(true),
  enablePhotoAnalysis: z.boolean().default(true),
  locale: z.enum(["en", "zh"]).default("en"),
  // Agent branding
  branding: brandingSchema,
});

// ─── Router ────────────────────────────────────────────────────

export const cmaRouter = router({
  /**
   * Generate a comprehensive CMA report using the 5-stage pipeline.
   *
   * Stage 1: Subject Resolution (BBO)
   * Stage 2a: Photo Analysis (Azure GPT Vision)
   * Stage 2b: Vector Comp Match (BBO)
   * Stage 3: Tavily Web Search
   * Stage 4: Neighborhood Context (BBO)
   * Stage 5: LLM Synthesis
   */
  generate: protectedProcedure
    .input(generateInput)
    .mutation(async ({ input, ctx }) => {
      // Validate: must provide either listingKey or manualInput
      if (!input.listingKey && !input.manualInput) {
        throw new Error(
          "Either listingKey or manualInput must be provided.",
        );
      }

      // Run the 5-stage pipeline
      const result: CMAReportResult = await runCMAPipeline({
        listingKey: input.listingKey,
        manualInput: input.manualInput,
        photoUrls: input.photoUrls ?? [],
        compLimit: input.compLimit,
        enableWebSearch: input.enableWebSearch,
        enablePhotoAnalysis: input.enablePhotoAnalysis,
        locale: input.locale,
        branding: input.branding,
      });

      // Persist to database
      const db = await getDb();
      if (db) {
        try {
          const [saved] = await db
            .insert(cmaReports)
            .values({
              agentId: ctx.user?.id ?? null,
              listingKey: input.listingKey ?? null,
              address: result.subject.address,
              targetData: result.subject as unknown as Record<string, unknown>,
              compsData: result.comparables as unknown as Array<Record<string, unknown>>,
              aiAnalysis: result.executiveSummary.english,
              suggestedPriceLow: result.priceRecommendation.low,
              suggestedPriceHigh: result.priceRecommendation.high,
              marketTrends: result.marketIntelligence as unknown as Record<string, unknown>,
              branding: input.branding as unknown as Record<string, unknown>,
              reportResult: result as unknown as Record<string, unknown>,
              photoUrls: input.photoUrls ?? [],
              photoAnalysis: result.subject.photoAnalysis as unknown as Record<string, unknown> ?? null,
              webSearchResult: result.marketIntelligence as unknown as Record<string, unknown>,
              compCount: result.comparables.length,
              dataSources: result.dataSources,
              pdfUrl: null,
              status: "ready",
            })
            .returning();

          return { report: saved, result };
        } catch (err) {
          console.error("[cmaRouter] DB save failed:", err);
          // Return result even if DB save fails
          return { report: null, result };
        }
      }

      return { report: null, result };
    }),

  /**
   * Upload interior photos to R2 for CMA Vision analysis.
   * Returns the public URL for each uploaded photo.
   */
  uploadPhoto: protectedProcedure
    .input(
      z.object({
        base64: z.string(),
        filename: z.string(),
        contentType: z.string().default("image/jpeg"),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const timestamp = Date.now();
      const ext = input.filename.split(".").pop() ?? "jpg";
      const key = `cma/photos/${ctx.user?.id ?? "anon"}/${timestamp}.${ext}`;

      // Decode base64 and upload to R2
      const buffer = Buffer.from(input.base64, "base64");
      const { url } = await storagePut(key, buffer, input.contentType);

      return { url, key };
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
