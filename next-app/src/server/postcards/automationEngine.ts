/**
 * Automation Engine — lifecycle drip campaigns for direct mail.
 *
 * Handles:
 * 1. Closed-deal milestones: auto-send postcards/letters at defined intervals after closing
 * 2. Just Sold campaigns: auto-create campaign when a listing status changes to Sold
 * 3. Recurring schedules: periodic market update mailers
 *
 * The engine is designed to be called by a daily background worker (cron/setInterval).
 */

import { and, eq, desc, lte, or, sql } from "drizzle-orm";
import { getDb, type Db } from "@/lib/db";
import {
  contacts,
  postcardAutomations,
  postcardCampaigns,
  postcardMailings,
  postcardTemplates,
  type InsertPostcardMailing,
} from "@/lib/db/schema";
import { quotePostcardCampaign } from "./pricing";
import { dispatchPostcard } from "./provider";

// ─── Types ────────────────────────────────────────────────

export type CreateAutomationInput = {
  agentId: number;
  name: string;
  triggerType: "closed_deal_milestone" | "listing_event" | "recurring_schedule";
  channel?: "postcard" | "letter";
  templateId?: number;
  milestoneRules?: Array<{
    daysAfterClose: number;
    templateId?: number;
    label: string;
    channel?: "postcard" | "letter";
  }>;
  audienceFilter?: {
    zipCodes?: string[];
    tags?: string[];
    source?: string;
    listingStatus?: string;
  };
};

// ─── Default Milestone Templates ──────────────────────────

export const DEFAULT_CLOSED_DEAL_MILESTONES = [
  { daysAfterClose: 7, label: "Thank You Card", channel: "postcard" as const },
  { daysAfterClose: 30, label: "Home Maintenance Tips", channel: "postcard" as const },
  { daysAfterClose: 90, label: "Neighborhood Update", channel: "postcard" as const },
  { daysAfterClose: 180, label: "6-Month Market Report", channel: "letter" as const },
  { daysAfterClose: 365, label: "Happy Anniversary + CMA", channel: "letter" as const },
  { daysAfterClose: 730, label: "2-Year Market Update + CMA", channel: "letter" as const },
];

// ─── CRUD ─────────────────────────────────────────────────

export async function createAutomation(
  input: CreateAutomationInput,
  db: Db = getDb()
) {
  const milestones =
    input.triggerType === "closed_deal_milestone" && (!input.milestoneRules || input.milestoneRules.length === 0)
      ? DEFAULT_CLOSED_DEAL_MILESTONES
      : input.milestoneRules ?? [];

  const [automation] = await db
    .insert(postcardAutomations)
    .values({
      agentId: input.agentId,
      name: input.name,
      status: "active",
      triggerType: input.triggerType,
      channel: input.channel ?? "postcard",
      templateId: input.templateId ?? null,
      milestoneRules: milestones,
      audienceFilter: input.audienceFilter ?? {},
      nextRunAt: new Date(), // start immediately
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  return automation;
}

export async function listAutomations(agentId: number, db: Db = getDb()) {
  return db
    .select()
    .from(postcardAutomations)
    .where(eq(postcardAutomations.agentId, agentId))
    .orderBy(desc(postcardAutomations.createdAt));
}

export async function updateAutomationStatus(
  params: { agentId: number; automationId: number; status: "active" | "paused" | "archived" },
  db: Db = getDb()
) {
  const [updated] = await db
    .update(postcardAutomations)
    .set({ status: params.status, updatedAt: new Date() })
    .where(
      and(
        eq(postcardAutomations.id, params.automationId),
        eq(postcardAutomations.agentId, params.agentId)
      )
    )
    .returning();
  return updated;
}

// ─── Milestone Check (Daily Worker) ──────────────────────

/**
 * Process all active closed-deal milestone automations.
 * Called daily by a background worker.
 *
 * For each automation:
 * 1. Find contacts tagged with "closed_deal" or matching audience filter
 * 2. Check which milestones are due based on contact's close date
 * 3. Auto-create campaigns for due milestones (if not already sent)
 */
export async function processClosedDealMilestones(db: Db = getDb()) {
  const automations = await db
    .select()
    .from(postcardAutomations)
    .where(
      and(
        eq(postcardAutomations.status, "active"),
        eq(postcardAutomations.triggerType, "closed_deal_milestone"),
        or(
          lte(postcardAutomations.nextRunAt, new Date()),
          sql`${postcardAutomations.nextRunAt} IS NULL`
        )
      )
    );

  const results: Array<{
    automationId: number;
    campaignsCreated: number;
    errors: string[];
  }> = [];

  for (const automation of automations) {
    const agentId = automation.agentId;
    const milestones = (automation.milestoneRules ?? []) as Array<{
      daysAfterClose: number;
      templateId?: number;
      label: string;
      channel?: "postcard" | "letter";
    }>;
    const errors: string[] = [];
    let campaignsCreated = 0;

    // Find contacts with closed_deal tag or matching audience filter
    const audienceFilter = (automation.audienceFilter ?? {}) as {
      zipCodes?: string[];
      tags?: string[];
      source?: string;
    };

    const agentContacts = await db
      .select()
      .from(contacts)
      .where(eq(contacts.agentId, agentId));

    // Filter by tags/zipcode from audience filter
    const eligibleContacts = agentContacts.filter((c) => {
      const tags = (c.tags ?? []) as string[];
      // Must have a close date tag like "closed:2025-06-15"
      const hasCloseDate = tags.some((t) => t.startsWith("closed:"));
      if (!hasCloseDate) return false;

      // Optional zip filter
      if (audienceFilter.zipCodes?.length) {
        if (!audienceFilter.zipCodes.includes(c.postalCode ?? "")) return false;
      }

      // Optional tag filter
      if (audienceFilter.tags?.length) {
        if (!audienceFilter.tags.some((t) => tags.includes(t))) return false;
      }

      return c.addressVerified && c.addressLine1;
    });

    const today = new Date();

    for (const contact of eligibleContacts) {
      const tags = (contact.tags ?? []) as string[];
      const closeTag = tags.find((t) => t.startsWith("closed:"));
      if (!closeTag) continue;

      const closeDate = new Date(closeTag.replace("closed:", ""));
      if (isNaN(closeDate.getTime())) continue;

      const daysSinceClose = Math.floor(
        (today.getTime() - closeDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      for (const milestone of milestones) {
        // Check if this milestone is due (within ±3 day window)
        if (
          daysSinceClose >= milestone.daysAfterClose - 1 &&
          daysSinceClose <= milestone.daysAfterClose + 3
        ) {
          // Check if already sent (by checking existing campaigns with matching name pattern)
          const existingCampaigns = await db
            .select({ id: postcardCampaigns.id })
            .from(postcardCampaigns)
            .where(
              and(
                eq(postcardCampaigns.agentId, agentId),
                sql`${postcardCampaigns.name} LIKE ${`%${milestone.label}%contact:${contact.id}%`}`
              )
            )
            .limit(1);

          if (existingCampaigns.length > 0) continue; // Already sent

          // Find template
          const templateId = milestone.templateId ?? automation.templateId;
          let template = null;
          if (templateId) {
            const [t] = await db
              .select()
              .from(postcardTemplates)
              .where(eq(postcardTemplates.id, templateId))
              .limit(1);
            template = t;
          }
          if (!template) {
            // Fall back to first system template
            const [t] = await db
              .select()
              .from(postcardTemplates)
              .where(eq(postcardTemplates.isSystem, true))
              .limit(1);
            template = t;
          }
          if (!template) {
            errors.push(`No template found for milestone "${milestone.label}"`);
            continue;
          }

          const channel = milestone.channel ?? (automation.channel as "postcard" | "letter") ?? "postcard";
          const quote = quotePostcardCampaign(template.sizeCode, 1, channel);

          // Create auto campaign
          const [campaign] = await db
            .insert(postcardCampaigns)
            .values({
              agentId,
              templateId: template.id,
              name: `[Auto] ${milestone.label} — contact:${contact.id}`,
              status: "queued",
              sendStrategy: "send_now",
              unitPriceCents: quote.unitPriceCents,
              subtotalCents: quote.subtotalCents,
              serviceFeeCents: quote.serviceFeeCents,
              totalCents: quote.totalCents,
              recipientCount: 1,
              audienceSnapshot: {
                automationId: automation.id,
                milestone: milestone.label,
                daysAfterClose: milestone.daysAfterClose,
                contactId: contact.id,
              },
              createdAt: new Date(),
              updatedAt: new Date(),
            })
            .returning();

          // Create mailing
          await db.insert(postcardMailings).values({
            campaignId: campaign.id,
            contactId: contact.id,
            provider: "pending",
            channel,
            status: "ready",
            costCents: quote.unitPriceCents,
            createdAt: new Date(),
            updatedAt: new Date(),
          } as InsertPostcardMailing);

          campaignsCreated++;
        }
      }
    }

    // Update automation last run
    const nextRun = new Date();
    nextRun.setDate(nextRun.getDate() + 1); // Run again tomorrow
    nextRun.setHours(9, 0, 0, 0); // 9 AM

    await db
      .update(postcardAutomations)
      .set({
        lastRunAt: new Date(),
        nextRunAt: nextRun,
        updatedAt: new Date(),
      })
      .where(eq(postcardAutomations.id, automation.id));

    results.push({ automationId: automation.id, campaignsCreated, errors });
  }

  return results;
}

/**
 * Create a Just Sold auto-campaign.
 * Called when BBO fires a listing.status_changed event with newStatus = "Sold".
 *
 * Finds all contacts in the sold listing's zipcode and creates a postcard campaign.
 */
export async function createJustSoldCampaign(params: {
  agentId: number;
  listingKey: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  soldPrice?: string;
  templateId?: number;
}, db: Db = getDb()) {
  // Find contacts in the same zipcode
  const audienceContacts = await db
    .select()
    .from(contacts)
    .where(
      and(
        eq(contacts.agentId, params.agentId),
        eq(contacts.postalCode, params.postalCode),
        eq(contacts.addressVerified, true)
      )
    );

  if (audienceContacts.length === 0) {
    return { campaignId: null, message: "No verified contacts in this zipcode." };
  }

  // Find template
  let template = null;
  if (params.templateId) {
    const [t] = await db
      .select()
      .from(postcardTemplates)
      .where(eq(postcardTemplates.id, params.templateId))
      .limit(1);
    template = t;
  }
  if (!template) {
    // Fall back to "Just Listed Launch" system template (or first system template)
    const systemTemplates = await db
      .select()
      .from(postcardTemplates)
      .where(eq(postcardTemplates.isSystem, true));
    template = systemTemplates.find((t) => t.category === "JUST_LISTED") ?? systemTemplates[0];
  }
  if (!template) {
    return { campaignId: null, message: "No template available." };
  }

  const quote = quotePostcardCampaign(template.sizeCode, audienceContacts.length);

  const [campaign] = await db
    .insert(postcardCampaigns)
    .values({
      agentId: params.agentId,
      templateId: template.id,
      name: `[Auto] Just Sold — ${params.address}`,
      status: "draft", // Agent reviews before sending
      sendStrategy: "send_now",
      unitPriceCents: quote.unitPriceCents,
      subtotalCents: quote.subtotalCents,
      serviceFeeCents: quote.serviceFeeCents,
      totalCents: quote.totalCents,
      recipientCount: audienceContacts.length,
      audienceSnapshot: {
        type: "just_sold",
        listingKey: params.listingKey,
        address: params.address,
        postalCode: params.postalCode,
        soldPrice: params.soldPrice,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  // Create mailings
  const mailingRows: InsertPostcardMailing[] = audienceContacts.map((contact) => ({
    campaignId: campaign.id,
    contactId: contact.id,
    provider: "pending",
    channel: "postcard" as const,
    status: contact.addressVerified ? ("ready" as const) : ("validating" as const),
    costCents: quote.unitPriceCents,
    createdAt: new Date(),
    updatedAt: new Date(),
  }));

  await db.insert(postcardMailings).values(mailingRows);

  return {
    campaignId: campaign.id,
    recipientCount: audienceContacts.length,
    totalCents: quote.totalCents,
    message: `Just Sold campaign created with ${audienceContacts.length} recipients. Review and launch when ready.`,
  };
}
