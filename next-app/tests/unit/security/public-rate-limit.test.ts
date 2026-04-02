import { describe, expect, it } from "vitest";

import { clientEvents, magicLinks } from "@/lib/db/schema";
import {
  assertMagicLinkRequestAllowed,
  assertPublicEventRateLimit,
  normalizeRateLimitIp,
} from "@/server/security/publicRateLimit";

import { createPgMemDb } from "../../helpers/pg-mem-db";

describe("public rate limit helpers", () => {
  it("normalizes forwarded IP values", () => {
    expect(normalizeRateLimitIp("203.0.113.10, 10.0.0.1")).toBe("203.0.113.10");
    expect(normalizeRateLimitIp("")).toBeNull();
  });

  it("blocks repeated public event writes from the same IP bucket", async () => {
    const harness = await createPgMemDb();

    try {
      await harness.db.insert(clientEvents).values({
        contactId: 9,
        agentId: 7,
        eventType: "agent_chat_message",
        sourceType: "agent_site_chat",
        sourceId: "sophia-chen",
        ipAddress: "127.0.0.1",
        createdAt: new Date(),
      });

      await expect(
        assertPublicEventRateLimit({
          db: harness.db as never,
          ipAddress: "127.0.0.1",
          eventType: "agent_chat_message",
          sourceType: "agent_site_chat",
          sourceId: "sophia-chen",
          windowMs: 10 * 60 * 1000,
          maxRequests: 1,
          message: "rate limited",
        })
      ).rejects.toMatchObject({
        code: "TOO_MANY_REQUESTS",
        message: "rate limited",
      });
    } finally {
      await harness.close();
    }
  });

  it("blocks repeated magic-link requests by email and IP", async () => {
    const harness = await createPgMemDb();

    try {
      await harness.db.insert(magicLinks).values({
        email: "agent@example.com",
        tokenHash: "hash-one",
        requestIp: "127.0.0.1",
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        createdAt: new Date(),
      });

      await expect(
        assertMagicLinkRequestAllowed({
          db: harness.db as never,
          email: "agent@example.com",
          ipAddress: "127.0.0.1",
          emailCooldownMs: 60_000,
          ipWindowMs: 10 * 60_000,
          ipMaxRequests: 1,
        })
      ).rejects.toMatchObject({
        code: "TOO_MANY_REQUESTS",
      });
    } finally {
      await harness.close();
    }
  });
});
