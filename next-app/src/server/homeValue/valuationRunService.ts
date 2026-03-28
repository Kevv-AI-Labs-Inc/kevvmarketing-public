import { eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, type Db } from "@/lib/db";
import {
  contacts,
  type ValuationResult,
  valuationRuns,
} from "@/lib/db/schema";

export const createValuationRunInputSchema = z.object({
  agentId: z.number().int().optional(),
  agentProfileId: z.number().int().optional(),
  contactId: z.number().int().optional(),
  source: z.string().trim().min(2).max(64).default("home_value"),
  status: z.string().trim().min(2).max(20).default("completed"),
  locale: z.string().trim().max(10).default("en"),
  address: z.string().trim().min(5).max(1000),
  result: z.custom<ValuationResult>(),
  modelUsed: z.string().trim().max(100).optional(),
  provider: z.string().trim().max(100).optional(),
  summary: z.string().trim().max(4000).optional(),
});

export type CreateValuationRunInput = z.infer<typeof createValuationRunInputSchema>;

function normalizeOptional(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

export async function createValuationRun(
  rawInput: CreateValuationRunInput,
  db: Db = getDb()
) {
  const input = createValuationRunInputSchema.parse(rawInput);
  const [run] = await db
    .insert(valuationRuns)
    .values({
      agentId: input.agentId ?? null,
      agentProfileId: input.agentProfileId ?? null,
      contactId: input.contactId ?? null,
      source: input.source,
      status: input.status,
      locale: input.locale,
      address: input.address,
      result: input.result,
      modelUsed: normalizeOptional(input.modelUsed),
      provider: normalizeOptional(input.provider),
      summary: normalizeOptional(input.summary),
      updatedAt: new Date(),
    })
    .returning();

  return run;
}

export async function linkValuationRunToContact(
  contactId: number,
  valuationRunId: number,
  db: Db = getDb()
) {
  const [contact] = await db
    .update(contacts)
    .set({
      valuationRunId,
      updatedAt: new Date(),
    })
    .where(eq(contacts.id, contactId))
    .returning();

  return contact ?? null;
}
