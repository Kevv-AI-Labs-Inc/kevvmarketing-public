/**
 * Showing Feedback Router — CRUD + vector embedding
 *
 * Manages per-visit client reactions to property showings.
 * Over time these reveal true preferences vs stated preferences.
 * Used to refine client profile embeddings and AI copilot recommendations.
 */

import { z } from "zod";
import { eq, isNull, sql } from "drizzle-orm";
import { publicProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { showingFeedback } from "../drizzle/schema";
import { validateApiKey } from "./apiKeyAuth";
import { TRPCError } from "@trpc/server";
import {
  generateEmbedding,
  getEmbeddingModelId,
} from "./embeddingService";

const apiKeyProcedure = publicProcedure.use(async ({ ctx, next }) => {
  const authHeader = ctx.headers.get("authorization") ?? undefined;
  const apiKeyCtx = await validateApiKey(authHeader);
  if (!apiKeyCtx) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Invalid or missing API key",
    });
  }
  return next({ ctx: { ...ctx, apiKey: apiKeyCtx } });
});

/** Build the text that gets embedded for showing feedback. */
function buildFeedbackSearchText(input: {
  feedbackText?: string | null;
  overallRating?: number | null;
  wouldRevisit?: boolean | null;
  priceReaction?: string | null;
  liked?: unknown;
  disliked?: unknown;
}): string {
  const parts: string[] = [];
  if (input.overallRating != null) parts.push(`Rating: ${input.overallRating}/5`);
  if (input.wouldRevisit != null) parts.push(input.wouldRevisit ? "Would revisit" : "Would not revisit");
  if (input.priceReaction) parts.push(`Price: ${input.priceReaction}`);
  if (Array.isArray(input.liked) && input.liked.length > 0) {
    parts.push(`Liked: ${input.liked.join(", ")}`);
  }
  if (Array.isArray(input.disliked) && input.disliked.length > 0) {
    parts.push(`Disliked: ${input.disliked.join(", ")}`);
  }
  if (input.feedbackText) parts.push(input.feedbackText);
  return parts.join(" | ");
}

export const showingFeedbackRouter = router({
  /** List feedback for a client or property. */
  list: publicProcedure
    .input(
      z.object({
        clientId: z.number().optional(),
        propertyId: z.number().optional(),
        listingKey: z.string().optional(),
        agentId: z.number().optional(),
        limit: z.number().min(1).max(500).default(50),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      let query = db.select().from(showingFeedback);

      if (input.clientId) {
        query = query.where(eq(showingFeedback.clientId, input.clientId)) as typeof query;
      }
      if (input.propertyId) {
        query = query.where(eq(showingFeedback.propertyId, input.propertyId)) as typeof query;
      }
      if (input.listingKey) {
        query = query.where(eq(showingFeedback.listingKey, input.listingKey)) as typeof query;
      }
      if (input.agentId) {
        query = query.where(eq(showingFeedback.agentId, input.agentId)) as typeof query;
      }

      return query
        .orderBy(sql`${showingFeedback.showingDate} DESC NULLS LAST`)
        .limit(input.limit)
        .offset(input.offset);
    }),

  /** Get a single feedback entry by ID. */
  get: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const rows = await db.select().from(showingFeedback).where(eq(showingFeedback.id, input.id)).limit(1);
      return rows[0] ?? null;
    }),

  /** Create a new feedback entry. Generates dual embeddings. */
  create: apiKeyProcedure
    .input(
      z.object({
        clientId: z.number().optional(),
        propertyId: z.number().optional(),
        listingKey: z.string().optional(),
        agentId: z.number().optional(),
        showingDate: z.string().optional(), // ISO
        overallRating: z.number().min(1).max(5).optional(),
        wouldRevisit: z.boolean().optional(),
        priceReaction: z.enum(["too_high", "fair", "good_deal"]).optional(),
        feedbackText: z.string().min(1),
        liked: z.array(z.string()).optional(),
        disliked: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const searchText = buildFeedbackSearchText(input);

      const embeddingFields: Record<string, unknown> = {};
      try {
        const vec = await generateEmbedding(searchText);
        embeddingFields.embedding = vec;
        embeddingFields.embeddingModel = getEmbeddingModelId();
        embeddingFields.embeddingUpdatedAt = new Date();
      } catch (err) {
        console.error("[ShowingFeedback] Embedding generation failed:", err);
      }

      const result = await db
        .insert(showingFeedback)
        .values({
          clientId: input.clientId,
          propertyId: input.propertyId,
          listingKey: input.listingKey,
          agentId: input.agentId,
          showingDate: input.showingDate ? new Date(input.showingDate) : undefined,
          overallRating: input.overallRating,
          wouldRevisit: input.wouldRevisit,
          priceReaction: input.priceReaction,
          feedbackText: input.feedbackText,
          liked: input.liked,
          disliked: input.disliked,
          ...embeddingFields,
        })
        .returning({ id: showingFeedback.id });

      return { id: result[0]?.id, embedded: !!embeddingFields.embedding };
    }),

  /** Update a feedback entry. Re-embeds if content changed. */
  update: apiKeyProcedure
    .input(
      z.object({
        id: z.number(),
        overallRating: z.number().min(1).max(5).optional(),
        wouldRevisit: z.boolean().optional(),
        priceReaction: z.enum(["too_high", "fair", "good_deal"]).optional(),
        feedbackText: z.string().optional(),
        liked: z.array(z.string()).optional(),
        disliked: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const { id, ...updates } = input;

      const embeddingFields: Record<string, unknown> = {};
      if (updates.feedbackText || updates.liked || updates.disliked) {
        const current = await db.select().from(showingFeedback).where(eq(showingFeedback.id, id)).limit(1);
        if (current[0]) {
          const merged = { ...current[0], ...updates };
          const searchText = buildFeedbackSearchText(merged);
          try {
            const vec = await generateEmbedding(searchText);
            embeddingFields.embedding = vec;
            embeddingFields.embeddingModel = getEmbeddingModelId();
            embeddingFields.embeddingUpdatedAt = new Date();
          } catch (err) {
            console.error("[ShowingFeedback] Embedding re-generation failed:", err);
          }
        }
      }

      await db
        .update(showingFeedback)
        .set({
          ...updates,
          ...embeddingFields,
          updatedAt: new Date(),
        })
        .where(eq(showingFeedback.id, id));

      return { id, updated: true, reEmbedded: !!embeddingFields.embedding };
    }),

  /** Delete a feedback entry. */
  delete: apiKeyProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      await db.delete(showingFeedback).where(eq(showingFeedback.id, input.id));
      return { deleted: true };
    }),

  /** Backfill embeddings for rows missing them. */
  backfillEmbeddings: apiKeyProcedure
    .input(z.object({ limit: z.number().min(1).max(500).default(100) }).optional())
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const rows = await db
        .select()
        .from(showingFeedback)
        .where(isNull(showingFeedback.embedding))
        .limit(input?.limit ?? 100);

      let updated = 0;
      const modelId = getEmbeddingModelId();
      for (const row of rows) {
        const text = buildFeedbackSearchText(row);
        try {
          const vec = await generateEmbedding(text);
          await db
            .update(showingFeedback)
            .set({
              embedding: vec,
              embeddingModel: modelId,
              embeddingUpdatedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(showingFeedback.id, row.id));
          updated++;
        } catch (err) {
          console.error(`[ShowingFeedback] Embedding failed for id=${row.id}:`, err);
        }
      }

      return { total: rows.length, updated };
    }),

  /** Get aggregated preference insights for a client based on their showing feedback. */
  clientInsights: publicProcedure
    .input(z.object({ clientId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const rows = await db
        .select()
        .from(showingFeedback)
        .where(eq(showingFeedback.clientId, input.clientId))
        .orderBy(sql`${showingFeedback.showingDate} DESC NULLS LAST`);

      if (rows.length === 0) {
        return { totalShowings: 0, avgRating: null, wouldRevisitRate: null, allLiked: [], allDisliked: [], priceReactions: {} };
      }

      const ratings = rows.filter((r) => r.overallRating != null).map((r) => r.overallRating!);
      const avgRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null;

      const revisits = rows.filter((r) => r.wouldRevisit != null);
      const wouldRevisitRate = revisits.length > 0
        ? revisits.filter((r) => r.wouldRevisit).length / revisits.length
        : null;

      const allLiked: string[] = [];
      const allDisliked: string[] = [];
      const priceReactions: Record<string, number> = {};

      for (const row of rows) {
        if (Array.isArray(row.liked)) allLiked.push(...(row.liked as string[]));
        if (Array.isArray(row.disliked)) allDisliked.push(...(row.disliked as string[]));
        if (row.priceReaction) {
          priceReactions[row.priceReaction] = (priceReactions[row.priceReaction] || 0) + 1;
        }
      }

      // Count frequency of liked/disliked items
      const countFreq = (arr: string[]) => {
        const freq: Record<string, number> = {};
        for (const item of arr) {
          freq[item] = (freq[item] || 0) + 1;
        }
        return Object.entries(freq)
          .sort((a, b) => b[1] - a[1])
          .map(([item, count]) => ({ item, count }));
      };

      return {
        totalShowings: rows.length,
        avgRating: avgRating ? Math.round(avgRating * 10) / 10 : null,
        wouldRevisitRate: wouldRevisitRate ? Math.round(wouldRevisitRate * 100) : null,
        topLiked: countFreq(allLiked).slice(0, 10),
        topDisliked: countFreq(allDisliked).slice(0, 10),
        priceReactions,
      };
    }),

  /** Vector search — find feedback entries similar to a description. */
  search: publicProcedure
    .input(
      z.object({
        query: z.string().min(1),
        topK: z.number().min(1).max(50).default(10),
        clientId: z.number().optional(),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const { generateEmbedding } = await import("./embeddingService");
      const queryEmbedding = await generateEmbedding(input.query);
      const vecLiteral = `${JSON.stringify(queryEmbedding)}::vector`;

      let baseFilter = sql`${showingFeedback.embedding} IS NOT NULL`;
      if (input.clientId) {
        baseFilter = sql`${showingFeedback.embedding} IS NOT NULL AND ${showingFeedback.clientId} = ${input.clientId}`;
      }

      const results = await db
        .select({
          id: showingFeedback.id,
          clientId: showingFeedback.clientId,
          listingKey: showingFeedback.listingKey,
          overallRating: showingFeedback.overallRating,
          wouldRevisit: showingFeedback.wouldRevisit,
          priceReaction: showingFeedback.priceReaction,
          feedbackText: showingFeedback.feedbackText,
          liked: showingFeedback.liked,
          disliked: showingFeedback.disliked,
          similarity: sql<number>`1 - (${showingFeedback.embedding} <=> ${vecLiteral})`,
        })
        .from(showingFeedback)
        .where(baseFilter)
        .orderBy(sql`${showingFeedback.embedding} <=> ${vecLiteral}`)
        .limit(input.topK);

      return results;
    }),
});
