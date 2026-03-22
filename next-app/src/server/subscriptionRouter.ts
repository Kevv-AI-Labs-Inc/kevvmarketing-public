/**
 * Subscription Router — listing subscription push management.
 *
 * Agents create search-criteria subscriptions for clients.
 * When new listings match, notifications are queued for delivery.
 *
 * Endpoints:
 *   subscription.create   — create a new listing subscription
 *   subscription.list     — list agent's subscriptions
 *   subscription.update   — update criteria / pause / resume
 *   subscription.delete   — soft delete → status = 'expired'
 *   subscription.history  — notification delivery log
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import {
  listingSubscriptions,
  subscriptionNotifications,
} from "../drizzle/schema";
import { desc, eq, and } from "drizzle-orm";

const channelEnum = z.enum(["email", "sms", "wechat", "in_app", "web_push"]);
const frequencyEnum = z.enum(["instant", "daily_digest", "weekly_digest"]);
const statusEnum = z.enum(["active", "paused", "expired"]);

export const subscriptionRouter = router({
  /**
   * create — Create a new listing subscription.
   */
  create: protectedProcedure
    .input(
      z.object({
        clientId: z.number().optional(),
        name: z.string().max(255).optional(),
        cities: z.array(z.string()).optional(),
        minPrice: z.string().max(20).optional(),
        maxPrice: z.string().max(20).optional(),
        minBeds: z.number().min(0).max(20).optional(),
        maxBeds: z.number().min(0).max(20).optional(),
        propertyTypes: z.array(z.string()).optional(),
        keywords: z.string().max(1000).optional(),
        channel: channelEnum.default("email"),
        frequency: frequencyEnum.default("instant"),
        language: z.enum(["en", "zh", "zh_en"]).default("en"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      const [sub] = await db
        .insert(listingSubscriptions)
        .values({
          agentId: ctx.user.id,
          clientId: input.clientId,
          name: input.name,
          cities: input.cities,
          minPrice: input.minPrice,
          maxPrice: input.maxPrice,
          minBeds: input.minBeds,
          maxBeds: input.maxBeds,
          propertyTypes: input.propertyTypes,
          keywords: input.keywords,
          channel: input.channel,
          frequency: input.frequency,
          language: input.language,
          status: "active",
        })
        .returning();
      return sub;
    }),

  /**
   * list — List all subscriptions for the current agent.
   */
  list: protectedProcedure
    .input(
      z.object({
        status: statusEnum.optional(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      const limit = input?.limit ?? 50;
      const offset = input?.offset ?? 0;

      const conditions = [eq(listingSubscriptions.agentId, ctx.user.id)];
      if (input?.status) {
        conditions.push(eq(listingSubscriptions.status, input.status));
      }

      const subs = await db
        .select()
        .from(listingSubscriptions)
        .where(and(...conditions))
        .orderBy(desc(listingSubscriptions.createdAt))
        .limit(limit)
        .offset(offset);
      return subs;
    }),

  /**
   * update — Update subscription criteria, notification settings, or status.
   */
  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().max(255).optional(),
        cities: z.array(z.string()).optional(),
        minPrice: z.string().max(20).optional(),
        maxPrice: z.string().max(20).optional(),
        minBeds: z.number().min(0).max(20).optional(),
        maxBeds: z.number().min(0).max(20).optional(),
        propertyTypes: z.array(z.string()).optional(),
        keywords: z.string().max(1000).optional(),
        channel: channelEnum.optional(),
        frequency: frequencyEnum.optional(),
        language: z.enum(["en", "zh", "zh_en"]).optional(),
        status: statusEnum.optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      // Verify ownership
      const [existing] = await db
        .select()
        .from(listingSubscriptions)
        .where(
          and(
            eq(listingSubscriptions.id, input.id),
            eq(listingSubscriptions.agentId, ctx.user.id)
          )
        )
        .limit(1);

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Subscription not found",
        });
      }

      const { id, ...updates } = input;
      // Remove undefined values
      const cleanUpdates = Object.fromEntries(
        Object.entries(updates).filter(([, v]) => v !== undefined)
      );

      if (Object.keys(cleanUpdates).length === 0) {
        return existing;
      }

      const [updated] = await db
        .update(listingSubscriptions)
        .set({ ...cleanUpdates, updatedAt: new Date() })
        .where(eq(listingSubscriptions.id, id))
        .returning();

      return updated;
    }),

  /**
   * delete — Soft delete by setting status = 'expired'.
   */
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      const [existing] = await db
        .select()
        .from(listingSubscriptions)
        .where(
          and(
            eq(listingSubscriptions.id, input.id),
            eq(listingSubscriptions.agentId, ctx.user.id)
          )
        )
        .limit(1);

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Subscription not found",
        });
      }

      await db
        .update(listingSubscriptions)
        .set({ status: "expired", updatedAt: new Date() })
        .where(eq(listingSubscriptions.id, input.id));

      return { success: true };
    }),

  /**
   * history — Notification delivery log for a subscription.
   */
  history: protectedProcedure
    .input(
      z.object({
        subscriptionId: z.number(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      // Verify ownership of the parent subscription
      const [sub] = await db
        .select()
        .from(listingSubscriptions)
        .where(
          and(
            eq(listingSubscriptions.id, input.subscriptionId),
            eq(listingSubscriptions.agentId, ctx.user.id)
          )
        )
        .limit(1);

      if (!sub) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Subscription not found",
        });
      }

      const notifications = await db
        .select()
        .from(subscriptionNotifications)
        .where(eq(subscriptionNotifications.subscriptionId, input.subscriptionId))
        .orderBy(desc(subscriptionNotifications.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      return notifications;
    }),
});

export type SubscriptionRouter = typeof subscriptionRouter;
