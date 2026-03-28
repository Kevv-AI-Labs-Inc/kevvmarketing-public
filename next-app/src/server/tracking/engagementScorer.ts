/**
 * Engagement Scorer — calculates rolling engagement scores from events.
 *
 * Scores are weighted sums of recent events per contact.
 * Used to prioritize leads and trigger drip campaigns.
 */

import { getDb, type Db } from "../db";
import { clientEvents, engagementScores } from "../../drizzle/schema";
import { eq, and, sql, gte } from "drizzle-orm";
import { EVENT_SCORE_WEIGHTS } from "./eventTracker";

// ─── Score Calculation ─────────────────────────────────────

/**
 * Recalculate engagement score for a single contact.
 * Looks at events from the last 30 days.
 */
export async function recalculateScore(
  contactId: number,
  agentId?: number,
  injectedDb?: Db,
): Promise<{ score: number; factors: Record<string, number> }> {
  const db = injectedDb ?? (await getDb());
  if (!db) return { score: 0, factors: {} };

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Get event counts by type for this contact in last 30 days
  const eventCounts = await db
    .select({
      eventType: clientEvents.eventType,
      count: sql<number>`COUNT(*)::integer`,
    })
    .from(clientEvents)
    .where(
      and(
        eq(clientEvents.contactId, contactId),
        gte(clientEvents.createdAt, thirtyDaysAgo),
      ),
    )
    .groupBy(clientEvents.eventType);

  // Calculate weighted score
  const factors: Record<string, number> = {};
  let totalScore = 0;

  for (const row of eventCounts) {
    const weight = EVENT_SCORE_WEIGHTS[row.eventType] ?? 1;
    const contribution = row.count * weight;
    factors[row.eventType] = contribution;
    totalScore += contribution;
  }

  // Upsert engagement score
  const existing = await db
    .select()
    .from(engagementScores)
    .where(eq(engagementScores.contactId, contactId))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(engagementScores)
      .set({
        score: totalScore,
        factors,
        updatedAt: new Date(),
      })
      .where(eq(engagementScores.contactId, contactId));
  } else {
    await db.insert(engagementScores).values({
      contactId,
      agentId: agentId ?? null,
      score: totalScore,
      factors,
      scoreModel: "v1",
    });
  }

  return { score: totalScore, factors };
}

/**
 * Recalculate scores for all contacts with recent activity.
 * Intended to be called periodically (e.g., hourly cron).
 */
export async function recalculateAllScores(injectedDb?: Db): Promise<{
  processed: number;
}> {
  const db = injectedDb ?? (await getDb());
  if (!db) return { processed: 0 };

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Get all contacts with recent events
  const activeContacts = await db
    .selectDistinct({ contactId: clientEvents.contactId })
    .from(clientEvents)
    .where(
      and(
        gte(clientEvents.createdAt, thirtyDaysAgo),
        sql`${clientEvents.contactId} IS NOT NULL`,
      ),
    );

  let processed = 0;
  for (const row of activeContacts) {
    if (row.contactId) {
      await recalculateScore(row.contactId, undefined, db);
      processed++;
    }
  }

  return { processed };
}
