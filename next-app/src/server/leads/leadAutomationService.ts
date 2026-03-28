import { and, eq, sql } from "drizzle-orm";

import { getDb, type Db } from "@/lib/db";
import {
  agentInsights,
  dripCampaigns,
  dripEnrollments,
} from "@/lib/db/schema";

type LeadAutomationInput = {
  agentId?: number | null;
  contactId: number;
  source: string;
  title: string;
  description?: string | null;
  priority?: "urgent" | "high" | "medium" | "low";
  suggestedAction?: string | null;
  actionData?: Record<string, unknown>;
};

export async function triggerLeadAutomation(
  input: LeadAutomationInput,
  db: Db = getDb()
) {
  if (!input.agentId) {
    return { insightId: null, enrollmentCount: 0 };
  }

  const [insight] = await db
    .insert(agentInsights)
    .values({
      agentId: input.agentId,
      contactId: input.contactId,
      insightType: "hot_lead",
      title: input.title,
      description: input.description ?? null,
      priority: input.priority ?? "medium",
      suggestedAction: input.suggestedAction ?? "contact_now",
      actionData: {
        source: input.source,
        ...(input.actionData ?? {}),
      },
      isRead: false,
      isActioned: false,
    })
    .returning();

  const campaigns = await db
    .select()
    .from(dripCampaigns)
    .where(
      and(
        eq(dripCampaigns.agentId, input.agentId),
        eq(dripCampaigns.status, "active"),
        eq(dripCampaigns.triggerType, "new_lead")
      )
    );

  let enrollmentCount = 0;

  for (const campaign of campaigns) {
    const [existingEnrollment] = await db
      .select({ id: dripEnrollments.id })
      .from(dripEnrollments)
      .where(
        and(
          eq(dripEnrollments.campaignId, campaign.id),
          eq(dripEnrollments.contactId, input.contactId)
        )
      )
      .limit(1);

    if (existingEnrollment) continue;

    await db.insert(dripEnrollments).values({
      campaignId: campaign.id,
      contactId: input.contactId,
      currentStep: 0,
      status: "active",
      metadata: {
        source: input.source,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db
      .update(dripCampaigns)
      .set({
        totalEnrollments: sql`${dripCampaigns.totalEnrollments} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(dripCampaigns.id, campaign.id));

    enrollmentCount += 1;
  }

  return {
    insightId: insight?.id ?? null,
    enrollmentCount,
  };
}

export async function enrollContactsInDripCampaign(
  params: {
    agentId: number;
    campaignId: number;
    contactIds: number[];
    source: string;
  },
  db: Db = getDb()
) {
  const [campaign] = await db
    .select()
    .from(dripCampaigns)
    .where(
      and(
        eq(dripCampaigns.id, params.campaignId),
        eq(dripCampaigns.agentId, params.agentId)
      )
    )
    .limit(1);

  if (!campaign) {
    throw new Error("Drip campaign not found");
  }

  let enrolled = 0;

  for (const contactId of params.contactIds) {
    const [existingEnrollment] = await db
      .select({ id: dripEnrollments.id })
      .from(dripEnrollments)
      .where(
        and(
          eq(dripEnrollments.campaignId, campaign.id),
          eq(dripEnrollments.contactId, contactId)
        )
      )
      .limit(1);

    if (existingEnrollment) continue;

    await db.insert(dripEnrollments).values({
      campaignId: campaign.id,
      contactId,
      currentStep: 0,
      status: "active",
      metadata: {
        source: params.source,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    enrolled += 1;
  }

  if (enrolled > 0) {
    await db
      .update(dripCampaigns)
      .set({
        totalEnrollments: sql`${dripCampaigns.totalEnrollments} + ${enrolled}`,
        updatedAt: new Date(),
      })
      .where(eq(dripCampaigns.id, campaign.id));
  }

  return { enrolled };
}
