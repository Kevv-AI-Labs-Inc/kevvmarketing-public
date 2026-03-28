import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ENV } from "@/server/_core/env";
import { generateHomeValueEstimate } from "@/server/homeValue/valuationEngine";

const cases = [
  {
    address: "123 Main St, Palo Alto, CA",
    locale: "en" as const,
    expectedCitySignal: "Palo Alto",
  },
  {
    address: "88 Riverside Blvd, New York, NY",
    locale: "en" as const,
    expectedCitySignal: "New York",
  },
  {
    address: "66 Garden Ave, Irvine, CA",
    locale: "zh" as const,
    expectedCitySignal: "Irvine",
  },
];

describe("home value harness invariants", () => {
  const originalListingDataServiceUrl = ENV.listingDataServiceUrl;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-01T12:00:00.000Z"));
    ENV.listingDataServiceUrl = "";
  });

  afterEach(() => {
    ENV.listingDataServiceUrl = originalListingDataServiceUrl;
  });

  it.each(cases)(
    "keeps valuation outputs sane for $address [$locale]",
    async ({ address, locale, expectedCitySignal }) => {
      const estimate = await generateHomeValueEstimate({
        address,
        locale,
      });

      expect(estimate.result.estimatedValueLow).toBeGreaterThan(0);
      expect(estimate.result.estimatedValueLow).toBeLessThan(
        estimate.result.estimatedValue,
      );
      expect(estimate.result.estimatedValue).toBeLessThan(
        estimate.result.estimatedValueHigh,
      );
      expect(estimate.result.comparableSales).toHaveLength(3);
      expect(estimate.result.comparableSales.every((sale) => sale.price > 0)).toBe(
        true,
      );
      expect(estimate.result.marketSummary).toContain(expectedCitySignal);

      if (locale === "zh") {
        expect(estimate.summary).toMatch(/[\u4e00-\u9fff]/);
      } else {
        expect(estimate.summary).toContain("Kevv");
      }
    },
  );
});
