import { z } from "zod";

import { protectedProcedure, router } from "@/server/trpc";
import {
  createDraftPostcardCampaign,
  createManualPostcardContact,
  generatePostcardCopy,
  importPostcardContactsFromCsv,
  listPostcardCampaigns,
  listPostcardContacts,
  listPostcardTemplates,
  launchPostcardCampaign,
} from "@/server/postcards/postcardService";
import {
  scanZipcodeAudience,
  listAudienceLists,
} from "@/server/postcards/audienceEngine";
import {
  createAutomation,
  listAutomations,
  updateAutomationStatus,
  createJustSoldCampaign,
} from "@/server/postcards/automationEngine";

export const postcardRouter = router({
  getWorkspace: protectedProcedure.query(async ({ ctx }) => {
    const [templates, contacts, campaigns, audienceLists, automations] = await Promise.all([
      listPostcardTemplates(ctx.user.id),
      listPostcardContacts(ctx.user.id),
      listPostcardCampaigns(ctx.user.id),
      listAudienceLists(ctx.user.id),
      listAutomations(ctx.user.id),
    ]);

    const verifiedContacts = contacts.filter((contact) => contact.addressVerified).length;

    return {
      templates,
      contacts,
      campaigns,
      audienceLists,
      automations,
      stats: {
        totalContacts: contacts.length,
        verifiedContacts,
        deliverabilityRate: contacts.length ? Math.round((verifiedContacts / contacts.length) * 100) : 0,
      },
    };
  }),

  importCsv: protectedProcedure
    .input(z.object({ csvText: z.string().trim().min(5) }))
    .mutation(async ({ ctx, input }) => {
      return importPostcardContactsFromCsv(ctx.user.id, input.csvText);
    }),

  createManualContact: protectedProcedure
    .input(
      z.object({
        fullName: z.string().trim().min(2).max(255),
        addressLine1: z.string().trim().min(4).max(255),
        addressLine2: z.string().trim().max(255).optional(),
        city: z.string().trim().min(2).max(120),
        state: z.string().trim().min(2).max(2),
        postalCode: z.string().trim().min(5).max(10),
        tags: z.array(z.string().trim().min(1).max(64)).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return createManualPostcardContact({
        agentId: ctx.user.id,
        ...input,
      });
    }),

  generateCopy: protectedProcedure
    .input(
      z.object({
        prompt: z.string().trim().min(4).max(500),
        templateName: z.string().trim().min(2).max(255),
        language: z.enum(["en", "zh", "zh_en"]).default("en"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return generatePostcardCopy({
        agentId: ctx.user.id,
        agentName: ctx.user.name || "Kevv Agent",
        ...input,
      });
    }),

  createCampaign: protectedProcedure
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
        ...input,
      });
    }),

  launchCampaign: protectedProcedure
    .input(
      z.object({
        campaignId: z.number().int(),
        sendStrategy: z.enum(["send_now", "scheduled", "arrive_by"]).default("send_now"),
        scheduledAt: z.string().datetime().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return launchPostcardCampaign({
        agentId: ctx.user.id,
        campaignId: input.campaignId,
        sendStrategy: input.sendStrategy,
        scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
      });
    }),

  // ─── Audience Engine ──────────────────────────────────────

  scanZipcode: protectedProcedure
    .input(
      z.object({
        name: z.string().trim().min(2).max(255),
        zipCodes: z.array(z.string().trim().min(5).max(10)).min(1).max(20),
        listingStatus: z.string().trim().max(30).optional(),
        propertyTypes: z.array(z.string().trim().max(50)).optional(),
        minPrice: z.number().min(0).optional(),
        maxPrice: z.number().min(0).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return scanZipcodeAudience({
        agentId: ctx.user.id,
        name: input.name,
        zipCodes: input.zipCodes,
        listingStatus: input.listingStatus,
        propertyTypes: input.propertyTypes,
        minPrice: input.minPrice,
        maxPrice: input.maxPrice,
      });
    }),

  // ─── Automations ──────────────────────────────────────────

  createAutomation: protectedProcedure
    .input(
      z.object({
        name: z.string().trim().min(2).max(255),
        triggerType: z.enum(["closed_deal_milestone", "listing_event", "recurring_schedule"]),
        channel: z.enum(["postcard", "letter"]).optional(),
        templateId: z.number().int().optional(),
        milestoneRules: z.array(z.object({
          daysAfterClose: z.number().int().min(0),
          templateId: z.number().int().optional(),
          label: z.string().trim().min(1).max(255),
          channel: z.enum(["postcard", "letter"]).optional(),
        })).optional(),
        audienceFilter: z.object({
          zipCodes: z.array(z.string()).optional(),
          tags: z.array(z.string()).optional(),
          source: z.string().optional(),
          listingStatus: z.string().optional(),
        }).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return createAutomation({
        agentId: ctx.user.id,
        ...input,
      });
    }),

  updateAutomationStatus: protectedProcedure
    .input(
      z.object({
        automationId: z.number().int(),
        status: z.enum(["active", "paused", "archived"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return updateAutomationStatus({
        agentId: ctx.user.id,
        automationId: input.automationId,
        status: input.status,
      });
    }),

  createJustSoldCampaign: protectedProcedure
    .input(
      z.object({
        listingKey: z.string().trim().min(1),
        address: z.string().trim().min(1).max(255),
        city: z.string().trim().min(1).max(120),
        state: z.string().trim().min(2).max(2),
        postalCode: z.string().trim().min(5).max(10),
        soldPrice: z.string().trim().optional(),
        templateId: z.number().int().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return createJustSoldCampaign({
        agentId: ctx.user.id,
        ...input,
      });
    }),
});
