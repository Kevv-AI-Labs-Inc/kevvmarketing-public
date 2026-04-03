/**
 * Audience Engine — builds mailing lists from BBO property data + external sources.
 *
 * Phase 1: Query listing-data-service by zipcode for sold/expired/active properties.
 * Phase 2 (future): Integrate PropertyRadar, ATTOM, or other data providers.
 */

import { and, eq, inArray } from "drizzle-orm";
import { getDb, type Db } from "@/lib/db";
import {
  contacts,
  postcardAddressValidations,
  postcardAudienceLists,
} from "@/lib/db/schema";
import { ENV } from "@/server/_core/env";
import { verifyAddress } from "@/server/postcards/provider";

// ─── Types ────────────────────────────────────────────────

export type AudienceScanInput = {
  agentId: number;
  name: string;
  zipCodes: string[];
  listingStatus?: string; // "Sold" | "Expired" | "Active" | "Withdrawn"
  propertyTypes?: string[];
  minPrice?: number;
  maxPrice?: number;
  dateRange?: { from?: string; to?: string };
};

type LdsPropertyForAudience = {
  listingKey?: string | null;
  unparsedAddress?: string | null;
  city?: string | null;
  stateOrProvince?: string | null;
  postalCode?: string | null;
  listPrice?: string | null;
  propertyType?: string | null;
  standardStatus?: string | null;
  [key: string]: unknown;
};

// ─── LDS Query ────────────────────────────────────────────

const LDS_URL = ENV.listingDataServiceUrl.replace(/\/+$/, "");
const LDS_KEY = ENV.listingDataServiceApiKey;

async function queryLdsByZipcode(params: {
  zipCodes: string[];
  status?: string;
  propertyTypes?: string[];
  minPrice?: number;
  maxPrice?: number;
  limit?: number;
}): Promise<LdsPropertyForAudience[]> {
  if (!LDS_URL) return [];

  const allResults: LdsPropertyForAudience[] = [];

  // Query per zipcode (LDS may not support multi-zip in one call)
  for (const zip of params.zipCodes) {
    try {
      const url = new URL("/api/v1/listings/search", LDS_URL);
      url.searchParams.set("postalCode", zip);
      if (params.status) url.searchParams.set("status", params.status);
      if (params.propertyTypes?.length) url.searchParams.set("propertyType", params.propertyTypes[0]);
      if (params.minPrice) url.searchParams.set("minPrice", params.minPrice.toString());
      if (params.maxPrice) url.searchParams.set("maxPrice", params.maxPrice.toString());
      url.searchParams.set("limit", (params.limit ?? 200).toString());

      const res = await fetch(url.toString(), {
        headers: {
          ...(LDS_KEY ? { "x-api-key": LDS_KEY } : {}),
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(15_000),
      });

      if (res.ok) {
        const json = (await res.json()) as { items?: LdsPropertyForAudience[] };
        const data = json?.items ?? (Array.isArray(json) ? json : []);
        // Filter to exact zipcode match
        const filtered = (data ?? []).filter(
          (p) => p.postalCode?.startsWith(zip)
        );
        allResults.push(...filtered);
      }
    } catch (err) {
      console.error(`[AudienceEngine] Failed to query LDS for zip ${zip}:`, err);
    }
  }

  return allResults;
}

// ─── Property → Contact Conversion ───────────────────────

function propertyToContact(property: LdsPropertyForAudience) {
  const address = property.unparsedAddress?.trim();
  const city = property.city?.trim();
  const state = property.stateOrProvince?.trim()?.toUpperCase();
  const zip = property.postalCode?.trim();

  if (!address || !city || !state || !zip) return null;

  return {
    name: "Current Resident",
    addressLine1: address,
    addressLine2: null as string | null,
    city,
    state,
    postalCode: zip,
    tags: [
      property.standardStatus ? `status:${property.standardStatus.toLowerCase()}` : null,
      property.propertyType ? `type:${property.propertyType.toLowerCase().replace(/\s+/g, "_")}` : null,
      property.listPrice ? `price:${property.listPrice}` : null,
    ].filter(Boolean) as string[],
    metadata: {
      listingKey: property.listingKey,
      listPrice: property.listPrice,
      propertyType: property.propertyType,
      standardStatus: property.standardStatus,
    },
  };
}

// ─── Scan & Import ────────────────────────────────────────

export async function scanZipcodeAudience(
  input: AudienceScanInput,
  db: Db = getDb()
): Promise<{
  audienceListId: number;
  totalFound: number;
  imported: number;
  duplicatesSkipped: number;
}> {
  // 1. Query LDS for properties in the target zipcodes
  const properties = await queryLdsByZipcode({
    zipCodes: input.zipCodes,
    status: input.listingStatus,
    propertyTypes: input.propertyTypes,
    minPrice: input.minPrice,
    maxPrice: input.maxPrice,
  });

  // 2. Convert to contacts
  const potentialContacts = properties
    .map(propertyToContact)
    .filter(Boolean) as NonNullable<ReturnType<typeof propertyToContact>>[];

  // 3. Deduplicate against existing contacts
  const existingAddresses = await db
    .select({ addressLine1: contacts.addressLine1, postalCode: contacts.postalCode })
    .from(contacts)
    .where(eq(contacts.agentId, input.agentId));

  const existingSet = new Set(
    existingAddresses.map((c) => `${c.addressLine1?.toLowerCase()}|${c.postalCode}`)
  );

  const newContacts = potentialContacts.filter(
    (c) => !existingSet.has(`${c.addressLine1.toLowerCase()}|${c.postalCode}`)
  );

  // 4. Create audience list record
  const [audienceList] = await db
    .insert(postcardAudienceLists)
    .values({
      agentId: input.agentId,
      name: input.name,
      description: `Zipcode scan: ${input.zipCodes.join(", ")}${input.listingStatus ? ` (${input.listingStatus})` : ""}`,
      sourceType: "zipcode_scan",
      sourceConfig: {
        zipCodes: input.zipCodes,
        listingStatus: input.listingStatus,
        propertyTypes: input.propertyTypes,
        minPrice: input.minPrice,
        maxPrice: input.maxPrice,
        dateRange: input.dateRange,
      },
      contactCount: 0,
      status: "syncing",
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  // 5. Import new contacts with address verification
  let imported = 0;
  for (const c of newContacts) {
    const validation = await verifyAddress({
      addressLine1: c.addressLine1,
      addressLine2: c.addressLine2,
      city: c.city,
      state: c.state,
      postalCode: c.postalCode,
    });

    const [contact] = await db
      .insert(contacts)
      .values({
        agentId: input.agentId,
        source: "zipcode_scan",
        sourceRef: `audience:${audienceList.id}`,
        status: "qualified",
        score: validation.isDeliverable ? "warm" : "cold",
        intent: "direct_mail",
        name: c.name,
        preferredLanguage: "en",
        tags: c.tags,
        addressLine1: validation.normalizedAddress.primary_line || c.addressLine1,
        addressLine2: validation.normalizedAddress.secondary_line || c.addressLine2,
        city: validation.normalizedAddress.city || c.city,
        state: validation.normalizedAddress.state || c.state,
        postalCode: validation.normalizedAddress.zip_code || c.postalCode,
        country: "US",
        addressVerified: validation.isDeliverable,
        addressVerifiedAt: validation.isDeliverable ? new Date() : null,
        metadata: c.metadata as Record<string, unknown>,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    await db.insert(postcardAddressValidations).values({
      contactId: contact.id,
      provider: validation.provider,
      isDeliverable: validation.isDeliverable,
      analysisSummary: validation.summary,
      normalizedAddress: validation.normalizedAddress,
      providerPayload: validation.providerPayload,
      createdAt: new Date(),
    });

    imported++;
  }

  // 6. Update audience list with final count
  await db
    .update(postcardAudienceLists)
    .set({
      contactCount: imported,
      status: "active",
      lastSyncAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(postcardAudienceLists.id, audienceList.id));

  return {
    audienceListId: audienceList.id,
    totalFound: potentialContacts.length,
    imported,
    duplicatesSkipped: potentialContacts.length - newContacts.length,
  };
}

// ─── List Audience Lists ─────────────────────────────────

export async function listAudienceLists(agentId: number, db: Db = getDb()) {
  return db
    .select()
    .from(postcardAudienceLists)
    .where(eq(postcardAudienceLists.agentId, agentId))
    .orderBy(postcardAudienceLists.createdAt);
}
