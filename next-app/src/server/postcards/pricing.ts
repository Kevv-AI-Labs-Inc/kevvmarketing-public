const basePostcardRates: Record<string, number> = {
  "4x6": 87,
  "6x9": 99,
  "6x11": 126,
};

const baseLetterRates: Record<string, number> = {
  "1_page": 105,
  "2_page": 115,
  "4_page": 135,
  "6_page": 155,
};

const serviceMarkupPerPieceCents = 45;

export function quotePostcardCampaign(sizeCode: string, recipientCount: number, channel: "postcard" | "letter" = "postcard") {
  const rates = channel === "letter" ? baseLetterRates : basePostcardRates;
  const defaultSize = channel === "letter" ? "2_page" : "4x6";
  const unitPriceCents = rates[sizeCode] ?? rates[defaultSize];
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
