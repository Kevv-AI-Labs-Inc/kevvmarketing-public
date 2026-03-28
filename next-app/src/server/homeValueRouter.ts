import { TRPCError } from "@trpc/server";
import { and, desc, eq, gte, or, sql } from "drizzle-orm";
import { z } from "zod";

import { agentProfiles, contacts, valuationRuns } from "@/lib/db/schema";
import { getDb } from "@/server/db";
import { publicProcedure, protectedProcedure, router } from "@/server/trpc";
import { createValuationRun } from "@/server/homeValue/valuationRunService";
import { generateHomeValueEstimate } from "@/server/homeValue/valuationEngine";
import { captureLead, recordClientEvent } from "@/server/leads/leadCaptureService";
import { triggerLeadAutomation } from "@/server/leads/leadAutomationService";

const slugSchema = z.object({
  slug: z.string().trim().min(2).max(64),
});

const localeSchema = z.enum(["en", "zh"]).default("en");

const runValuationInputSchema = slugSchema.extend({
  address: z.string().trim().min(5).max(1000),
  locale: localeSchema.optional(),
});

const captureLeadInputSchema = slugSchema.extend({
  valuationRunId: z.number().int(),
  name: z.string().trim().min(2).max(255),
  email: z.string().trim().email().max(320).optional(),
  phone: z.string().trim().max(64).optional(),
  timeline: z.string().trim().max(255).optional(),
  notes: z.string().trim().max(2000).optional(),
});

async function getActiveProfileBySlug(slug: string) {
  const db = getDb();
  const [profile] = await db
    .select()
    .from(agentProfiles)
    .where(eq(agentProfiles.slug, slug))
    .limit(1);

  if (!profile || profile.status !== "active") {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Home Value page is not available for this agent.",
    });
  }

  return profile;
}

export const homeValueRouter = router({
  getDashboard: protectedProcedure.query(async ({ ctx }) => {
    const db = getDb();
    const [profile] = await db
      .select()
      .from(agentProfiles)
      .where(eq(agentProfiles.userId, ctx.user.id))
      .limit(1);

    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [stats] = await db
      .select({
        valuationRequests: sql<number>`coalesce(count(distinct ${valuationRuns.id}), 0)`,
        capturedLeads: sql<number>`coalesce(count(distinct ${contacts.id}), 0)`,
      })
      .from(valuationRuns)
      .leftJoin(contacts, eq(contacts.valuationRunId, valuationRuns.id))
      .where(
        and(
          eq(valuationRuns.agentId, ctx.user.id),
          gte(valuationRuns.createdAt, since)
        )
      );

    const recentRuns = await db
      .select({
        id: valuationRuns.id,
        address: valuationRuns.address,
        createdAt: valuationRuns.createdAt,
        summary: valuationRuns.summary,
        contactId: valuationRuns.contactId,
        estimatedValue: sql<number>`${valuationRuns.result}->>'estimatedValue'`,
      })
      .from(valuationRuns)
      .where(eq(valuationRuns.agentId, ctx.user.id))
      .orderBy(desc(valuationRuns.createdAt))
      .limit(10);

    const recentSellerLeads = await db
      .select({
        id: contacts.id,
        name: contacts.name,
        email: contacts.email,
        phone: contacts.phone,
        addressLine1: contacts.addressLine1,
        area: contacts.area,
        score: contacts.score,
        createdAt: contacts.createdAt,
      })
      .from(contacts)
      .where(
        and(
          eq(contacts.agentId, ctx.user.id),
          eq(contacts.source, "home_value")
        )
      )
      .orderBy(desc(contacts.createdAt))
      .limit(8);

    return {
      profile,
      publicUrl: profile ? `/agents/${profile.slug}/home-value` : null,
      stats: {
        valuationRequests: Number(stats?.valuationRequests ?? 0),
        capturedLeads: Number(stats?.capturedLeads ?? 0),
      },
      recentRuns: recentRuns.map((item) => ({
        ...item,
        estimatedValue: Number(item.estimatedValue ?? 0),
      })),
      recentSellerLeads,
    };
  }),

  getPublicContext: publicProcedure.input(slugSchema).query(async ({ input }) => {
    const profile = await getActiveProfileBySlug(input.slug);
    return {
      slug: profile.slug,
      name: profile.name,
      email: profile.email,
      phone: profile.phone,
      title: profile.title,
      brokerage: profile.brokerage,
      bookingUrl: profile.bookingUrl,
      photoUrl: profile.photoUrl,
      serviceAreas: profile.serviceAreas,
      languages: profile.languages,
    };
  }),

  trackView: publicProcedure
    .input(slugSchema)
    .mutation(async ({ ctx, input }) => {
      const profile = await getActiveProfileBySlug(input.slug);

      await recordClientEvent({
        agentId: profile.userId ?? undefined,
        eventType: "home_value_page_view",
        eventData: {
          slug: profile.slug,
        },
        sourceType: "home_value",
        sourceId: profile.slug,
        ipAddress: ctx.ip,
        userAgent: ctx.userAgent,
      });

      return { tracked: true };
    }),

  runValuation: publicProcedure
    .input(runValuationInputSchema)
    .mutation(async ({ ctx, input }) => {
      const profile = await getActiveProfileBySlug(input.slug);
      const locale = input.locale ?? "en";
      const estimate = await generateHomeValueEstimate({
        address: input.address,
        locale,
        fallbackArea: profile.serviceAreas?.[0] ?? null,
      });

      const run = await createValuationRun({
        agentId: profile.userId ?? undefined,
        agentProfileId: profile.id,
        source: "home_value",
        status: "completed",
        locale,
        address: input.address,
        result: estimate.result,
        modelUsed: estimate.modelUsed,
        provider: estimate.provider,
        summary: estimate.summary,
      });

      await recordClientEvent({
        agentId: profile.userId ?? undefined,
        eventType: "home_value_requested",
        eventData: {
          address: input.address,
          valuationRunId: run.id,
          locale,
        },
        sourceType: "home_value",
        sourceId: String(run.id),
        sessionToken: String(run.id),
        ipAddress: ctx.ip,
        userAgent: ctx.userAgent,
      });

      return {
        valuationRunId: run.id,
        result: estimate.result,
        summary: estimate.summary,
      };
    }),

  captureLead: publicProcedure
    .input(captureLeadInputSchema)
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const profile = await getActiveProfileBySlug(input.slug);
      const [run] = await db
        .select()
        .from(valuationRuns)
        .where(
          and(
            eq(valuationRuns.id, input.valuationRunId),
            eq(valuationRuns.agentProfileId, profile.id)
          )
        )
        .limit(1);

      if (!run) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Valuation run not found.",
        });
      }

      const lead = await captureLead(
        {
          agentId: profile.userId ?? undefined,
          agentProfileId: profile.id,
          valuationRunId: run.id,
          source: "home_value",
          sourceRef: profile.slug,
          name: input.name,
          email: input.email,
          phone: input.phone,
          area: profile.serviceAreas?.[0] ?? undefined,
          timeline: input.timeline,
          summary: `Seller valuation lead for ${run.address}`,
          notes: input.notes ?? run.summary ?? undefined,
          intent: "selling",
          score: "hot",
          tags: ["seller", "valuation", "high-intent"],
          preferredLanguage: run.locale as "en" | "zh",
          addressLine1: run.address,
          eventType: "home_value_gate_submit",
          eventData: {
            valuationRunId: run.id,
            address: run.address,
          },
          sourceId: String(run.id),
          sessionToken: String(run.id),
          ipAddress: ctx.ip ?? undefined,
          userAgent: ctx.userAgent ?? undefined,
        },
        db
      );

      await db
        .update(contacts)
        .set({
          valuationRunId: run.id,
          updatedAt: new Date(),
        })
        .where(eq(contacts.id, lead.id));

      await db
        .update(valuationRuns)
        .set({
          contactId: lead.id,
          updatedAt: new Date(),
        })
        .where(eq(valuationRuns.id, run.id));

      await triggerLeadAutomation(
        {
          agentId: profile.userId,
          contactId: lead.id,
          source: "home_value",
          title: `${lead.name || "New seller lead"} requested a home valuation`,
          description: `${run.address} came through the public Home Value funnel and is tagged as a high-intent seller lead.`,
          priority: "high",
          suggestedAction: "contact_now",
          actionData: {
            valuationRunId: run.id,
            address: run.address,
          },
        },
        db
      );

      return {
        ok: true,
        contactId: lead.id,
      };
    }),
});
