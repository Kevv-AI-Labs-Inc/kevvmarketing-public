import { and, desc, eq, or } from "drizzle-orm";
import { z } from "zod";

import { getDb, type Db } from "@/lib/db";
import { clientEvents, contacts, type Contact } from "@/lib/db/schema";

const scoreSchema = z.enum(["hot", "warm", "cold"]);

export const leadCaptureInputSchema = z
  .object({
    agentId: z.number().int().optional(),
    agentProfileId: z.number().int().optional(),
    conversationSessionId: z.number().int().optional(),
    valuationRunId: z.number().int().optional(),
    source: z.string().trim().min(2).max(64),
    sourceRef: z.string().trim().max(255).optional(),
    externalId: z.string().trim().max(255).optional(),
    status: z.enum(["new", "contacted", "qualified", "converted", "lost", "archived"]).optional(),
    score: scoreSchema.optional(),
    intent: z.string().trim().max(64).optional(),
    summary: z.string().trim().max(4000).optional(),
    name: z.string().trim().max(255).optional(),
    firstName: z.string().trim().max(100).optional(),
    lastName: z.string().trim().max(100).optional(),
    email: z.string().trim().email().max(320).optional(),
    phone: z.string().trim().max(64).optional(),
    wechatId: z.string().trim().max(100).optional(),
    preferredLanguage: z.string().trim().max(10).optional(),
    budgetMin: z.string().trim().max(20).optional(),
    budgetMax: z.string().trim().max(20).optional(),
    area: z.string().trim().max(255).optional(),
    timeline: z.string().trim().max(255).optional(),
    notes: z.string().trim().max(4000).optional(),
    tags: z.array(z.string().trim().min(1).max(64)).max(30).optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
    addressLine1: z.string().trim().max(255).optional(),
    addressLine2: z.string().trim().max(255).optional(),
    city: z.string().trim().max(120).optional(),
    state: z.string().trim().max(32).optional(),
    postalCode: z.string().trim().max(20).optional(),
    country: z.string().trim().length(2).optional(),
    eventType: z.string().trim().min(2).max(50).optional(),
    eventData: z.record(z.string(), z.unknown()).optional(),
    sourceId: z.string().trim().max(255).optional(),
    sessionToken: z.string().trim().max(255).optional(),
    ipAddress: z.string().trim().max(45).optional(),
    userAgent: z.string().trim().max(2000).optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.email && !value.phone && !value.wechatId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "At least one contact method is required.",
        path: ["email"],
      });
    }
  });

export type LeadCaptureInput = z.infer<typeof leadCaptureInputSchema>;

function normalizeOptional(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(values.filter((value): value is string => Boolean(value && value.trim().length > 0)))
  );
}

async function findExistingContact(db: Db, input: LeadCaptureInput) {
  const email = normalizeOptional(input.email);
  const phone = normalizeOptional(input.phone);

  if (!email && !phone) return null;

  const ownership = [];
  if (input.agentId !== undefined) {
    ownership.push(eq(contacts.agentId, input.agentId));
  }
  if (input.agentProfileId !== undefined) {
    ownership.push(eq(contacts.agentProfileId, input.agentProfileId));
  }
  if (ownership.length === 0) return null;

  const matchers = [];
  if (email) matchers.push(eq(contacts.email, email));
  if (phone) matchers.push(eq(contacts.phone, phone));

  const rows = await db
    .select()
    .from(contacts)
    .where(and(...ownership, or(...matchers)))
    .orderBy(desc(contacts.updatedAt))
    .limit(1);

  return rows[0] ?? null;
}

type EventInput = {
  agentId?: number;
  contactId?: number;
  eventType: string;
  eventData?: Record<string, unknown>;
  sourceType?: string;
  sourceId?: string | null;
  sessionToken?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
};

export async function recordClientEvent(input: EventInput, db: Db = getDb()) {
  await db.insert(clientEvents).values({
    agentId: input.agentId ?? null,
    contactId: input.contactId ?? null,
    eventType: input.eventType,
    eventData: input.eventData ?? {},
    sourceType: input.sourceType ?? null,
    sourceId: input.sourceId ?? null,
    sessionToken: input.sessionToken ?? null,
    ipAddress: input.ipAddress ?? null,
    userAgent: input.userAgent ?? null,
  });
}

function buildContactPatch(existing: Contact | null, input: LeadCaptureInput) {
  const existingTags = Array.isArray(existing?.tags) ? existing.tags : [];

  return {
    agentId: input.agentId ?? existing?.agentId ?? null,
    agentProfileId: input.agentProfileId ?? existing?.agentProfileId ?? null,
    conversationSessionId: input.conversationSessionId ?? existing?.conversationSessionId ?? null,
    valuationRunId: input.valuationRunId ?? existing?.valuationRunId ?? null,
    externalId: normalizeOptional(input.externalId) ?? existing?.externalId ?? null,
    source: input.source,
    sourceRef: normalizeOptional(input.sourceRef) ?? existing?.sourceRef ?? null,
    status: input.status ?? existing?.status ?? "new",
    score: input.score ?? existing?.score ?? "cold",
    intent: normalizeOptional(input.intent) ?? existing?.intent ?? null,
    summary: normalizeOptional(input.summary) ?? existing?.summary ?? null,
    name: normalizeOptional(input.name) ?? existing?.name ?? null,
    firstName: normalizeOptional(input.firstName) ?? existing?.firstName ?? null,
    lastName: normalizeOptional(input.lastName) ?? existing?.lastName ?? null,
    email: normalizeOptional(input.email) ?? existing?.email ?? null,
    phone: normalizeOptional(input.phone) ?? existing?.phone ?? null,
    wechatId: normalizeOptional(input.wechatId) ?? existing?.wechatId ?? null,
    preferredLanguage:
      normalizeOptional(input.preferredLanguage) ??
      existing?.preferredLanguage ??
      "en",
    budgetMin: normalizeOptional(input.budgetMin) ?? existing?.budgetMin ?? null,
    budgetMax: normalizeOptional(input.budgetMax) ?? existing?.budgetMax ?? null,
    area: normalizeOptional(input.area) ?? existing?.area ?? null,
    timeline: normalizeOptional(input.timeline) ?? existing?.timeline ?? null,
    notes: normalizeOptional(input.notes) ?? existing?.notes ?? null,
    tags: uniqueStrings([...(input.tags ?? []), ...existingTags]),
    metadata: {
      ...(existing?.metadata ?? {}),
      ...(input.metadata ?? {}),
    },
    addressLine1: normalizeOptional(input.addressLine1) ?? existing?.addressLine1 ?? null,
    addressLine2: normalizeOptional(input.addressLine2) ?? existing?.addressLine2 ?? null,
    city: normalizeOptional(input.city) ?? existing?.city ?? null,
    state: normalizeOptional(input.state) ?? existing?.state ?? null,
    postalCode: normalizeOptional(input.postalCode) ?? existing?.postalCode ?? null,
    country: normalizeOptional(input.country) ?? existing?.country ?? "US",
    updatedAt: new Date(),
  };
}

export async function captureLead(rawInput: LeadCaptureInput, db: Db = getDb()) {
  const input = leadCaptureInputSchema.parse(rawInput);
  const existing = await findExistingContact(db, input);
  const patch = buildContactPatch(existing, input);

  const [contact] = existing
    ? await db
        .update(contacts)
        .set(patch)
        .where(eq(contacts.id, existing.id))
        .returning()
    : await db
        .insert(contacts)
        .values(patch)
        .returning();

  await recordClientEvent(
    {
      agentId: contact.agentId ?? undefined,
      contactId: contact.id,
      eventType: input.eventType ?? "lead_capture",
      eventData: {
        source: input.source,
        intent: input.intent ?? null,
        score: input.score ?? contact.score,
        ...((input.eventData ?? {}) as Record<string, unknown>),
      },
      sourceType: input.source,
      sourceId: input.sourceId ?? input.sourceRef ?? null,
      sessionToken: input.sessionToken ?? null,
      ipAddress: normalizeOptional(input.ipAddress),
      userAgent: normalizeOptional(input.userAgent),
    },
    db
  );

  return contact;
}
