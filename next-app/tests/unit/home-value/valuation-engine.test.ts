import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ENV } from "@/server/_core/env";
import { generateHomeValueEstimate } from "@/server/homeValue/valuationEngine";
import { resolveByAddress } from "@/server/clients/listingDataClient";

vi.mock("@/server/clients/listingDataClient", () => ({
  resolveByAddress: vi.fn(),
  getCmaByListing: vi.fn(),
  getNeighborhoodSummary: vi.fn(),
}));

describe("generateHomeValueEstimate", () => {
  const originalListingDataServiceUrl = ENV.listingDataServiceUrl;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-01T12:00:00.000Z"));
    ENV.listingDataServiceUrl = "";
  });

  afterEach(() => {
    ENV.listingDataServiceUrl = originalListingDataServiceUrl;
  });

  it("generates a stable heuristic valuation when listing data is unavailable", async () => {
    const estimate = await generateHomeValueEstimate({
      address: "123 Main St, Palo Alto, CA",
      locale: "zh",
    });

    expect(estimate.provider).toBe("heuristic");
    expect(estimate.modelUsed).toBe("kevv-home-value-v1");
    expect(estimate.result.estimatedValueLow).toBeLessThan(
      estimate.result.estimatedValue,
    );
    expect(estimate.result.estimatedValue).toBeLessThan(
      estimate.result.estimatedValueHigh,
    );
    expect(estimate.result.comparableSales).toHaveLength(3);
    expect(estimate.summary).toContain("当前市场");
  });

  it("hydrates valuation inputs from listing data when the service is configured", async () => {
    ENV.listingDataServiceUrl = "https://listing-data.kevv.ai";
    vi.mocked(resolveByAddress).mockResolvedValue({
      property: {
        listingKey: "abc123",
        city: "Irvine",
        unparsedAddress: "8 Harbor Ridge, Irvine, CA",
        listPrice: "2150000",
        bedroomsTotal: 5,
        bathroomsTotalInteger: 4,
        livingArea: "3100",
        yearBuilt: 2014,
        propertyType: "Single Family",
      },
    } as never);

    const estimate = await generateHomeValueEstimate({
      address: "8 Harbor Ridge, Irvine, CA",
      locale: "en",
    });

    expect(resolveByAddress).toHaveBeenCalledWith({
      address: "8 Harbor Ridge",
      city: "Irvine",
      stateOrProvince: "CA",
      postalCode: undefined,
    });
    expect(estimate.provider).toBe("bbo-listing+heuristic");
    expect(estimate.result.estimatedValue).toBe(2150000);
    expect(estimate.result.propertyDetails).toMatchObject({
      beds: 5,
      baths: 4,
      sqft: 3100,
      yearBuilt: 2014,
      propertyType: "Single Family",
    });
  });
});
