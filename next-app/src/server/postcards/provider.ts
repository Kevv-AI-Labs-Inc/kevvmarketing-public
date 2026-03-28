export type PostcardDispatchInput = {
  mailingId: number;
  recipient: {
    name: string;
    addressLine1: string;
    addressLine2?: string | null;
    city: string;
    state: string;
    postalCode: string;
  };
  sizeCode: string;
  sendDate?: Date | null;
};

export type PostcardDispatchResult = {
  provider: string;
  providerReference: string;
  status: "submitted" | "mailed";
  expectedDeliveryAt?: Date | null;
  payload: Record<string, unknown>;
};

export async function dispatchPostcard(input: PostcardDispatchInput) {
  const baseDate = input.sendDate && input.sendDate > new Date() ? input.sendDate : new Date();

  return {
    provider: "lob_mock",
    providerReference: `mock_${input.mailingId}_${Date.now()}`,
    status: "mailed",
    expectedDeliveryAt: new Date(baseDate.getTime() + 4 * 24 * 60 * 60 * 1000),
    payload: {
      mode: "mock",
      sizeCode: input.sizeCode,
    },
  } satisfies PostcardDispatchResult;
}
