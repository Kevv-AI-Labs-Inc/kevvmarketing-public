import type { Db } from "@/lib/db";
import { describe, expect, it } from "vitest";

import { clientEvents, engagementScores } from "@/lib/db/schema";
import { EVENT_TYPES } from "@/server/tracking/eventTracker";
import {
  recalculateAllScores,
  recalculateScore,
} from "@/server/tracking/engagementScorer";

import { createPgMemDb } from "../../helpers/pg-mem-db";

describe("engagement scoring", () => {
  it("computes weighted scores and upserts engagement rows", async () => {
    const harness = await createPgMemDb();
    const db = harness.db as unknown as Db;

    try {
      await harness.db.insert(clientEvents).values([
        {
          contactId: 1,
          agentId: 7,
          eventType: EVENT_TYPES.SHARE_VIEW,
          eventData: {},
          createdAt: new Date("2026-03-20T00:00:00.000Z"),
        },
        {
          contactId: 1,
          agentId: 7,
          eventType: EVENT_TYPES.SHARE_VIEW,
          eventData: {},
          createdAt: new Date("2026-03-21T00:00:00.000Z"),
        },
        {
          contactId: 1,
          agentId: 7,
          eventType: EVENT_TYPES.SHOWING_BOOKED,
          eventData: {},
          createdAt: new Date("2026-03-22T00:00:00.000Z"),
        },
      ]);

      const result = await recalculateScore(1, 7, db);
      const scoreRows = await harness.db.select().from(engagementScores);

      expect(result.score).toBe(22);
      expect(result.factors).toEqual({
        share_view: 2,
        showing_booked: 20,
      });
      expect(scoreRows).toHaveLength(1);
      expect(scoreRows[0]).toMatchObject({
        contactId: 1,
        agentId: 7,
        score: 22,
      });
    } finally {
      await harness.close();
    }
  });

  it("recalculates all active contact scores in one pass", async () => {
    const harness = await createPgMemDb();
    const db = harness.db as unknown as Db;

    try {
      await harness.db.insert(clientEvents).values([
        {
          contactId: 11,
          agentId: 7,
          eventType: EVENT_TYPES.EMAIL_CLICK,
          eventData: {},
          createdAt: new Date("2026-03-20T00:00:00.000Z"),
        },
        {
          contactId: 12,
          agentId: 7,
          eventType: EVENT_TYPES.CONTACT_REQUEST,
          eventData: {},
          createdAt: new Date("2026-03-20T00:00:00.000Z"),
        },
      ]);

      const result = await recalculateAllScores(db);
      const scoreRows = await harness.db.select().from(engagementScores);

      expect(result.processed).toBe(2);
      expect(scoreRows).toHaveLength(2);
      expect(scoreRows.map((row) => row.score).sort((a, b) => a - b)).toEqual([
        5,
        25,
      ]);
    } finally {
      await harness.close();
    }
  });
});
