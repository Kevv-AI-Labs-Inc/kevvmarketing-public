import type { Db } from "@/lib/db";
import {
  buyerProfiles,
  clients,
  contacts,
  listingSubscriptions,
  smartMatchResults,
  smartMatchRuns,
} from "@/lib/db/schema";
import {
  generateSmartMatch,
  getSmartMatchWorkspace,
} from "@/server/smartMatch/smartMatchService";
import { describe, expect, it, vi } from "vitest";

import { createPgMemDb } from "../../helpers/pg-mem-db";

const {
  mockSearchListings,
  mockGetListingsBatch,
  mockGenerateEmbedding,
  mockGenerateMockEmbedding,
  mockGetEmbeddingModelId,
} = vi.hoisted(() => ({
  mockSearchListings: vi.fn(),
  mockGetListingsBatch: vi.fn(),
  mockGenerateEmbedding: vi.fn(),
  mockGenerateMockEmbedding: vi.fn(),
  mockGetEmbeddingModelId: vi.fn(),
}));

vi.mock("@/server/clients/listingDataClient", () => ({
  searchListings: mockSearchListings,
  getListingsBatch: mockGetListingsBatch,
}));

vi.mock("@/server/embeddingService", () => ({
  generateEmbedding: mockGenerateEmbedding,
  generateMockEmbedding: mockGenerateMockEmbedding,
  getEmbeddingModelId: mockGetEmbeddingModelId,
}));

type TestDb = Awaited<ReturnType<typeof createPgMemDb>>;

function fakeEmbedding(text: string) {
  const base = new Array(8).fill(0);
  for (let index = 0; index < text.length; index += 1) {
    base[index % base.length] += text.charCodeAt(index) / 100;
  }
  return base;
}

describe("smartMatchService", () => {
  async function setupHarness() {
    vi.clearAllMocks();
    const harness = await createPgMemDb();
    const db = harness.db as unknown as Db;

    mockGenerateEmbedding.mockImplementation(async (text: string) => fakeEmbedding(text));
    mockGenerateMockEmbedding.mockImplementation((text: string) => fakeEmbedding(text));
    mockGetEmbeddingModelId.mockReturnValue("test:embedding");

    return { harness, db };
  }

  it("builds a buyer profile from contact data and returns ranked active listings", async () => {
    const { harness, db } = await setupHarness();

    try {
    await harness.db.insert(contacts).values({
      id: 301,
      agentId: 7,
      source: "agent_site_chat",
      name: "Olivia Chen",
      email: "olivia@example.com",
      preferredLanguage: "zh",
      area: "Irvine",
      budgetMin: "1800000",
      budgetMax: "2200000",
      summary: "Buyer looking for a detached home near top schools.",
      notes: "Natural light and a usable backyard matter.",
      tags: ["buyer", "relocation"],
    });

    await harness.db.insert(clients).values({
      id: 77,
      agentId: 7,
      email: "olivia@example.com",
      preferredCities: JSON.stringify(["Irvine"]),
      preferredBedrooms: 4,
      preferredPropertyTypes: JSON.stringify(["Single Family"]),
      mustHaveFeatures: JSON.stringify(["yard", "bright kitchen"]),
      dealBreakers: JSON.stringify(["busy road"]),
      profileSummary: "Relocating family prioritizing schools and backyard space.",
    });

    await harness.db.insert(listingSubscriptions).values({
      id: 901,
      agentId: 7,
      clientId: 77,
      name: "Olivia Irvine Search",
      cities: ["Irvine"],
      minPrice: "1800000",
      maxPrice: "2200000",
      minBeds: 4,
      propertyTypes: ["Single Family"],
      keywords: "yard, bright kitchen",
      channel: "email",
      frequency: "instant",
      language: "zh",
      status: "active",
    });

    mockSearchListings.mockResolvedValue({
      data: [
        {
          listingKey: "irvine-1",
          listingId: "MLS-1",
          standardStatus: "Active",
          unparsedAddress: "101 Scenic Hill",
          city: "Irvine",
          stateOrProvince: "CA",
          postalCode: "92618",
          latitude: "33.6",
          longitude: "-117.7",
          listPrice: "1990000",
          propertyType: "Single Family",
          bedroomsTotal: 4,
          bathroomsTotalInteger: 4,
          livingArea: "3120",
          publicRemarks: "Bright kitchen, private yard, and flexible family room near top schools.",
          listAgentFullName: "Agent One",
          listOfficeName: "Office One",
        },
        {
          listingKey: "tustin-2",
          listingId: "MLS-2",
          standardStatus: "Active",
          unparsedAddress: "88 City Lights",
          city: "Tustin",
          stateOrProvince: "CA",
          postalCode: "92782",
          latitude: "33.7",
          longitude: "-117.8",
          listPrice: "2050000",
          propertyType: "Condo",
          bedroomsTotal: 3,
          bathroomsTotalInteger: 3,
          livingArea: "2400",
          publicRemarks: "Modern condo with city views on a busy road.",
          listAgentFullName: "Agent Two",
          listOfficeName: "Office Two",
        },
      ],
      meta: {
        total: 2,
        page: 1,
        perPage: 24,
        totalPages: 1,
      },
    });

    mockGetListingsBatch.mockResolvedValue(
      new Map([
        [
          "irvine-1",
          {
            data: {
              listingKey: "irvine-1",
            },
            imageUrls: ["https://example.com/irvine-1.jpg"],
            media: [],
            source: "MLSGrid",
            fallbackUsed: false,
            freshness: "fresh",
          },
        ],
      ])
    );

    const result = await generateSmartMatch(
      {
        agentId: 7,
        contactId: 301,
        locale: "zh",
        searchBrief: "客户想尽快看学区好的独栋，最好有院子和亮一点的厨房。",
        city: "Irvine",
        propertyType: "Single Family",
        minBedrooms: 4,
        topK: 5,
      },
      db
    );

    const profileRows = await harness.db.select().from(buyerProfiles);
    const runRows = await harness.db.select().from(smartMatchRuns);
    const resultRows = await harness.db.select().from(smartMatchResults);

    expect(result.retrievalSource).toBe("search");
    expect(result.recommendations).toHaveLength(2);
    expect(result.recommendations[0]?.property.listingKey).toBe("irvine-1");
    expect(result.recommendations[0]?.matchReasons.join(" ")).toContain("匹配");

    expect(profileRows).toHaveLength(1);
    expect(profileRows[0]?.contactId).toBe(301);
    expect(profileRows[0]?.canonicalSummary).toContain("Olivia Chen");
    expect(profileRows[0]?.canonicalSummary).toContain("Current home search brief");
    expect(profileRows[0]?.hardFilters).toMatchObject({
      city: "Irvine",
      propertyType: "Single Family",
      minBedrooms: 4,
      status: "Active",
    });

    expect(runRows).toHaveLength(1);
    expect(runRows[0]?.contactId).toBe(301);
    expect(runRows[0]?.candidateCount).toBe(2);
    expect(resultRows).toHaveLength(2);
    expect(resultRows[0]?.listingKey).toBe("irvine-1");
    } finally {
      await harness.close();
    }
  });

  it("exposes buyer profiles and recent runs in the workspace query", async () => {
    const { harness, db } = await setupHarness();

    try {
    await harness.db.insert(contacts).values({
      id: 302,
      agentId: 7,
      source: "manual",
      name: "Daniel Wu",
      email: "daniel@example.com",
      preferredLanguage: "en",
      area: "San Jose",
      budgetMin: "1200000",
      budgetMax: "1500000",
    });

    mockSearchListings.mockResolvedValue({
      data: [
        {
          listingKey: "sj-1",
          listingId: "MLS-3",
          standardStatus: "Active",
          unparsedAddress: "9 Willow Glen",
          city: "San Jose",
          stateOrProvince: "CA",
          postalCode: "95125",
          latitude: "37.3",
          longitude: "-121.9",
          listPrice: "1350000",
          propertyType: "Single Family",
          bedroomsTotal: 3,
          bathroomsTotalInteger: 2,
          livingArea: "1880",
          publicRemarks: "Renovated home near Willow Glen with yard.",
          listAgentFullName: "Agent Three",
          listOfficeName: "Office Three",
        },
      ],
      meta: {
        total: 1,
        page: 1,
        perPage: 24,
        totalPages: 1,
      },
    });
    mockGetListingsBatch.mockResolvedValue(new Map());

    await generateSmartMatch(
      {
        agentId: 7,
        contactId: 302,
        locale: "en",
        searchBrief: "Need an updated single family home with yard.",
        city: "San Jose",
        propertyType: "Single Family",
        topK: 3,
      },
      db
    );

    const workspace = await getSmartMatchWorkspace({ agentId: 7 }, db);

    expect(workspace.contacts).toHaveLength(1);
    expect(workspace.contacts[0]?.buyerProfile).not.toBeNull();
    expect(workspace.recentRuns).toHaveLength(1);
    expect(workspace.recentRuns[0]?.contactId).toBe(302);
    } finally {
      await harness.close();
    }
  });
});
