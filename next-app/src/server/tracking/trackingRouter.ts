/**
 * Tracking Router — tRPC endpoints for event tracking and engagement scores.
 *
 * Endpoints:
 * - tracking.recordEvent    — record a client interaction event
 * - tracking.recordBatch    — batch record events
 * - tracking.getEvents      — query events by contact/type
 * - tracking.getScore       — get engagement score for a contact
 * - tracking.recalculate    — force recalculate a contact's score
 * - tracking.leaderboard    — top engaged contacts
 */

import { z } from "zod";
import { eq, desc, and, gte } from "drizzle-orm";
import { getDb } from "../db";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { clientEvents, engagementScores } from "../../drizzle/schema";
import { trackEvent, trackEvents, EVENT_TYPES } from "./eventTracker";
import { recalculateScore } from "./engagementScorer";

// ─── Input Schemas ─────────────────────────────────────────

const recordEventInput = z.object({
  contactId: z.number().optional(),
  agentId: z.number().optional(),
  eventType: z.string().min(1),
  eventData: z.record(z.string(), z.unknown()).optional(),
  sourceType: z.string().optional(),
  sourceId: z.string().optional(),
  sessionToken: z.string().optional(),
});

const batchEventInput = z.object({
  events: z.array(recordEventInput),
});

// ─── Router ────────────────────────────────────────────────

export const trackingRouter = router({
  /**
   * Record a single client event (public — used by share pages, embed widgets).
   */
  recordEvent: publicProcedure
    .input(recordEventInput)
    .mutation(async ({ input, ctx }) => {
      await trackEvent({
        ...input,
        ipAddress: ctx.ip ?? undefined,
        userAgent: ctx.userAgent ?? undefined,
      });
      return { recorded: true };
    }),

  /**
   * Batch record events.
   */
  recordBatch: publicProcedure
    .input(batchEventInput)
    .mutation(async ({ input }) => {
      await trackEvents(input.events);
      return { recorded: input.events.length };
    }),

  /**
   * Query events for a contact or by type.
   */
  getEvents: protectedProcedure
    .input(
      z.object({
        contactId: z.number().optional(),
        eventType: z.string().optional(),
        days: z.number().default(30),
        page: z.number().default(1),
        perPage: z.number().default(50),
      }),
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - input.days);
      const offset = (input.page - 1) * input.perPage;

      const conditions = [gte(clientEvents.createdAt, cutoff)];
      if (input.contactId) conditions.push(eq(clientEvents.contactId, input.contactId));
      if (input.eventType) conditions.push(eq(clientEvents.eventType, input.eventType));

      const events = await db
        .select()
        .from(clientEvents)
        .where(and(...conditions))
        .orderBy(desc(clientEvents.createdAt))
        .limit(input.perPage)
        .offset(offset);

      return { data: events, page: input.page, perPage: input.perPage };
    }),

  /**
   * Get engagement score for a contact.
   */
  getScore: protectedProcedure
    .input(z.object({ contactId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const [score] = await db
        .select()
        .from(engagementScores)
        .where(eq(engagementScores.contactId, input.contactId))
        .limit(1);

      return score ?? { contactId: input.contactId, score: 0, factors: {} };
    }),

  /**
   * Force recalculate engagement score for a contact.
   */
  recalculate: protectedProcedure
    .input(z.object({ contactId: z.number() }))
    .mutation(async ({ input }) => {
      return recalculateScore(input.contactId);
    }),

  /**
   * Engagement leaderboard — top N most engaged contacts.
   */
  leaderboard: protectedProcedure
    .input(z.object({ limit: z.number().default(20) }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const top = await db
        .select()
        .from(engagementScores)
        .orderBy(desc(engagementScores.score))
        .limit(input?.limit ?? 20);

      return { data: top };
    }),

  /**
   * Available event types (for frontend dropdowns).
   */
  eventTypes: publicProcedure.query(() => {
    return EVENT_TYPES;
  }),
});
