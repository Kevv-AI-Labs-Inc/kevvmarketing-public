import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as schema from "@/lib/db/schema";
import { buildDemoAgentProfile } from "@/server/demo/factories";

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

describe("profileRouter", () => {
  let testDb: TestDb;

  beforeEach(async () => {
    vi.clearAllMocks();
    testDb = await createPgMemDb();
    mockGetDb.mockReturnValue(testDb.db);
  });

  afterEach(async () => {
    await testDb.close();
  });

  it("returns the public profile and records a profile view event", async () => {
    const { profileRouter } = await import("@/server/profileRouter");
    const caller = profileRouter.createCaller(createContext());
    const profile = buildDemoAgentProfile({
      userId: 7,
      slug: "sophia-chen",
    }) as schema.InsertAgentProfile;

    await testDb.db.insert(schema.agentProfiles).values(profile);

    const result = await caller.getPublicBySlug({ slug: "sophia-chen" });
    const trackResult = await caller.trackView({
      slug: "sophia-chen",
      pagePath: "/agents/sophia-chen",
      referrer: "https://google.com",
    });

    const events = await testDb.db
      .select()
      .from(schema.clientEvents)
      .where(eq(schema.clientEvents.eventType, "agent_profile_view"));

    expect(result?.slug).toBe("sophia-chen");
    expect(result?.name).toBe("Sophia Chen");
    expect(trackResult).toEqual({ tracked: true });
    expect(events).toHaveLength(1);
    expect(events[0]?.agentId).toBe(7);
    expect(events[0]?.sourceType).toBe("agent_site");
    expect(events[0]?.eventData).toMatchObject({
      slug: "sophia-chen",
      pagePath: "/agents/sophia-chen",
    });
  });
});
