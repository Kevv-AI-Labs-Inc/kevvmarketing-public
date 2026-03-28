import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as schema from "@/lib/db/schema";
import {
  buildDemoAgentProfile,
  buildDemoValuationResult,
} from "@/server/demo/factories";

import { createPgMemDb } from "../../helpers/pg-mem-db";

const { mockGetDb } = vi.hoisted(() => ({
  mockGetDb: vi.fn(),
}));

vi.mock("@/server/db", () => ({
  getDb: mockGetDb,
}));

vi.mock("@/lib/db", () => ({
  getDb: mockGetDb,
}));

type TestDb = Awaited<ReturnType<typeof createPgMemDb>>;

function createContext() {
  return {
    user: null,
    headers: new Headers(),
    ip: "127.0.0.1",
    userAgent: "vitest",
  };
}

describe("homeValueRouter", () => {
  let testDb: TestDb;

  beforeEach(async () => {
    vi.clearAllMocks();
    testDb = await createPgMemDb();
    mockGetDb.mockReturnValue(testDb.db);
  });

  afterEach(async () => {
    await testDb.close();
  });

  it("returns public context and captures a seller lead into the unified lead spine", async () => {
    const { homeValueRouter } = await import("@/server/homeValueRouter");
    const caller = homeValueRouter.createCaller(createContext());
    const profile = buildDemoAgentProfile({
      id: 11,
      userId: 7,
      slug: "sophia-chen",
    }) as schema.InsertAgentProfile;

    await testDb.db.insert(schema.agentProfiles).values(profile);
    await testDb.db.insert(schema.dripCampaigns).values({
      agentId: 7,
      name: "Seller Follow-up",
      triggerType: "new_lead",
      triggerConfig: { source: "home_value" },
      status: "active",
      totalEnrollments: 0,
    });

    const [run] = await testDb.db
      .insert(schema.valuationRuns)
      .values({
        agentId: 7,
        agentProfileId: 11,
        source: "home_value",
        status: "completed",
        locale: "en",
        address: "123 Main St, Palo Alto, CA",
        result: buildDemoValuationResult(),
        provider: "heuristic",
        summary: "Premium school pocket with strong move-up demand.",
      })
      .returning();

    const context = await caller.getPublicContext({ slug: "sophia-chen" });
    const result = await caller.captureLead({
      slug: "sophia-chen",
      valuationRunId: run.id,
      name: "Daniel Park",
      email: "daniel@example.com",
      phone: "(650) 555-0139",
      timeline: "60-90 days",
      notes: "Needs comp-backed pricing guidance.",
    });

    const [contact] = await testDb.db
      .select()
      .from(schema.contacts)
      .where(eq(schema.contacts.id, result.contactId))
      .limit(1);
    const [updatedRun] = await testDb.db
      .select()
      .from(schema.valuationRuns)
      .where(eq(schema.valuationRuns.id, run.id))
      .limit(1);
    const insights = await testDb.db.select().from(schema.agentInsights);
    const enrollments = await testDb.db.select().from(schema.dripEnrollments);
    const scores = await testDb.db.select().from(schema.engagementScores);

    expect(context.slug).toBe("sophia-chen");
    expect(context.name).toBe("Sophia Chen");
    expect(result).toEqual({ ok: true, contactId: expect.any(Number) });
    expect(contact?.source).toBe("home_value");
    expect(contact?.intent).toBe("selling");
    expect(contact?.valuationRunId).toBe(run.id);
    expect(contact?.tags).toEqual(
      expect.arrayContaining(["seller", "valuation", "high-intent"]),
    );
    expect(updatedRun?.contactId).toBe(result.contactId);
    expect(insights).toHaveLength(1);
    expect(insights[0]?.agentId).toBe(7);
    expect(enrollments).toHaveLength(1);
    expect(enrollments[0]?.contactId).toBe(result.contactId);
    expect(scores).toHaveLength(1);
    expect(scores[0]?.contactId).toBe(result.contactId);
  });
});
