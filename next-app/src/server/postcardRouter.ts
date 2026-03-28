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

export const postcardRouter = router({
  getWorkspace: protectedProcedure.query(async ({ ctx }) => {
    const [templates, contacts, campaigns] = await Promise.all([
      listPostcardTemplates(ctx.user.id),
      listPostcardContacts(ctx.user.id),
      listPostcardCampaigns(ctx.user.id),
    ]);

    const verifiedContacts = contacts.filter((contact) => contact.addressVerified).length;

    return {
      templates,
      contacts,
      campaigns,
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
});
