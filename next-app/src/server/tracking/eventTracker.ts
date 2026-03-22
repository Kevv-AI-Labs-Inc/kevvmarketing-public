/**
 * Event Tracker — records client interaction events.
 *
 * Central event bus for all marketing interactions.
 * Events feed into: engagement scoring, drip triggers, analytics.
 */

import { getDb } from "../db";
import { clientEvents } from "../../drizzle/schema";

// ─── Event Types ───────────────────────────────────────────

export const EVENT_TYPES = {
  // Share page interactions
  SHARE_VIEW: "share_view",
  SHARE_CLICK: "share_click",
  SHARE_LIKE: "share_like",
  SHARE_SAVE: "share_save",

  // Listing interactions
  LISTING_VIEW: "listing_view",
  LISTING_SAVE: "listing_save",
  LISTING_SHARE: "listing_share",

  // Showing / tour
  SHOWING_BOOKED: "showing_booked",
  SHOWING_FEEDBACK: "showing_feedback",
  SHOWING_CANCELLED: "showing_cancelled",

  // Communication
  EMAIL_OPEN: "email_open",
  EMAIL_CLICK: "email_click",
  SMS_REPLY: "sms_reply",
  WECHAT_MESSAGE: "wechat_message",

  // Forms
  FORM_SUBMIT: "form_submit",
  CONTACT_REQUEST: "contact_request",

  // Ads
  AD_CLICK: "ad_click",
  AD_LEAD: "ad_lead",
} as const;

export type EventType = (typeof EVENT_TYPES)[keyof typeof EVENT_TYPES];

// ─── Score Weights ─────────────────────────────────────────

export const EVENT_SCORE_WEIGHTS: Record<string, number> = {
  [EVENT_TYPES.SHARE_VIEW]: 1,
  [EVENT_TYPES.SHARE_CLICK]: 3,
  [EVENT_TYPES.SHARE_LIKE]: 5,
  [EVENT_TYPES.SHARE_SAVE]: 5,
  [EVENT_TYPES.LISTING_VIEW]: 2,
  [EVENT_TYPES.LISTING_SAVE]: 8,
  [EVENT_TYPES.LISTING_SHARE]: 5,
  [EVENT_TYPES.SHOWING_BOOKED]: 20,
  [EVENT_TYPES.SHOWING_FEEDBACK]: 10,
  [EVENT_TYPES.EMAIL_OPEN]: 2,
  [EVENT_TYPES.EMAIL_CLICK]: 5,
  [EVENT_TYPES.SMS_REPLY]: 10,
  [EVENT_TYPES.WECHAT_MESSAGE]: 10,
  [EVENT_TYPES.FORM_SUBMIT]: 15,
  [EVENT_TYPES.CONTACT_REQUEST]: 25,
  [EVENT_TYPES.AD_CLICK]: 3,
  [EVENT_TYPES.AD_LEAD]: 20,
};

// ─── Record Event ──────────────────────────────────────────

export interface TrackEventInput {
  contactId?: number;
  agentId?: number;
  eventType: string;
  eventData?: Record<string, unknown>;
  sourceType?: string;
  sourceId?: string;
  sessionToken?: string;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Record a client interaction event.
 * Fire-and-forget safe — catches errors internally.
 */
export async function trackEvent(input: TrackEventInput): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;

    await db.insert(clientEvents).values({
      contactId: input.contactId ?? null,
      agentId: input.agentId ?? null,
      eventType: input.eventType,
      eventData: input.eventData ?? null,
      sourceType: input.sourceType ?? null,
      sourceId: input.sourceId ?? null,
      sessionToken: input.sessionToken ?? null,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
    });
  } catch (err) {
    console.error("[eventTracker] Failed to record event:", err);
  }
}

/**
 * Record multiple events in a batch.
 */
export async function trackEvents(inputs: TrackEventInput[]): Promise<void> {
  if (inputs.length === 0) return;
  try {
    const db = await getDb();
    if (!db) return;

    await db.insert(clientEvents).values(
      inputs.map((input) => ({
        contactId: input.contactId ?? null,
        agentId: input.agentId ?? null,
        eventType: input.eventType,
        eventData: input.eventData ?? null,
        sourceType: input.sourceType ?? null,
        sourceId: input.sourceId ?? null,
        sessionToken: input.sessionToken ?? null,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
      })),
    );
  } catch (err) {
    console.error("[eventTracker] Failed to record batch events:", err);
  }
}
