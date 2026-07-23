import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as schema from "@/lib/db/schema";
import { buildDemoContact } from "@/server/demo/factories";

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
  const now = new Date("2026-03-28T12:00:00.000Z");

  return {
    user: {
      id: 7,
      openId: "demo-user",
      name: "Demo User",
      email: "demo@kevv.ai",
      loginMethod: "dev-bypass",
      role: "admin" as const,
      createdAt: now,
      updatedAt: now,
      lastSignedIn: now,
      picture: null,
      googleId: null,
      microsoftEntraId: null,
    },
    headers: new Headers(),
    ip: "127.0.0.1",
    userAgent: "vitest",
  };
}

describe("leadCaptureRouter.dashboard", () => {
  let testDb: TestDb;

  beforeEach(async () => {
    vi.clearAllMocks();
    testDb = await createPgMemDb();
    mockGetDb.mockReturnValue(testDb.db);
  });

  afterEach(async () => {
    await testDb.close();
  });

  it("aggregates leads, engagement, drip options, and postcard templates", async () => {
    const { leadCaptureRouter } = await import("@/server/leadCaptureRouter");
    const caller = leadCaptureRouter.createCaller(createContext());

    await testDb.db.insert(schema.contacts).values([
      buildDemoContact({
        id: 101,
        agentId: 7,
        source: "area_magnet",
        status: "qualified",
      }),
      buildDemoContact({
        id: 102,
        agentId: 7,
        source: "agent_site_chat",
        email: "grace@example.com",
        phone: "(650) 555-0101",
        name: "Grace Li",
      }),
    ]);
    await testDb.db.insert(schema.engagementScores).values({
      contactId: 101,
      agentId: 7,
      score: 42,
      factors: { area_magnet_lead_submit: 42 },
      scoreModel: "v1",
    });
    await testDb.db.insert(schema.agentInsights).values({
      agentId: 7,
      contactId: 101,
      insightType: "hot_lead",
      title: "Seller lead is ready for a pricing call",
      description: "Area Magnet lead opened the report and left timeline notes.",
      priority: "high",
      suggestedAction: "contact_now",
      actionData: { source: "area_magnet" },
    });
    await testDb.db.insert(schema.dripCampaigns).values({
      agentId: 7,
      name: "Seller Follow-up",
      triggerType: "new_lead",
      triggerConfig: { source: "area_magnet" },
      status: "active",
      totalEnrollments: 3,
    });
    const result = await caller.dashboard({});

    expect(result.leads).toHaveLength(2);
    expect(result.leads.find((lead) => lead.id === 101)?.engagementScore).toBe(42);
    expect(result.sourceBreakdown).toEqual(
      expect.arrayContaining([
        { source: "area_magnet", count: 1 },
        { source: "agent_site_chat", count: 1 },
      ]),
    );
    expect(result.recentInsights).toHaveLength(1);
    expect(result.dripOptions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "Seller Follow-up",
          status: "active",
        }),
      ]),
    );
    expect(result.postcardTemplates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "Luxury Seller Consultation",
        }),
      ]),
    );
  });
});
