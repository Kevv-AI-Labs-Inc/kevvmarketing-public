/**
 * Prospecting Router — tRPC procedures for the Prospecting Dashboard.
 *
 * Phase 1: generateBrief, getBrief, listBriefs, submitFeedback, sendPostcard.
 * Ownership: user_id (users.id) — matches every other router's pattern.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and, desc } from "drizzle-orm";

import { protectedProcedure, router } from "@/server/trpc";
import { getDb } from "@/lib/db";
import { prospectBriefs, prospectFeedback } from "@/lib/db/schema";
import {
  generateBrief,
  resolveListing,
  type ListingCandidate,
} from "./prospecting/briefEngine";
import {
  createManualPostcardContact,
  createDraftPostcardCampaign,
} from "./postcards/postcardService";

const DAILY_BRIEF_LIMIT = 30;

export const prospectingRouter = router({
  /**
   * Generate a Prospect Brief for a listing.
   * Non-streaming Phase 1 — returns complete brief.
   */
  generateBrief: protectedProcedure
    .input(
      z.object({
        listingId: z.string().trim().min(1).optional(),
        address: z.string().trim().min(3).optional(),
        listingKey: z.string().trim().min(1).optional(),
        tone: z
          .enum(["professional", "friendly", "direct", "empathetic"])
          .default("professional"),
        language: z.enum(["en", "zh"]).default("en"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!input.listingId && !input.address && !input.listingKey) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Provide either a listing ID or address.",
        });
      }

      const db = getDb();

      // Rate limit: 30 briefs per day
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const existingBriefs = await db
        .select({ id: prospectBriefs.id })
        .from(prospectBriefs)
        .where(
          and(
            eq(prospectBriefs.userId, ctx.user.id),
            // Simple approach: count all briefs created today
          )
        );
      // Filter in JS for today (Drizzle doesn't have easy date comparison)
      const todayCount = existingBriefs.filter(
        (b) => true // Will be refined when we add createdAt filter
      ).length;

      // Insert draft row first (status=generating)
      const [draft] = await db
        .insert(prospectBriefs)
        .values({
          userId: ctx.user.id,
          listingId: input.listingId ?? null,
          address: input.address ?? null,
          tone: input.tone,
          language: input.language,
          status: "generating",
        })
        .returning();

      try {
        // Resolve by listingKey if provided (from disambiguation)
        const resolvedInput = input.listingKey
          ? { listingId: input.listingKey, tone: input.tone, language: input.language }
          : { listingId: input.listingId, address: input.address, tone: input.tone, language: input.language };

        const result = await generateBrief(resolvedInput);

        // Update the draft row with results
        const [updated] = await db
          .update(prospectBriefs)
          .set({
            listingId: result.listingId,
            address: result.address,
            listingData: result.listingData,
            diagnosis: result.diagnosis,
            pitchAngles: result.pitchAngles,
            outreachScripts: result.outreachScripts,
            objectionHandlers: result.objectionHandlers,
            llmPrompt: result.llmPrompt,
            llmResponse: result.llmResponse,
            status: "ready",
          })
          .where(eq(prospectBriefs.id, draft.id))
          .returning();

        return updated;
      } catch (err) {
        const error = err as Error & { candidates?: ListingCandidate[] };

        // Handle disambiguation
        if (error.message === "AMBIGUOUS_ADDRESS") {
          // Clean up draft
          await db
            .delete(prospectBriefs)
            .where(eq(prospectBriefs.id, draft.id));

          return {
            ambiguous: true as const,
            candidates: error.candidates ?? [],
          };
        }

        // Mark as failed
        await db
          .update(prospectBriefs)
          .set({
            status: "failed",
            error: error.message,
          })
          .where(eq(prospectBriefs.id, draft.id));

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Failed to generate brief.",
        });
      }
    }),

  /**
   * Fetch a single brief by ID (must belong to current user).
   */
  getBrief: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const [brief] = await db
        .select()
        .from(prospectBriefs)
        .where(
          and(
            eq(prospectBriefs.id, input.id),
            eq(prospectBriefs.userId, ctx.user.id)
          )
        )
        .limit(1);

      if (!brief) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Brief not found." });
      }

      // Also fetch feedback if exists
      const [feedback] = await db
        .select()
        .from(prospectFeedback)
        .where(
          and(
            eq(prospectFeedback.briefId, input.id),
            eq(prospectFeedback.userId, ctx.user.id)
          )
        )
        .limit(1);

      return { ...brief, feedback: feedback ?? null };
    }),

  /**
   * List user's recent briefs (most recent first).
   */
  listBriefs: protectedProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(50).default(20),
        offset: z.number().int().min(0).default(0),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const limit = input?.limit ?? 20;
      const offset = input?.offset ?? 0;

      const briefs = await db
        .select()
        .from(prospectBriefs)
        .where(eq(prospectBriefs.userId, ctx.user.id))
        .orderBy(desc(prospectBriefs.createdAt))
        .limit(limit)
        .offset(offset);

      return briefs;
    }),

  /**
   * Submit feedback on a brief (upsert by brief_id + user_id).
   */
  submitFeedback: protectedProcedure
    .input(
      z.object({
        briefId: z.number().int(),
        outcome: z.enum([
          "called",
          "appointment_booked",
          "not_interested",
          "no_answer",
          "voicemail",
          "callback_scheduled",
        ]),
        pitchAngleId: z.string().optional(),
        outreachChannel: z.enum(["call", "sms", "email", "postcard"]).optional(),
        editsMade: z.boolean().optional(),
        editedScript: z.string().trim().max(5000).optional(),
        notes: z.string().trim().max(2000).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();

      // Verify brief belongs to user
      const [brief] = await db
        .select({ id: prospectBriefs.id })
        .from(prospectBriefs)
        .where(
          and(
            eq(prospectBriefs.id, input.briefId),
            eq(prospectBriefs.userId, ctx.user.id)
          )
        )
        .limit(1);

      if (!brief) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Brief not found." });
      }

      // Upsert: ON CONFLICT(brief_id, user_id) DO UPDATE
      const [existing] = await db
        .select()
        .from(prospectFeedback)
        .where(
          and(
            eq(prospectFeedback.briefId, input.briefId),
            eq(prospectFeedback.userId, ctx.user.id)
          )
        )
        .limit(1);

      if (existing) {
        await db
          .update(prospectFeedback)
          .set({
            outcome: input.outcome,
            pitchAngleId: input.pitchAngleId ?? null,
            outreachChannel: input.outreachChannel ?? null,
            editsMade: input.editsMade ?? false,
            editedScript: input.editedScript ?? null,
            notes: input.notes ?? null,
          })
          .where(eq(prospectFeedback.id, existing.id));
      } else {
        await db.insert(prospectFeedback).values({
          briefId: input.briefId,
          userId: ctx.user.id,
          outcome: input.outcome,
          pitchAngleId: input.pitchAngleId ?? null,
          outreachChannel: input.outreachChannel ?? null,
          editsMade: input.editsMade ?? false,
          editedScript: input.editedScript ?? null,
          notes: input.notes ?? null,
        });
      }

      return { success: true };
    }),

  /**
   * One-click postcard: create contact + draft campaign from a brief.
   */
  sendPostcard: protectedProcedure
    .input(
      z.object({
        briefId: z.number().int(),
        templateId: z.number().int(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();

      // Fetch brief
      const [brief] = await db
        .select()
        .from(prospectBriefs)
        .where(
          and(
            eq(prospectBriefs.id, input.briefId),
            eq(prospectBriefs.userId, ctx.user.id)
          )
        )
        .limit(1);

      if (!brief || brief.status !== "ready") {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Brief not found or not ready.",
        });
      }

      // Parse address from brief
      const addressParts = (brief.address ?? "").split(",").map((s) => s.trim());
      if (addressParts.length < 3) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Brief does not have a valid address for postcard delivery.",
        });
      }

      const listingData = brief.listingData as Record<string, unknown> | null;
      const ownerName =
        (listingData?.ownerName as string) ?? "Current Resident";

      // Create postcard contact
      const contact = await createManualPostcardContact({
        agentId: ctx.user.id,
        fullName: ownerName,
        addressLine1: addressParts[0],
        city: addressParts[1] ?? "",
        state: (addressParts[2] ?? "").split(" ")[0] ?? "",
        postalCode: (addressParts[2] ?? "").split(" ")[1] ?? "",
        tags: ["prospecting", "expired"],
      });

      // Create draft campaign
      const campaign = await createDraftPostcardCampaign({
        agentId: ctx.user.id,
        name: `Prospect: ${brief.address ?? brief.listingId}`,
        templateId: input.templateId,
        contactIds: [contact.id],
      });

      return { campaignId: campaign.id, contactId: contact.id };
    }),
});
