const basePostcardRates: Record<string, number> = {
  "4x6": 87,
  "6x9": 99,
  "6x11": 126,
};

const serviceMarkupPerPieceCents = 45;

export function quotePostcardCampaign(sizeCode: string, recipientCount: number) {
  const unitPriceCents = basePostcardRates[sizeCode] ?? basePostcardRates["4x6"];
  const subtotalCents = unitPriceCents * recipientCount;
  const serviceFeeCents = serviceMarkupPerPieceCents * recipientCount;
  const totalCents = subtotalCents + serviceFeeCents;

  return {
    unitPriceCents,
    subtotalCents,
    serviceFeeCents,
    totalCents,
  };
}
