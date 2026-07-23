import { and, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { z } from "zod";

import {
  agentInsights,
  contacts,
  dripCampaigns,
  engagementScores,
} from "@/lib/db/schema";
import { getDb } from "@/server/db";
import { protectedProcedure, router } from "@/server/trpc";
import { enrollContactsInDripCampaign } from "@/server/leads/leadAutomationService";
import { createDraftPostcardCampaign, listPostcardTemplates } from "@/server/postcards/postcardService";

export const leadCaptureRouter = router({
  dashboard: protectedProcedure
    .input(
      z.object({
        query: z.string().trim().max(255).optional(),
        source: z.string().trim().max(64).optional(),
        status: z
          .enum(["new", "contacted", "qualified", "converted", "lost", "archived"])
          .optional(),
        limit: z.number().min(1).max(200).default(80),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const conditions = [eq(contacts.agentId, ctx.user.id)];

      if (input?.source) {
        conditions.push(eq(contacts.source, input.source));
      }
      if (input?.status) {
        conditions.push(eq(contacts.status, input.status));
      }
      if (input?.query) {
        conditions.push(
          or(
            ilike(contacts.name, `%${input.query}%`),
            ilike(contacts.email, `%${input.query}%`),
            ilike(contacts.phone, `%${input.query}%`),
            ilike(contacts.area, `%${input.query}%`)
          )!
        );
      }

      const leadRows = await db
        .select()
        .from(contacts)
        .where(and(...conditions))
        .orderBy(desc(contacts.updatedAt))
        .limit(input?.limit ?? 80);

      const sourceRows = await db
        .select({
          source: contacts.source,
          count: sql<number>`count(*)`,
        })
        .from(contacts)
        .where(eq(contacts.agentId, ctx.user.id))
        .groupBy(contacts.source);

      const scoreRows =
        leadRows.length > 0
          ? await db
              .select()
              .from(engagementScores)
              .where(inArray(engagementScores.contactId, leadRows.map((lead) => lead.id)))
          : [];

      const scoresByContactId = new Map(
        scoreRows.map((row) => [row.contactId, row])
      );

      const recentInsights = await db
        .select()
        .from(agentInsights)
        .where(eq(agentInsights.agentId, ctx.user.id))
        .orderBy(desc(agentInsights.createdAt))
        .limit(8);

      const dripOptions = await db
        .select({
          id: dripCampaigns.id,
          name: dripCampaigns.name,
          status: dripCampaigns.status,
          totalEnrollments: dripCampaigns.totalEnrollments,
        })
        .from(dripCampaigns)
        .where(eq(dripCampaigns.agentId, ctx.user.id))
        .orderBy(desc(dripCampaigns.updatedAt))
        .limit(12);

      const postcardTemplates = await listPostcardTemplates(ctx.user.id);

      const defaultSources = [
        "agent_site_chat",
        "agent_site_form",
        "area_magnet",
        "magic_share",
        "postcard_import",
      ];

      const sourceBreakdown = defaultSources.map((source) => ({
        source,
        count: Number(sourceRows.find((row) => row.source === source)?.count ?? 0),
      }));

      return {
        leads: leadRows.map((lead) => ({
          ...lead,
          engagementScore: scoresByContactId.get(lead.id)?.score ?? 0,
        })),
        sourceBreakdown,
        recentInsights,
        dripOptions,
        postcardTemplates,
      };
    }),

  list: protectedProcedure
    .input(
      z.object({
        query: z.string().trim().max(255).optional(),
        source: z.string().trim().max(64).optional(),
        status: z
          .enum(["new", "contacted", "qualified", "converted", "lost", "archived"])
          .optional(),
        limit: z.number().min(1).max(100).default(50),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const conditions = [eq(contacts.agentId, ctx.user.id)];

      if (input?.source) {
        conditions.push(eq(contacts.source, input.source));
      }
      if (input?.status) {
        conditions.push(eq(contacts.status, input.status));
      }
      if (input?.query) {
        conditions.push(
          or(
            ilike(contacts.name, `%${input.query}%`),
            ilike(contacts.email, `%${input.query}%`),
            ilike(contacts.phone, `%${input.query}%`),
            ilike(contacts.area, `%${input.query}%`)
          )!
        );
      }

      return db
        .select()
        .from(contacts)
        .where(and(...conditions))
        .orderBy(desc(contacts.updatedAt))
        .limit(input?.limit ?? 50);
    }),

  createPostcardDraftFromContacts: protectedProcedure
    .input(
      z.object({
        name: z.string().trim().min(2).max(255),
        templateId: z.number().int(),
        contactIds: z.array(z.number().int()).min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return createDraftPostcardCampaign({
        agentId: ctx.user.id,
        name: input.name,
        templateId: input.templateId,
        contactIds: input.contactIds,
      });
    }),

  enrollInDrip: protectedProcedure
    .input(
      z.object({
        campaignId: z.number().int(),
        contactIds: z.array(z.number().int()).min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const validContacts = await db
        .select({ id: contacts.id })
        .from(contacts)
        .where(and(eq(contacts.agentId, ctx.user.id), inArray(contacts.id, input.contactIds)));

      return enrollContactsInDripCampaign(
        {
          agentId: ctx.user.id,
          campaignId: input.campaignId,
          contactIds: validContacts.map((contact) => contact.id),
          source: "lead_workspace",
        },
        db
      );
    }),

  updateStatus: protectedProcedure
    .input(
      z.object({
        contactId: z.number().int(),
        status: z.enum(["new", "contacted", "qualified", "converted", "lost", "archived"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const [contact] = await db
        .update(contacts)
        .set({
          status: input.status,
          updatedAt: new Date(),
        })
        .where(and(eq(contacts.id, input.contactId), eq(contacts.agentId, ctx.user.id)))
        .returning();

      if (!contact) {
        throw new Error("Contact not found");
      }

      return contact;
    }),
});
