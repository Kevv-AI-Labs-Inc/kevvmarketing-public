/**
 * Webhook Route — handles events from listing-data-service.
 *
 * Next.js App Router POST handler at /api/v1/webhooks/listing-event.
 * Validates X-Webhook-Secret header and processes listing lifecycle events:
 *
 * - listing.new       → auto-create ad campaign
 * - listing.updated   → if price changed, create price-drop campaign
 * - listing.sold      → pause active campaigns
 * - listing.expired   → pause active campaigns
 *
 * Replaces the legacy Express-based webhookReceiver.ts.
 */

import { NextRequest, NextResponse } from "next/server";
import { ENV } from "@/server/_core/env";
import { getDb } from "@/lib/db";
import { adCampaigns } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getListing } from "@/server/clients/listingDataClient";

// ─── Types ─────────────────────────────────────────────────

interface ListingEvent {
  event: "listing.new" | "listing.updated" | "listing.sold" | "listing.expired";
  listingKey: string;
  mls: string;
  timestamp: string;
  changes?: string[];
  agentId?: number;
}

// ─── POST Handler ──────────────────────────────────────────

export async function POST(req: NextRequest) {
  // Validate webhook secret
  const secret = req.headers.get("x-webhook-secret");
  if (!ENV.webhookSecret || secret !== ENV.webhookSecret) {
    console.warn("[webhook] Invalid or missing X-Webhook-Secret");
    return NextResponse.json(
      { error: { code: "unauthorized", message: "Invalid webhook secret" } },
      { status: 401 },
    );
  }

  let event: ListingEvent;
  try {
    event = (await req.json()) as ListingEvent;
  } catch {
    return NextResponse.json(
      { error: { code: "bad_request", message: "Invalid JSON body" } },
      { status: 400 },
    );
  }

  if (!event.event || !event.listingKey) {
    return NextResponse.json(
      { error: { code: "bad_request", message: "Missing event or listingKey" } },
      { status: 400 },
    );
  }

  console.log(`[webhook] Received ${event.event} for ${event.listingKey}`);

  try {
    switch (event.event) {
      case "listing.new":
        await handleNewListing(event);
        break;

      case "listing.updated":
        if (event.changes?.includes("price")) {
          await handlePriceDrop(event);
        }
        break;

      case "listing.sold":
      case "listing.expired":
        await handleListingEnded(event);
        break;
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("[webhook] Error processing event:", err);
    return NextResponse.json(
      { error: { code: "internal_error", message: "Failed to process event" } },
      { status: 500 },
    );
  }
}

// ─── Event Handlers ────────────────────────────────────────

async function handleNewListing(event: ListingEvent): Promise<void> {
  const db = getDb();

  // Fetch listing data from listing-data-service
  let listingSnapshot: Record<string, unknown> | null = null;
  try {
    const listingRes = await getListing(event.listingKey);
    listingSnapshot = listingRes.data as unknown as Record<string, unknown>;
  } catch (err) {
    console.warn("[webhook] Could not fetch listing for auto-campaign:", err);
  }

  // Auto-create a draft campaign
  await db.insert(adCampaigns).values({
    agentId: event.agentId ?? null,
    listingKey: event.listingKey,
    title: `New Listing: ${event.listingKey}`,
    status: "draft",
    platforms: ["google", "meta"],
    triggerType: "listing_new",
    listingSnapshot,
  });

  console.log(`[webhook] Auto-created campaign for new listing ${event.listingKey}`);
}

async function handlePriceDrop(event: ListingEvent): Promise<void> {
  const db = getDb();

  let listingSnapshot: Record<string, unknown> | null = null;
  try {
    const listingRes = await getListing(event.listingKey);
    listingSnapshot = listingRes.data as unknown as Record<string, unknown>;
  } catch {
    // Continue without snapshot
  }

  await db.insert(adCampaigns).values({
    agentId: event.agentId ?? null,
    listingKey: event.listingKey,
    title: `Price Drop: ${event.listingKey}`,
    status: "draft",
    platforms: ["google", "meta"],
    triggerType: "listing_price_drop",
    listingSnapshot,
  });

  console.log(`[webhook] Auto-created price-drop campaign for ${event.listingKey}`);
}

async function handleListingEnded(event: ListingEvent): Promise<void> {
  const db = getDb();

  // Pause all active campaigns for this listing
  await db
    .update(adCampaigns)
    .set({ status: "completed", updatedAt: new Date() })
    .where(
      and(
        eq(adCampaigns.listingKey, event.listingKey),
        eq(adCampaigns.status, "active"),
      ),
    );

  console.log(`[webhook] Paused campaigns for ended listing ${event.listingKey}`);
}
