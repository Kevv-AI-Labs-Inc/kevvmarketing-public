/**
 * Flyer Router — CRUD, R2 upload, and Shares integration for Flyer Studio.
 *
 * Endpoints:
 *   flyer.save       — Create or update a flyer draft
 *   flyer.list       — Paginated list of the agent's flyers
 *   flyer.get        — Get a single flyer by ID
 *   flyer.delete     — Soft-delete / hard-delete a flyer
 *   flyer.uploadExport — Upload a rendered PNG (base64) to R2 and update the flyer
 *   flyer.share      — Publish flyer to Shares Dashboard (creates a shareSession)
 */

import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { flyers, shareSessions } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { storagePut, isR2Configured } from "./storage";
import { randomBytes } from "crypto";

// ─── Input Schemas ─────────────────────────────────────────

const flyerDataSchema = z.record(z.string(), z.unknown()); // FlyerData JSON — full editor state

const saveFlyerInput = z.object({
  id: z.number().optional(), // undefined = create, number = update
  title: z.string().trim().min(1).max(255),
  templateId: z.string().max(64),
  sizeKey: z.string().max(32).default("letter"),
  flyerData: flyerDataSchema,
});

const listFlyersInput = z.object({
  limit: z.number().min(1).max(50).default(20),
  offset: z.number().min(0).default(0),
}).optional();

const uploadExportInput = z.object({
  flyerId: z.number(),
  base64Data: z.string().min(1),
  mimeType: z.enum(["image/png", "image/jpeg", "image/webp"]).default("image/png"),
});

const shareFlyerInput = z.object({
  flyerId: z.number(),
  title: z.string().trim().min(1).max(255).optional(),
  expiresInDays: z.number().min(1).max(365).optional(),
});

// ─── Router ────────────────────────────────────────────────

export const flyerRouter = router({
  /**
   * save — Create or update a flyer draft.
   */
  save: protectedProcedure.input(saveFlyerInput).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    const now = new Date();

    if (input.id) {
      // Update existing
      const [existing] = await db
        .select({ id: flyers.id, openId: flyers.openId })
        .from(flyers)
        .where(eq(flyers.id, input.id))
        .limit(1);

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Flyer not found" });
      }
      if (existing.openId !== ctx.user.openId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }

      const [updated] = await db
        .update(flyers)
        .set({
          title: input.title,
          templateId: input.templateId,
          sizeKey: input.sizeKey,
          flyerData: input.flyerData,
          updatedAt: now,
        })
        .where(eq(flyers.id, input.id))
        .returning();

      return updated;
    }

    // Create new
    const [created] = await db
      .insert(flyers)
      .values({
        agentId: ctx.user.id,
        openId: ctx.user.openId,
        title: input.title,
        templateId: input.templateId,
        sizeKey: input.sizeKey,
        status: "draft",
        flyerData: input.flyerData,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return created;
  }),

  /**
   * list — Paginated list of agent's flyers, newest first.
   */
  list: protectedProcedure.input(listFlyersInput).query(async ({ ctx, input }) => {
    const limit = input?.limit ?? 20;
    const offset = input?.offset ?? 0;
    const db = await getDb();

    const rows = await db
      .select({
        id: flyers.id,
        title: flyers.title,
        templateId: flyers.templateId,
        sizeKey: flyers.sizeKey,
        status: flyers.status,
        thumbnailUrl: flyers.thumbnailUrl,
        exportedUrl: flyers.exportedUrl,
        shareToken: flyers.shareToken,
        createdAt: flyers.createdAt,
        updatedAt: flyers.updatedAt,
      })
      .from(flyers)
      .where(eq(flyers.openId, ctx.user.openId))
      .orderBy(desc(flyers.updatedAt))
      .limit(limit)
      .offset(offset);

    return rows;
  }),

  /**
   * get — Get a single flyer with full flyerData for editing.
   */
  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      const [row] = await db
        .select()
        .from(flyers)
        .where(eq(flyers.id, input.id))
        .limit(1);

      if (!row) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Flyer not found" });
      }
      if (row.openId !== ctx.user.openId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }

      return row;
    }),

  /**
   * delete — Hard-delete a flyer.
   */
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      const result = await db
        .delete(flyers)
        .where(and(eq(flyers.id, input.id), eq(flyers.openId, ctx.user.openId)))
        .returning({ id: flyers.id });

      if (result.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Flyer not found or already deleted" });
      }

      return { success: true, id: input.id };
    }),

  /**
   * uploadExport — Upload a base64-encoded rendered PNG to R2,
   * then update the flyer's thumbnailUrl and exportedUrl.
   */
  uploadExport: protectedProcedure
    .input(uploadExportInput)
    .mutation(async ({ input, ctx }) => {
      if (!isR2Configured()) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Cloud storage (R2) is not configured. Flyer will be saved locally only.",
        });
      }

      // Validate size (max 10MB base64)
      if (input.base64Data.length > 14_000_000) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Image too large (max 10MB)" });
      }

      const db = await getDb();
      const [existing] = await db
        .select({ id: flyers.id, openId: flyers.openId })
        .from(flyers)
        .where(eq(flyers.id, input.flyerId))
        .limit(1);

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Flyer not found" });
      }
      if (existing.openId !== ctx.user.openId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }

      const extMap: Record<string, string> = {
        "image/png": ".png",
        "image/jpeg": ".jpg",
        "image/webp": ".webp",
      };
      const ext = extMap[input.mimeType] || ".png";
      const id = randomBytes(8).toString("hex");
      const r2Key = `flyers/${ctx.user.openId}/${id}${ext}`;

      const raw = input.base64Data.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(raw, "base64");

      const { url } = await storagePut(r2Key, buffer, input.mimeType);

      await db
        .update(flyers)
        .set({
          thumbnailUrl: url,
          exportedUrl: url,
          r2Key,
          status: "exported",
          updatedAt: new Date(),
        })
        .where(eq(flyers.id, input.flyerId));

      return { url, r2Key };
    }),

  /**
   * share — Publish a flyer to the Shares Dashboard.
   * Creates a shareSession with sessionType = "flyer", so it appears
   * in the unified /shares page alongside listing_share, area_magnet, etc.
   */
  share: protectedProcedure
    .input(shareFlyerInput)
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      const [flyerRow] = await db
        .select()
        .from(flyers)
        .where(eq(flyers.id, input.flyerId))
        .limit(1);

      if (!flyerRow) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Flyer not found" });
      }
      if (flyerRow.openId !== ctx.user.openId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }

      if (!flyerRow.exportedUrl) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Flyer must be exported (uploaded to cloud) before sharing",
        });
      }

      // Generate share token
      const token = randomBytes(16).toString("hex");
      const now = new Date();
      const expiresAt = input.expiresInDays
        ? new Date(now.getTime() + input.expiresInDays * 24 * 60 * 60 * 1000)
        : null;

      const flyerData = flyerRow.flyerData as Record<string, unknown>;

      // Build agent branding from flyerData
      const agentBranding = {
        name: (flyerData.agentName as string) || ctx.user.name || "Agent",
        title: (flyerData.agentTitle as string) || "Real Estate Advisor",
        email: (flyerData.agentEmail as string) || ctx.user.email || "",
        phone: (flyerData.agentPhone as string) || "",
        brokerage: (flyerData.brokerageName as string) || "",
      };

      // Create share session
      await db.insert(shareSessions).values({
        token,
        status: "active",
        sessionType: "flyer",
        title: input.title || flyerRow.title,
        introMessage: null,
        clientName: null,
        createdByOpenId: ctx.user.openId,
        createdByCompanyId: null,
        createdByApiKeyId: null,
        createdByName: ctx.user.name ?? null,
        createdByEmail: ctx.user.email ?? null,
        agentBranding,
        shareConfig: {
          flyerId: flyerRow.id,
          imageUrl: flyerRow.exportedUrl,
          templateId: flyerRow.templateId,
          sizeKey: flyerRow.sizeKey,
        },
        magnetScope: null,
        magnetPayload: null,
        listingKeys: [], // flyers don't necessarily have listing keys
        tourPlan: null,
        expiresAt,
        createdAt: now,
        updatedAt: now,
      });

      // Update flyer with share token
      await db
        .update(flyers)
        .set({
          shareToken: token,
          status: "shared",
          updatedAt: now,
        })
        .where(eq(flyers.id, input.flyerId));

      return {
        token,
        shareUrl: `/s/${token}`,
        imageUrl: flyerRow.exportedUrl,
      };
    }),
});

export type FlyerRouter = typeof flyerRouter;
