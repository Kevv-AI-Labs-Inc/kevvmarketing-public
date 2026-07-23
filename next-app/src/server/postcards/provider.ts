import { ENV } from "@/server/_core/env";

// ─── Types ────────────────────────────────────────────────

export type MailChannel = "postcard" | "letter";

export type PostcardDispatchInput = {
  mailingId: number;
  channel: MailChannel;
  recipient: {
    name: string;
    addressLine1: string;
    addressLine2?: string | null;
    city: string;
    state: string;
    postalCode: string;
  };
  returnAddress?: {
    name: string;
    addressLine1: string;
    city: string;
    state: string;
    postalCode: string;
  } | null;
  sizeCode: string; // "4x6" | "6x9" | "6x11" for postcards; ignored for letters
  sendDate?: Date | null;
  // Letter-specific
  letterHtml?: string | null; // HTML content for letter (up to 6 pages)
  // Postcard-specific
  frontHtml?: string | null;
  backHtml?: string | null;
  // Merge variables
  mergeVariables?: Record<string, string> | null;
};

export type PostcardDispatchResult = {
  provider: string;
  providerReference: string;
  status: "submitted" | "mailed";
  expectedDeliveryAt?: Date | null;
  payload: Record<string, unknown>;
};

export type AddressVerificationResult = {
  provider: string;
  isDeliverable: boolean;
  summary: string;
  normalizedAddress: {
    primary_line: string;
    secondary_line: string | null;
    city: string;
    state: string;
    zip_code: string;
    country: string;
  };
  providerPayload: Record<string, unknown>;
};

// ─── Lob API Helpers ──────────────────────────────────────

const LOB_BASE = "https://api.lob.com/v1";

function lobConfigured(): boolean {
  return ENV.lobApiKey.length > 0;
}

function lobHeaders(): Record<string, string> {
  // Lob uses Basic auth with api key as username, empty password
  const encoded = Buffer.from(`${ENV.lobApiKey}:`).toString("base64");
  return {
    Authorization: `Basic ${encoded}`,
    "Content-Type": "application/json",
    "Lob-Version": ENV.lobApiVersion,
  };
}

async function lobPost<T = unknown>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${LOB_BASE}${path}`, {
    method: "POST",
    headers: lobHeaders(),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error(`[Lob] POST ${path} failed ${res.status}:`, text);
    throw new Error(`Lob API error ${res.status}: ${text.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

// ─── Address Verification ─────────────────────────────────

export async function verifyAddress(input: {
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  state: string;
  postalCode: string;
}): Promise<AddressVerificationResult> {
  if (!lobConfigured()) {
    return mockVerifyAddress(input);
  }

  try {
    const result = await lobPost<{
      id: string;
      deliverability: string; // "deliverable" | "deliverable_unnecessary_unit" | "deliverable_incorrect_unit" | "deliverable_missing_unit" | "undeliverable"
      primary_line: string;
      secondary_line: string;
      city: string;
      state: string;
      zip_code: string;
      components: Record<string, unknown>;
    }>("/us_verifications", {
      primary_line: input.addressLine1,
      secondary_line: input.addressLine2 || "",
      city: input.city,
      state: input.state,
      zip_code: input.postalCode,
    });

    const isDeliverable = result.deliverability.startsWith("deliverable");

    return {
      provider: "lob",
      isDeliverable,
      summary: isDeliverable
        ? `Lob verified: ${result.deliverability}`
        : `Lob: ${result.deliverability} — address may not be reachable.`,
      normalizedAddress: {
        primary_line: result.primary_line || input.addressLine1,
        secondary_line: result.secondary_line || null,
        city: result.city || input.city,
        state: result.state || input.state,
        zip_code: result.zip_code || input.postalCode,
        country: "US",
      },
      providerPayload: { id: result.id, deliverability: result.deliverability, components: result.components },
    };
  } catch (err) {
    console.error("[Lob] Address verification failed, falling back to mock:", err);
    return mockVerifyAddress(input);
  }
}

function mockVerifyAddress(input: {
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  state: string;
  postalCode: string;
}): AddressVerificationResult {
  const normalized = {
    primary_line: input.addressLine1.trim(),
    secondary_line: input.addressLine2?.trim() || null,
    city: input.city.trim(),
    state: input.state.trim().toUpperCase(),
    zip_code: input.postalCode.trim(),
    country: "US",
  };
  const isDeliverable =
    normalized.primary_line.length > 4 &&
    /^[A-Z]{2}$/.test(normalized.state) &&
    /^\d{5}(?:-\d{4})?$/.test(normalized.zip_code);

  return {
    provider: "lob_mock",
    isDeliverable,
    summary: isDeliverable
      ? "Mock validation marked this address deliverable."
      : "Mock validation could not confirm this address.",
    normalizedAddress: normalized,
    providerPayload: { mode: "mock" },
  };
}

// ─── Dispatch (Postcard or Letter) ────────────────────────

export async function dispatchPostcard(input: PostcardDispatchInput): Promise<PostcardDispatchResult> {
  if (!lobConfigured()) {
    return mockDispatch(input);
  }

  try {
    if (input.channel === "letter") {
      return await dispatchLetter(input);
    }
    return await dispatchPostcardViaLob(input);
  } catch (err) {
    console.error(`[Lob] Dispatch failed for mailing ${input.mailingId}, falling back to mock:`, err);
    return mockDispatch(input);
  }
}

async function dispatchPostcardViaLob(input: PostcardDispatchInput): Promise<PostcardDispatchResult> {
  const to: Record<string, string> = {
    name: input.recipient.name,
    address_line1: input.recipient.addressLine1,
    city: input.recipient.city,
    state: input.recipient.state,
    zip: input.recipient.postalCode,
  };
  if (input.recipient.addressLine2) {
    to.address_line2 = input.recipient.addressLine2;
  }

  const body: Record<string, unknown> = {
    to,
    size: input.sizeCode || "6x9",
    front: input.frontHtml || "<html><body><h1>{{headline}}</h1></body></html>",
    back: input.backHtml || "<html><body><p>{{body}}</p></body></html>",
    ...(input.mergeVariables ? { merge_variables: input.mergeVariables } : {}),
    ...(input.sendDate && input.sendDate > new Date() ? { send_date: input.sendDate.toISOString().slice(0, 10) } : {}),
  };

  if (input.returnAddress) {
    body.from = {
      name: input.returnAddress.name,
      address_line1: input.returnAddress.addressLine1,
      city: input.returnAddress.city,
      state: input.returnAddress.state,
      zip: input.returnAddress.postalCode,
    };
  }

  const result = await lobPost<{
    id: string;
    expected_delivery_date: string;
    send_date: string;
  }>("/postcards", body);

  return {
    provider: "lob",
    providerReference: result.id,
    status: "submitted",
    expectedDeliveryAt: result.expected_delivery_date ? new Date(result.expected_delivery_date) : null,
    payload: { lobId: result.id, sendDate: result.send_date, channel: "postcard" },
  };
}

async function dispatchLetter(input: PostcardDispatchInput): Promise<PostcardDispatchResult> {
  const to: Record<string, string> = {
    name: input.recipient.name,
    address_line1: input.recipient.addressLine1,
    city: input.recipient.city,
    state: input.recipient.state,
    zip: input.recipient.postalCode,
  };
  if (input.recipient.addressLine2) {
    to.address_line2 = input.recipient.addressLine2;
  }

  const body: Record<string, unknown> = {
    to,
    file: input.letterHtml || "<html><body><h1>Market Update</h1><p>{{body}}</p></body></html>",
    color: true,
    ...(input.mergeVariables ? { merge_variables: input.mergeVariables } : {}),
    ...(input.sendDate && input.sendDate > new Date() ? { send_date: input.sendDate.toISOString().slice(0, 10) } : {}),
  };

  if (input.returnAddress) {
    body.from = {
      name: input.returnAddress.name,
      address_line1: input.returnAddress.addressLine1,
      city: input.returnAddress.city,
      state: input.returnAddress.state,
      zip: input.returnAddress.postalCode,
    };
  }

  const result = await lobPost<{
    id: string;
    expected_delivery_date: string;
    send_date: string;
  }>("/letters", body);

  return {
    provider: "lob",
    providerReference: result.id,
    status: "submitted",
    expectedDeliveryAt: result.expected_delivery_date ? new Date(result.expected_delivery_date) : null,
    payload: { lobId: result.id, sendDate: result.send_date, channel: "letter" },
  };
}

function mockDispatch(input: PostcardDispatchInput): PostcardDispatchResult {
  const baseDate = input.sendDate && input.sendDate > new Date() ? input.sendDate : new Date();
  return {
    provider: "lob_mock",
    providerReference: `mock_${input.mailingId}_${Date.now()}`,
    status: "mailed",
    expectedDeliveryAt: new Date(baseDate.getTime() + 4 * 24 * 60 * 60 * 1000),
    payload: { mode: "mock", sizeCode: input.sizeCode, channel: input.channel },
  };
}
