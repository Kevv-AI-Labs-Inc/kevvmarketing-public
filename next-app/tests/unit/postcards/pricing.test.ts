import { describe, expect, it } from "vitest";

import { quotePostcardCampaign } from "@/server/postcards/pricing";

describe("quotePostcardCampaign", () => {
  it("uses the requested size card rate and service markup", () => {
    const quote = quotePostcardCampaign("6x11", 25);

    expect(quote).toEqual({
      unitPriceCents: 126,
      subtotalCents: 3150,
      serviceFeeCents: 1125,
      totalCents: 4275,
    });
  });

  it("falls back to the default postcard size when size code is unknown", () => {
    const quote = quotePostcardCampaign("unknown-size", 10);

    expect(quote.unitPriceCents).toBe(87);
    expect(quote.totalCents).toBe(1320);
  });
});
