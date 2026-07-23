import type { Db } from "@/lib/db";
import { describe, expect, it } from "vitest";

import { clientEvents, contacts } from "@/lib/db/schema";
import { captureLead } from "@/server/leads/leadCaptureService";

import { createPgMemDb } from "../../helpers/pg-mem-db";

describe("captureLead", () => {
  it("creates a contact and records a lead capture event", async () => {
    const harness = await createPgMemDb();
    const db = harness.db as unknown as Db;

    try {
      const contact = await captureLead(
        {
          agentId: 7,
          agentProfileId: 12,
          source: "area_magnet",
          sourceRef: "palo-alto-market",
          name: "Daniel Park",
          email: "daniel@example.com",
          phone: "650-555-0101",
          score: "hot",
          intent: "selling",
          timeline: "30-60 days",
          tags: ["seller", "market-report"],
          eventType: "area_magnet_lead_submit",
          eventData: {
            magnetScope: "94301",
          },
          sourceId: "88",
          sessionToken: "session-88",
        },
        db,
      );

      const contactRows = await harness.db.select().from(contacts);
      const eventRows = await harness.db.select().from(clientEvents);

      expect(contact.id).toBeGreaterThan(0);
      expect(contactRows).toHaveLength(1);
      expect(contactRows[0]).toMatchObject({
        agentId: 7,
        agentProfileId: 12,
        name: "Daniel Park",
        source: "area_magnet",
        score: "hot",
        intent: "selling",
      });
      expect(contactRows[0].tags).toEqual(["seller", "market-report"]);
      expect(eventRows).toHaveLength(1);
      expect(eventRows[0]).toMatchObject({
        agentId: 7,
        contactId: contact.id,
        eventType: "area_magnet_lead_submit",
        sourceType: "area_magnet",
        sourceId: "88",
        sessionToken: "session-88",
      });
    } finally {
      await harness.close();
    }
  });

  it("updates an existing contact for the same owner and merges tags", async () => {
    const harness = await createPgMemDb();
    const db = harness.db as unknown as Db;

    try {
      const first = await captureLead(
        {
          agentId: 7,
          agentProfileId: 12,
          source: "agent_site_form",
          name: "Jamie Lee",
          email: "jamie@example.com",
          phone: "650-555-0111",
          score: "warm",
          tags: ["buyer"],
          eventType: "agent_site_inquiry",
        },
        db,
      );

      const second = await captureLead(
        {
          agentId: 7,
          agentProfileId: 12,
          source: "area_magnet",
          name: "Jamie Lee",
          email: "jamie@example.com",
          phone: "650-555-0111",
          score: "hot",
          intent: "selling",
          tags: ["seller", "market-report"],
          eventType: "area_magnet_lead_submit",
        },
        db,
      );

      const contactRows = await harness.db.select().from(contacts);
      const eventRows = await harness.db.select().from(clientEvents);

      expect(second.id).toBe(first.id);
      expect(contactRows).toHaveLength(1);
      expect(contactRows[0].source).toBe("area_magnet");
      expect(contactRows[0].score).toBe("hot");
      expect(contactRows[0].intent).toBe("selling");
      expect(contactRows[0].tags).toEqual(["seller", "market-report", "buyer"]);
      expect(eventRows).toHaveLength(2);
    } finally {
      await harness.close();
    }
  });
});
