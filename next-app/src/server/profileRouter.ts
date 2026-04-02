import { TRPCError } from "@trpc/server";
import { and, desc, eq, gte, or, sql } from "drizzle-orm";
import { z } from "zod";

import {
  agentProfiles,
  clientEvents,
  contacts,
  conversationMessages,
  conversationSessions,
} from "@/lib/db/schema";
import { getDb } from "@/server/db";
import { publicProcedure, protectedProcedure, router } from "@/server/trpc";
import {
  appendConversationMessage,
  createConversationSession,
  getConversationSessionByKey,
  linkContactToConversationSession,
  updateConversationSummary,
} from "@/server/conversations/conversationService";
import { buildDemoAgentProfile } from "@/server/demo/factories";
import { triggerLeadAutomation } from "@/server/leads/leadAutomationService";
import { captureLead, recordClientEvent } from "@/server/leads/leadCaptureService";
import { generateAgentSiteChatReply } from "@/server/agentSite/chatService";
import { recalculateScore } from "@/server/tracking/engagementScorer";
import {
  agentSiteTemplateIds,
  buildAgentSlug,
} from "@/lib/agent-site";
import { getPresignedPutUrl, isR2Configured } from "@/server/storage";
import { assertPublicEventRateLimit } from "@/server/security/publicRateLimit";


const slugSchema = z.object({
  slug: z.string().trim().min(2).max(64),
});

const socialLinksSchema = z.record(z.string(), z.string().trim().max(2000));

const testimonialSchema = z.object({
  name: z.string().trim().min(1).max(120),
  text: z.string().trim().min(1).max(1200),
  rating: z.number().min(1).max(5).default(5),
});

const transactionSchema = z.object({
  address: z.string().trim().min(1).max(255),
  city: z.string().trim().max(120).default(""),
  price: z.string().trim().max(60).default(""),
  type: z.string().trim().max(60).default("Seller"),
});

const visibilitySettingsSchema = z.object({
  showPhone: z.boolean(),
  showEmail: z.boolean(),
  showTransactions: z.boolean(),
  showAwards: z.boolean(),
  showTestimonials: z.boolean(),
  showAddress: z.boolean(),
});

const chatSettingsSchema = z.object({
  enabled: z.boolean().default(true),
  widgetLabel: z.string().trim().max(80).default(""),
  greeting: z.string().trim().max(1200).default(""),
  systemPrompt: z.string().trim().max(4000).default(""),
  style: z.enum(["professional", "friendly", "bilingual"]).default("professional"),
  suggestedPrompts: z.array(z.string().trim().max(200)).max(3).default([]),
});

const profileInputSchema = z.object({
  slug: z.string().trim().min(2).max(64),
  email: z.string().trim().email().max(320),
  name: z.string().trim().min(2).max(255),
  phone: z.string().trim().max(64).optional(),
  title: z.string().trim().max(128).optional(),
  brokerage: z.string().trim().max(255).optional(),
  licenseState: z.string().trim().max(16).optional(),
  officeAddress: z.string().trim().max(255).optional(),
  bookingUrl: z.string().trim().max(2000).optional(),
  photoUrl: z.string().trim().max(2000).optional(),
  heroImageUrl: z.string().trim().max(2000).optional(),
  bio: z.string().trim().max(4000).optional(),
  serviceAreas: z.array(z.string().trim().min(1).max(80)).max(24),
  specialties: z.array(z.string().trim().min(1).max(80)).max(24),
  languages: z.array(z.string().trim().min(1).max(80)).max(12),
  awards: z.array(z.string().trim().min(1).max(160)).max(20),
  testimonials: z.array(testimonialSchema).max(12),
  transactions: z.array(transactionSchema).max(20),
  socialLinks: socialLinksSchema.optional(),
  visibilitySettings: visibilitySettingsSchema,
  yearsExperience: z.number().int().min(0).max(60),
  templateId: z.enum(agentSiteTemplateIds),
  colorScheme: z.string().trim().max(32).optional(),
  chatSettings: chatSettingsSchema.optional(),
  status: z.enum(["draft", "active", "suspended"]).default("active"),
  tier: z.enum(["free", "pro", "premium"]).default("free"),
});

const trackViewInputSchema = slugSchema.extend({
  pagePath: z.string().trim().max(255).optional(),
  referrer: z.string().trim().max(512).optional(),
});

const submitInquiryInputSchema = slugSchema.extend({
  senderName: z.string().trim().min(2).max(255),
  senderEmail: z.string().trim().email().max(320),
  senderPhone: z.string().trim().max(64).optional(),
  subject: z.string().trim().min(2).max(255),
  message: z.string().trim().min(5).max(4000),
  area: z.string().trim().max(255).optional(),
  timeline: z.string().trim().max(255).optional(),
});

const sendChatMessageInputSchema = slugSchema.extend({
  message: z.string().trim().min(1).max(2000),
  sessionKey: z.string().trim().max(64).optional(),
  pagePath: z.string().trim().max(255).optional(),
  visitorName: z.string().trim().max(255).optional(),
  visitorEmail: z.string().trim().email().max(320).optional(),
  visitorPhone: z.string().trim().max(64).optional(),
});

const captureChatLeadInputSchema = slugSchema.extend({
  sessionKey: z.string().trim().max(64).optional(),
  name: z.string().trim().min(2).max(255),
  email: z.string().trim().email().max(320).optional(),
  phone: z.string().trim().max(64).optional(),
  notes: z.string().trim().max(2000).optional(),
});

function normalizeOptional(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

function buildDraftProfile(user: { id: number; name: string | null; email: string | null }) {
  const baseName =
    user.name?.trim() || user.email?.split("@")[0]?.replace(/[._-]+/g, " ") || "Kevv Agent";

  return buildDemoAgentProfile({
    id: 0,
    userId: user.id,
    name: baseName,
    email: user.email ?? "agent@kevv.ai",
    slug: buildAgentSlug(baseName),
    phone: "",
    title: "AI-powered real estate advisor",
    brokerage: "Kevv Marketing",
    bio: "Use this page as your public seller and buyer funnel. Position your market, route visitors into chat, and convert interest into structured leads.",
    serviceAreas: ["Palo Alto", "Menlo Park", "Los Altos"],
    specialties: ["Seller Strategy", "Buyer Guidance", "AI Marketing"],
    languages: ["English", "中文"],
    awards: [],
    testimonials: [],
    transactions: [],
    socialLinks: {},
    yearsExperience: 8,
    templateId: "classic",
    colorScheme: "gold",
    tier: "pro",
  });
}

async function getProfileBySlug(slug: string) {
  const db = getDb();
  const rows = await db
    .select()
    .from(agentProfiles)
    .where(eq(agentProfiles.slug, slug))
    .limit(1);

  return rows[0] ?? null;
}

async function requirePublicProfile(slug: string) {
  const profile = await getProfileBySlug(slug);
  if (!profile || profile.status !== "active") {
    throw new TRPCError({ code: "NOT_FOUND", message: "Agent profile not found" });
  }
  return profile;
}

export const profileRouter = router({
  getMine: protectedProcedure.query(async ({ ctx }) => {
    const db = getDb();
    const [existing] = await db
      .select()
      .from(agentProfiles)
      .where(eq(agentProfiles.userId, ctx.user.id))
      .limit(1);

    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [analyticsRow] = await db
      .select({
        profileViews: sql<number>`coalesce(sum(case when ${clientEvents.eventType} = 'agent_profile_view' then 1 else 0 end), 0)`,
        chatMessages: sql<number>`coalesce(sum(case when ${clientEvents.eventType} = 'agent_chat_message' then 1 else 0 end), 0)`,
        inquiries: sql<number>`coalesce(sum(case when ${clientEvents.eventType} in ('agent_site_inquiry', 'agent_chat_lead_capture') then 1 else 0 end), 0)`,
      })
      .from(clientEvents)
      .where(and(eq(clientEvents.agentId, ctx.user.id), gte(clientEvents.createdAt, since)));

    const recentLeads = await db
      .select({
        id: contacts.id,
        name: contacts.name,
        email: contacts.email,
        phone: contacts.phone,
        source: contacts.source,
        score: contacts.score,
        intent: contacts.intent,
        area: contacts.area,
        updatedAt: contacts.updatedAt,
      })
      .from(contacts)
      .where(
        and(
          eq(contacts.agentId, ctx.user.id),
          or(eq(contacts.source, "agent_site_form"), eq(contacts.source, "agent_site_chat"))
        )
      )
      .orderBy(desc(contacts.updatedAt))
      .limit(8);

    const profile = existing ?? buildDraftProfile(ctx.user);

    return {
      profile,
      isPersisted: Boolean(existing),
      publicUrl: `/agents/${profile.slug}`,
      homeValueUrl: `/agents/${profile.slug}/home-value`,
      analytics: {
        profileViews: Number(analyticsRow?.profileViews ?? 0),
        chatMessages: Number(analyticsRow?.chatMessages ?? 0),
        inquiries: Number(analyticsRow?.inquiries ?? 0),
      },
      recentLeads,
    };
  }),

  upsertMine: protectedProcedure
    .input(profileInputSchema)
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const slug = buildAgentSlug(input.slug);
      const [existing] = await db
        .select()
        .from(agentProfiles)
        .where(eq(agentProfiles.userId, ctx.user.id))
        .limit(1);

      const conflictingSlug = await getProfileBySlug(slug);
      if (conflictingSlug && conflictingSlug.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "That public slug is already in use.",
        });
      }

      const payload = {
        userId: ctx.user.id,
        slug,
        email: input.email,
        name: input.name,
        phone: normalizeOptional(input.phone),
        title: normalizeOptional(input.title) ?? "Licensed Real Estate Agent",
        brokerage: normalizeOptional(input.brokerage),
        licenseState: normalizeOptional(input.licenseState),
        officeAddress: normalizeOptional(input.officeAddress),
        bookingUrl: normalizeOptional(input.bookingUrl),
        photoUrl: normalizeOptional(input.photoUrl),
        heroImageUrl: normalizeOptional(input.heroImageUrl),
        bio: normalizeOptional(input.bio),
        serviceAreas: input.serviceAreas,
        specialties: input.specialties,
        languages: input.languages,
        awards: input.awards,
        testimonials: input.testimonials,
        transactions: input.transactions,
        socialLinks: input.socialLinks ?? {},
        visibilitySettings: input.visibilitySettings,
        yearsExperience: input.yearsExperience,
        templateId: input.templateId,
        colorScheme: normalizeOptional(input.colorScheme) ?? "gold",
        chatSettings: input.chatSettings ?? null,
        status: input.status,

        tier: input.tier,
        lastPublishedAt: new Date(),
        updatedAt: new Date(),
      };

      const [profile] = existing
        ? await db
            .update(agentProfiles)
            .set(payload)
            .where(eq(agentProfiles.userId, ctx.user.id))
            .returning()
        : await db
            .insert(agentProfiles)
            .values({
              ...payload,
              createdAt: new Date(),
            })
            .returning();

      return {
        profile,
        publicUrl: `/agents/${profile.slug}`,
        homeValueUrl: `/agents/${profile.slug}/home-value`,
      };
    }),

  getPublicBySlug: publicProcedure.input(slugSchema).query(async ({ input }) => {
    return getProfileBySlug(input.slug);
  }),

  trackView: publicProcedure
    .input(trackViewInputSchema)
    .mutation(async ({ ctx, input }) => {
      const profile = await requirePublicProfile(input.slug);

      await recordClientEvent({
        agentId: profile.userId ?? undefined,
        eventType: "agent_profile_view",
        eventData: {
          slug: profile.slug,
          templateId: profile.templateId,
          pagePath: input.pagePath ?? `/agents/${profile.slug}`,
          referrer: input.referrer ?? null,
        },
        sourceType: "agent_site",
        sourceId: profile.slug,
        ipAddress: ctx.ip,
        userAgent: ctx.userAgent,
      });

      return { tracked: true };
    }),

  submitInquiry: publicProcedure
    .input(submitInquiryInputSchema)
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const profile = await requirePublicProfile(input.slug);
      await assertPublicEventRateLimit({
        db,
        ipAddress: ctx.ip,
        eventType: "agent_site_inquiry",
        sourceType: "agent_site_form",
        sourceId: profile.slug,
        windowMs: 60 * 60 * 1000,
        maxRequests: 5,
        message: "Too many inquiries from this IP. Please try again later.",
      });
      const firstName = input.senderName.split(" ")[0] ?? input.senderName;

      const contact = await captureLead(
        {
          agentId: profile.userId ?? undefined,
          agentProfileId: profile.id,
          source: "agent_site_form",
          sourceRef: profile.slug,
          name: input.senderName,
          firstName,
          email: input.senderEmail,
          phone: input.senderPhone,
          area: input.area,
          timeline: input.timeline,
          summary: `${input.subject}: ${input.message}`,
          notes: input.message,
          intent: /sell|selling|seller|估值|卖房/i.test(input.message) ? "selling" : "buying",
          score: /call|showing|tour|schedule|book|ready|尽快|联系/i.test(input.message) ? "hot" : "warm",
          tags: ["agent-site", "contact-form"],
          preferredLanguage: /[\u4e00-\u9fff]/.test(input.message) ? "zh" : "en",
          eventType: "agent_site_inquiry",
          eventData: {
            subject: input.subject,
            message: input.message,
          },
          ipAddress: ctx.ip ?? undefined,
          userAgent: ctx.userAgent ?? undefined,
        },
        db
      );

      await triggerLeadAutomation(
        {
          agentId: profile.userId,
          contactId: contact.id,
          source: "agent_site_form",
          title: `${contact.name || "New lead"} submitted an agent-site inquiry`,
          description: `${input.subject} came in through the public profile form for ${profile.slug}.`,
          priority: contact.score === "hot" ? "high" : "medium",
          suggestedAction: "contact_now",
          actionData: {
            subject: input.subject,
          },
        },
        db
      );

      await recalculateScore(contact.id, profile.userId ?? undefined);

      return {
        ok: true,
        contactId: contact.id,
        agentName: profile.name,
      };
    }),

  sendChatMessage: publicProcedure
    .input(sendChatMessageInputSchema)
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const profile = await requirePublicProfile(input.slug);
      await assertPublicEventRateLimit({
        db,
        ipAddress: ctx.ip,
        eventType: "agent_chat_message",
        sourceType: "agent_site_chat",
        sourceId: profile.slug,
        windowMs: 10 * 60 * 1000,
        maxRequests: 12,
        message: "Too many chat messages from this IP. Please try again shortly.",
      });

      const existingSession = input.sessionKey
        ? await getConversationSessionByKey(input.sessionKey, db)
        : null;

      const session =
        existingSession ??
        (await createConversationSession(
          {
            agentId: profile.userId ?? undefined,
            agentProfileId: profile.id,
            source: "agent_site_chat",
            visitorName: input.visitorName,
            visitorEmail: input.visitorEmail,
            visitorPhone: input.visitorPhone,
            pagePath: input.pagePath ?? `/agents/${profile.slug}`,
            detectedLanguage: /[\u4e00-\u9fff]/.test(input.message) ? "zh" : "en",
          },
          db
        ));

      await appendConversationMessage(
        {
          sessionId: session.id,
          role: "user",
          content: input.message,
          metadata: {
            pagePath: input.pagePath ?? `/agents/${profile.slug}`,
          },
        },
        db
      );

      const reply = await generateAgentSiteChatReply({
        profile: {
          slug: profile.slug,
          name: profile.name,
          title: profile.title,
          brokerage: profile.brokerage,
          bio: profile.bio,
          bookingUrl: profile.bookingUrl,
          serviceAreas: profile.serviceAreas,
          specialties: profile.specialties,
          languages: profile.languages,
          yearsExperience: profile.yearsExperience,
          transactions: profile.transactions,
          chatSettings: profile.chatSettings,
        },
        message: input.message,
      });

      await appendConversationMessage(
        {
          sessionId: session.id,
          role: "assistant",
          content: reply.response,
          metadata: {
            listings: reply.listings,
            intent: reply.intent,
            score: reply.score,
          },
        },
        db
      );

      await updateConversationSummary(
        session.id,
        `${reply.summary} Latest visitor message: ${input.message.slice(0, 180)}`,
        db
      );

      await recordClientEvent(
        {
          agentId: profile.userId ?? undefined,
          contactId: session.contactId ?? undefined,
          eventType: "agent_chat_message",
          eventData: {
            slug: profile.slug,
            intent: reply.intent,
            score: reply.score,
            area: reply.area,
            timeline: reply.timeline,
          },
          sourceType: "agent_site_chat",
          sourceId: session.sessionKey,
          sessionToken: session.sessionKey,
          ipAddress: ctx.ip,
          userAgent: ctx.userAgent,
        },
        db
      );

      if (input.visitorEmail || input.visitorPhone) {
        const contact = await captureLead(
          {
            agentId: profile.userId ?? undefined,
            agentProfileId: profile.id,
            conversationSessionId: session.id,
            source: "agent_site_chat",
            sourceRef: profile.slug,
            name: input.visitorName,
            email: input.visitorEmail,
            phone: input.visitorPhone,
            summary: reply.summary,
            intent: reply.intent,
            score: reply.score,
            area: reply.area ?? undefined,
            timeline: reply.timeline ?? undefined,
            tags: ["agent-site", "chat"],
            preferredLanguage: reply.language,
            eventType: "agent_chat_lead_capture",
            eventData: {
              capturedVia: "chat-message",
            },
            sessionToken: session.sessionKey,
            ipAddress: ctx.ip ?? undefined,
            userAgent: ctx.userAgent ?? undefined,
          },
          db
        );

        await linkContactToConversationSession(session.id, contact.id, db);
        await triggerLeadAutomation(
          {
            agentId: profile.userId,
            contactId: contact.id,
            source: "agent_site_chat",
            title: `${contact.name || "New lead"} shared contact info in chat`,
            description: `Visitor contact details were captured from the AI chat on ${profile.slug}.`,
            priority: reply.score === "hot" ? "high" : "medium",
            suggestedAction: "contact_now",
            actionData: {
              sessionKey: session.sessionKey,
            },
          },
          db
        );
        await recalculateScore(contact.id, profile.userId ?? undefined);
      }

      return {
        sessionKey: session.sessionKey,
        response: reply.response,
        detectedLanguage: reply.language,
        suggestedPrompts: reply.suggestedPrompts,
        leadSignal: {
          score: reply.score,
          intent: reply.intent,
          area: reply.area,
          timeline: reply.timeline,
        },
        listings: reply.listings,
      };
    }),

  captureChatLead: publicProcedure
    .input(captureChatLeadInputSchema)
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const profile = await requirePublicProfile(input.slug);
      const session = input.sessionKey
        ? await getConversationSessionByKey(input.sessionKey, db)
        : null;

      const recentMessages = session
        ? await db
            .select({
              role: conversationMessages.role,
              content: conversationMessages.content,
            })
            .from(conversationMessages)
            .where(eq(conversationMessages.sessionId, session.id))
            .orderBy(desc(conversationMessages.id))
            .limit(4)
        : [];

      const notes = [
        input.notes,
        session?.summary,
        recentMessages
          .slice()
          .reverse()
          .map((item) => `${item.role}: ${item.content}`)
          .join("\n"),
      ]
        .filter(Boolean)
        .join("\n\n");

      const contact = await captureLead(
        {
          agentId: profile.userId ?? undefined,
          agentProfileId: profile.id,
          conversationSessionId: session?.id,
          source: "agent_site_chat",
          sourceRef: profile.slug,
          name: input.name,
          email: input.email,
          phone: input.phone,
          summary: session?.summary ?? normalizeOptional(input.notes) ?? "Chat lead captured from public profile.",
          notes,
          intent: /sell|selling|seller|估值|卖房/i.test(notes) ? "selling" : "buying",
          score: /ready|showing|tour|schedule|book|valuation|尽快|联系/i.test(notes) ? "hot" : "warm",
          tags: ["agent-site", "chat"],
          preferredLanguage: /[\u4e00-\u9fff]/.test(notes) ? "zh" : "en",
          eventType: "agent_chat_lead_capture",
          eventData: {
            capturedVia: "chat-widget",
          },
          sessionToken: session?.sessionKey ?? undefined,
          ipAddress: ctx.ip ?? undefined,
          userAgent: ctx.userAgent ?? undefined,
        },
        db
      );

      if (session) {
        await linkContactToConversationSession(session.id, contact.id, db);
        await db
          .update(conversationSessions)
          .set({
            visitorName: input.name,
            visitorEmail: normalizeOptional(input.email),
            visitorPhone: normalizeOptional(input.phone),
            updatedAt: new Date(),
          })
          .where(eq(conversationSessions.id, session.id));
      }

      await triggerLeadAutomation(
        {
          agentId: profile.userId,
          contactId: contact.id,
          source: "agent_site_chat",
          title: `${contact.name || "New lead"} completed the chat lead gate`,
          description: `The public profile chat on ${profile.slug} produced a captured lead.`,
          priority: contact.score === "hot" ? "high" : "medium",
          suggestedAction: "contact_now",
          actionData: {
            sessionKey: session?.sessionKey ?? null,
          },
        },
        db
      );
      await recalculateScore(contact.id, profile.userId ?? undefined);

      return {
        ok: true,
        contactId: contact.id,
      };
    }),
  /**
   * Generate a presigned PUT URL so the browser can upload directly to R2.
   * Returns { uploadUrl, publicUrl } when R2 is configured,
   * or { configured: false } when credentials are missing (dev fallback).
   */
  getUploadUrl: protectedProcedure
    .input(
      z.object({
        /** Destination sub-path e.g. "photo" | "hero" */
        field: z.enum(["photo", "hero", "general"]),
        /** Original filename — used to derive content-type */
        filename: z.string().trim().min(1).max(255),
        contentType: z.string().trim().min(1).max(128),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!isR2Configured()) {
        return { configured: false as const, uploadUrl: null, publicUrl: null };
      }

      // Sanitize the extension from the original filename
      const ext = input.filename.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") ?? "bin";
      const key = `uploads/profiles/${ctx.user.id}/${input.field}-${Date.now()}.${ext}`;

      const { uploadUrl, publicUrl } = await getPresignedPutUrl(key, input.contentType, 300);

      return { configured: true as const, uploadUrl, publicUrl };
    }),
});
