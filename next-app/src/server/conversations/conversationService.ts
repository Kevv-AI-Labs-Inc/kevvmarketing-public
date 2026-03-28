import { randomBytes } from "node:crypto";

import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, type Db } from "@/lib/db";
import {
  conversationMessages,
  conversationSessions,
  type ConversationSession,
} from "@/lib/db/schema";

export const createConversationSessionInputSchema = z.object({
  agentId: z.number().int().optional(),
  agentProfileId: z.number().int().optional(),
  contactId: z.number().int().optional(),
  source: z.string().trim().min(2).max(64).default("agent_site_chat"),
  visitorId: z.string().trim().max(64).optional(),
  visitorName: z.string().trim().max(255).optional(),
  visitorEmail: z.string().trim().email().max(320).optional(),
  visitorPhone: z.string().trim().max(64).optional(),
  detectedLanguage: z.string().trim().max(10).optional(),
  pagePath: z.string().trim().max(255).optional(),
  referrer: z.string().trim().max(512).optional(),
  utmSource: z.string().trim().max(128).optional(),
  utmMedium: z.string().trim().max(128).optional(),
  utmCampaign: z.string().trim().max(128).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const appendConversationMessageInputSchema = z.object({
  sessionId: z.number().int(),
  role: z.enum(["system", "user", "assistant"]),
  content: z.string().trim().min(1).max(20000),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

function normalizeOptional(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

export function createSessionKey() {
  return randomBytes(16).toString("hex");
}

export async function createConversationSession(
  rawInput: z.infer<typeof createConversationSessionInputSchema>,
  db: Db = getDb()
) {
  const input = createConversationSessionInputSchema.parse(rawInput);
  const [session] = await db
    .insert(conversationSessions)
    .values({
      sessionKey: createSessionKey(),
      agentId: input.agentId ?? null,
      agentProfileId: input.agentProfileId ?? null,
      contactId: input.contactId ?? null,
      source: input.source,
      visitorId: normalizeOptional(input.visitorId),
      visitorName: normalizeOptional(input.visitorName),
      visitorEmail: normalizeOptional(input.visitorEmail),
      visitorPhone: normalizeOptional(input.visitorPhone),
      detectedLanguage: normalizeOptional(input.detectedLanguage) ?? "en",
      pagePath: normalizeOptional(input.pagePath),
      referrer: normalizeOptional(input.referrer),
      utmSource: normalizeOptional(input.utmSource),
      utmMedium: normalizeOptional(input.utmMedium),
      utmCampaign: normalizeOptional(input.utmCampaign),
      metadata: input.metadata ?? {},
      lastMessageAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  return session;
}

export async function getConversationSessionByKey(
  sessionKey: string,
  db: Db = getDb()
) {
  const rows = await db
    .select()
    .from(conversationSessions)
    .where(eq(conversationSessions.sessionKey, sessionKey))
    .limit(1);

  return rows[0] ?? null;
}

export async function appendConversationMessage(
  rawInput: z.infer<typeof appendConversationMessageInputSchema>,
  db: Db = getDb()
) {
  const input = appendConversationMessageInputSchema.parse(rawInput);
  const [message] = await db
    .insert(conversationMessages)
    .values({
      sessionId: input.sessionId,
      role: input.role,
      content: input.content,
      metadata: input.metadata ?? {},
    })
    .returning();

  await db
    .update(conversationSessions)
    .set({
      lastMessageAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(conversationSessions.id, input.sessionId));

  return message;
}

export async function updateConversationSummary(
  sessionId: number,
  summary: string,
  db: Db = getDb()
) {
  const [session] = await db
    .update(conversationSessions)
    .set({
      summary,
      updatedAt: new Date(),
    })
    .where(eq(conversationSessions.id, sessionId))
    .returning();

  return session ?? null;
}

export async function linkContactToConversationSession(
  sessionId: number,
  contactId: number,
  db: Db = getDb()
) {
  const [session] = await db
    .update(conversationSessions)
    .set({
      contactId,
      updatedAt: new Date(),
    })
    .where(and(eq(conversationSessions.id, sessionId)))
    .returning();

  return session ?? null;
}

export async function closeConversationSession(
  sessionId: number,
  status: ConversationSession["status"] = "closed",
  db: Db = getDb()
) {
  const [session] = await db
    .update(conversationSessions)
    .set({
      status,
      updatedAt: new Date(),
    })
    .where(eq(conversationSessions.id, sessionId))
    .returning();

  return session ?? null;
}
