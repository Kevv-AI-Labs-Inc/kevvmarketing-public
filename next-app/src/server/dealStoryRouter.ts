/**
 * Deal Story Router — CRUD + vector embedding
 *
 * Manages completed transaction narratives with dual embeddings.
 * Used for "find an agent who's handled a deal like this" and AI copilot storytelling.
 */

import { z } from "zod";
import { eq, isNull, sql } from "drizzle-orm";
import { publicProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { dealStories } from "../drizzle/schema";
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

/** Build the text that gets embedded for a deal story. */
function buildDealStorySearchText(input: {
  storyText?: string | null;
  city?: string | null;
  stateOrProvince?: string | null;
  propertyType?: string | null;
  clientType?: string | null;
  listPrice?: string | null;
  closedPrice?: string | null;
  daysOnMarket?: number | null;
  keyTakeaways?: unknown;
  tags?: unknown;
}): string {
  const parts: string[] = [];
  if (input.city) parts.push(input.city);
  if (input.stateOrProvince) parts.push(input.stateOrProvince);
  if (input.propertyType) parts.push(input.propertyType);
  if (input.clientType) parts.push(`Client: ${input.clientType}`);
  if (input.listPrice) parts.push(`List: $${input.listPrice}`);
  if (input.closedPrice) parts.push(`Closed: $${input.closedPrice}`);
  if (input.daysOnMarket != null) parts.push(`DOM: ${input.daysOnMarket}`);
  if (Array.isArray(input.tags) && input.tags.length > 0) {
    parts.push(`Tags: ${input.tags.join(", ")}`);
  }
  if (input.storyText) parts.push(input.storyText);
  if (Array.isArray(input.keyTakeaways) && input.keyTakeaways.length > 0) {
    parts.push(`Takeaways: ${input.keyTakeaways.join("; ")}`);
  }
  return parts.join(" | ");
}

export const dealStoryRouter = router({
  /** List deal stories, optionally filtered by agent or city. */
  list: publicProcedure
    .input(
      z.object({
        agentId: z.number().optional(),
        city: z.string().optional(),
        clientType: z.string().optional(),
        limit: z.number().min(1).max(500).default(50),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      let query = db.select().from(dealStories);

      if (input.agentId) {
        query = query.where(eq(dealStories.agentId, input.agentId)) as typeof query;
      }
      if (input.city) {
        query = query.where(eq(dealStories.city, input.city)) as typeof query;
      }
      if (input.clientType) {
        query = query.where(eq(dealStories.clientType, input.clientType)) as typeof query;
      }

      return query
        .orderBy(sql`${dealStories.closedDate} DESC NULLS LAST`)
        .limit(input.limit)
        .offset(input.offset);
    }),

  /** Get a single deal story by ID. */
  get: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const rows = await db.select().from(dealStories).where(eq(dealStories.id, input.id)).limit(1);
      return rows[0] ?? null;
    }),

  /** Create a new deal story. Generates dual embeddings. */
  create: apiKeyProcedure
    .input(
      z.object({
        agentId: z.number().optional(),
        companyId: z.number().optional(),
        listingKey: z.string().optional(),
        closedDate: z.string().optional(), // ISO date string
        listPrice: z.string().optional(),
        closedPrice: z.string().optional(),
        daysOnMarket: z.number().optional(),
        city: z.string().optional(),
        stateOrProvince: z.string().optional(),
        propertyType: z.string().optional(),
        clientType: z.enum(["buyer", "seller", "dual"]).optional(),
        storyText: z.string().min(1),
        keyTakeaways: z.array(z.string()).optional(),
        tags: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const searchText = buildDealStorySearchText(input);

      const embeddingFields: Record<string, unknown> = {};
      try {
        const vec = await generateEmbedding(searchText);
        embeddingFields.embedding = vec;
        embeddingFields.embeddingModel = getEmbeddingModelId();
        embeddingFields.embeddingUpdatedAt = new Date();
      } catch (err) {
        console.error("[DealStory] Embedding generation failed:", err);
      }

      const result = await db
        .insert(dealStories)
        .values({
          agentId: input.agentId,
          companyId: input.companyId,
          listingKey: input.listingKey,
          closedDate: input.closedDate ? new Date(input.closedDate) : undefined,
          listPrice: input.listPrice,
          closedPrice: input.closedPrice,
          daysOnMarket: input.daysOnMarket,
          city: input.city,
          stateOrProvince: input.stateOrProvince,
          propertyType: input.propertyType,
          clientType: input.clientType,
          storyText: input.storyText,
          keyTakeaways: input.keyTakeaways,
          tags: input.tags,
          ...embeddingFields,
        })
        .returning({ id: dealStories.id });

      return { id: result[0]?.id, embedded: !!embeddingFields.embedding };
    }),

  /** Update an existing deal story. Re-generates embeddings if storyText changed. */
  update: apiKeyProcedure
    .input(
      z.object({
        id: z.number(),
        agentId: z.number().optional(),
        companyId: z.number().optional(),
        listingKey: z.string().optional(),
        closedDate: z.string().optional(),
        listPrice: z.string().optional(),
        closedPrice: z.string().optional(),
        daysOnMarket: z.number().optional(),
        city: z.string().optional(),
        stateOrProvince: z.string().optional(),
        propertyType: z.string().optional(),
        clientType: z.enum(["buyer", "seller", "dual"]).optional(),
        storyText: z.string().optional(),
        keyTakeaways: z.array(z.string()).optional(),
        tags: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const { id, ...updates } = input;

      // Re-embed if content fields changed
      const embeddingFields: Record<string, unknown> = {};
      if (updates.storyText || updates.tags || updates.keyTakeaways) {
        const current = await db.select().from(dealStories).where(eq(dealStories.id, id)).limit(1);
        if (current[0]) {
          const merged = { ...current[0], ...updates };
          const searchText = buildDealStorySearchText(merged);
          try {
            const vec = await generateEmbedding(searchText);
            embeddingFields.embedding = vec;
            embeddingFields.embeddingModel = getEmbeddingModelId();
            embeddingFields.embeddingUpdatedAt = new Date();
          } catch (err) {
            console.error("[DealStory] Embedding re-generation failed:", err);
          }
        }
      }

      const { closedDate: closedDateStr, ...restUpdates } = updates;
      await db
        .update(dealStories)
        .set({
          ...restUpdates,
          ...(closedDateStr ? { closedDate: new Date(closedDateStr) } : {}),
          ...embeddingFields,
          updatedAt: new Date(),
        })
        .where(eq(dealStories.id, id));

      return { id, updated: true, reEmbedded: !!embeddingFields.embedding };
    }),

  /** Delete a deal story. */
  delete: apiKeyProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      await db.delete(dealStories).where(eq(dealStories.id, input.id));
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
        .from(dealStories)
        .where(isNull(dealStories.embedding))
        .limit(input?.limit ?? 100);

      let updated = 0;
      const modelId = getEmbeddingModelId();
      for (const row of rows) {
        const text = buildDealStorySearchText(row);
        try {
          const vec = await generateEmbedding(text);
          await db
            .update(dealStories)
            .set({
              embedding: vec,
              embeddingModel: modelId,
              embeddingUpdatedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(dealStories.id, row.id));
          updated++;
        } catch (err) {
          console.error(`[DealStory] Embedding failed for id=${row.id}:`, err);
        }
      }

      return { total: rows.length, updated };
    }),

  /** Vector similarity search — find deals similar to a description. */
  search: publicProcedure
    .input(
      z.object({
        query: z.string().min(1),
        topK: z.number().min(1).max(50).default(10),
        agentId: z.number().optional(),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const { generateEmbedding } = await import("./embeddingService");
      const queryEmbedding = await generateEmbedding(input.query);
      const vecLiteral = `${JSON.stringify(queryEmbedding)}::vector`;

      let baseFilter = sql`${dealStories.embedding} IS NOT NULL`;
      if (input.agentId) {
        baseFilter = sql`${dealStories.embedding} IS NOT NULL AND ${dealStories.agentId} = ${input.agentId}`;
      }

      const results = await db
        .select({
          id: dealStories.id,
          agentId: dealStories.agentId,
          city: dealStories.city,
          propertyType: dealStories.propertyType,
          clientType: dealStories.clientType,
          closedPrice: dealStories.closedPrice,
          closedDate: dealStories.closedDate,
          storyText: dealStories.storyText,
          tags: dealStories.tags,
          similarity: sql<number>`1 - (${dealStories.embedding} <=> ${vecLiteral})`,
        })
        .from(dealStories)
        .where(baseFilter)
        .orderBy(sql`${dealStories.embedding} <=> ${vecLiteral}`)
        .limit(input.topK);

      return results;
    }),
});
