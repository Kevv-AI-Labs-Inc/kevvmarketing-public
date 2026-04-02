import { and, desc, eq, inArray, or } from "drizzle-orm";

import { getDb, type Db } from "@/lib/db";
import {
  contacts,
  generatedContent,
  type InsertPostcardMailing,
  postcardAddressValidations,
  postcardCampaigns,
  postcardContactImports,
  postcardEvents,
  postcardMailings,
  postcardTemplates,
} from "@/lib/db/schema";
import { buildDemoPostcardTemplate } from "@/server/demo/factories";
import { dispatchPostcard, verifyAddress } from "@/server/postcards/provider";
import { quotePostcardCampaign } from "@/server/postcards/pricing";

type AddressInput = {
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  state: string;
  postalCode: string;
};

const systemTemplateSeeds = [
  buildDemoPostcardTemplate({
    name: "Luxury Seller Valuation",
    category: "HOME_VALUATION",
    sizeCode: "6x9",
    note: "Seller-facing valuation postcard that pushes owners into the Home Value funnel.",
  }),
  buildDemoPostcardTemplate({
    id: 2,
    name: "Neighborhood Inventory Pulse",
    category: "MARKET_UPDATE",
    sizeCode: "6x11",
    note: "Market pulse mailer for sphere and warm homeowners.",
  }),
  buildDemoPostcardTemplate({
    id: 3,
    name: "Just Listed Launch",
    category: "JUST_LISTED",
    sizeCode: "4x6",
    note: "Fast-turn launch card for nearby homeowner prospecting.",
  }),
];

function normalizeOptional(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

function parseCsvLine(line: string) {
  const values: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"') {
      if (quoted && next === '"') {
        current += '"';
        index += 1;
        continue;
      }
      quoted = !quoted;
      continue;
    }

    if (char === "," && !quoted) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

function parseCsvText(csvText: string) {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    throw new Error("Provide a CSV with a header row and at least one data row.");
  }

  const headers = parseCsvLine(lines[0]).map((header) =>
    header.toLowerCase().replace(/[^a-z0-9]+/g, "_")
  );

  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return headers.reduce<Record<string, string>>((acc, header, index) => {
      acc[header] = values[index] ?? "";
      return acc;
    }, {});
  });
}

function mapCsvRowToContact(row: Record<string, string>) {
  const firstName = row.first_name || row.firstname || "";
  const lastName = row.last_name || row.lastname || "";
  const name =
    row.full_name ||
    row.name ||
    [firstName, lastName].filter(Boolean).join(" ");
  const addressLine1 =
    row.address || row.address1 || row.address_line_1 || row.street || "";
  const addressLine2 = row.address2 || row.address_line_2 || "";
  const city = row.city || "";
  const state = (row.state || row.province || "").toUpperCase();
  const postalCode = row.zip || row.zipcode || row.postal_code || "";
  const tags = (row.tags || "")
    .split(/[|,;]/)
    .map((item) => item.trim())
    .filter(Boolean);

  if (!addressLine1 || !city || !state || !postalCode) {
    return null;
  }

  return {
    name: name || "Current Resident",
    firstName: normalizeOptional(firstName),
    lastName: normalizeOptional(lastName),
    addressLine1,
    addressLine2: normalizeOptional(addressLine2),
    city,
    state,
    postalCode,
    tags,
  };
}

export async function validatePostalAddress(input: AddressInput) {
  return verifyAddress({
    addressLine1: input.addressLine1,
    addressLine2: input.addressLine2,
    city: input.city,
    state: input.state,
    postalCode: input.postalCode,
  });
}

export async function ensureSystemPostcardTemplates(db: Db = getDb()) {
  const existing = await db
    .select()
    .from(postcardTemplates)
    .where(eq(postcardTemplates.isSystem, true));

  if (existing.length > 0) return existing;

  await db.insert(postcardTemplates).values(
    systemTemplateSeeds.map((template) => ({
      agentId: null,
      name: template.name ?? "Template",
      category: template.category ?? "GENERAL",
      isSystem: true,
      sizeCode: template.sizeCode ?? "6x9",
      thumbnailUrl: template.thumbnailUrl ?? null,
      note: template.note ?? null,
      frontEditorState: {
        blocks: ["headline", "hero-image", "cta"],
      },
      backEditorState: {
        blocks: ["headline", "body", "agent-signoff"],
      },
      frontRenderDefinition: {
        theme: template.name,
      },
      backRenderDefinition: {
        theme: template.name,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    }))
  );

  return db
    .select()
    .from(postcardTemplates)
    .where(eq(postcardTemplates.isSystem, true))
    .orderBy(desc(postcardTemplates.createdAt));
}

export async function listPostcardTemplates(agentId: number, db: Db = getDb()) {
  await ensureSystemPostcardTemplates(db);
  return db
    .select()
    .from(postcardTemplates)
    .where(or(eq(postcardTemplates.isSystem, true), eq(postcardTemplates.agentId, agentId)))
    .orderBy(desc(postcardTemplates.isSystem), desc(postcardTemplates.createdAt));
}

export async function listPostcardContacts(agentId: number, db: Db = getDb()) {
  return db
    .select()
    .from(contacts)
    .where(and(eq(contacts.agentId, agentId), or(
      eq(contacts.source, "postcard_import"),
      eq(contacts.source, "home_value"),
      eq(contacts.source, "agent_site_form"),
      eq(contacts.source, "agent_site_chat"),
      eq(contacts.source, "zipcode_scan"),
    )))
    .orderBy(desc(contacts.updatedAt))
    .limit(500);
}

async function createValidatedContact(params: {
  agentId: number;
  name: string;
  firstName?: string | null;
  lastName?: string | null;
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  state: string;
  postalCode: string;
  tags?: string[];
  sourceRef?: string | null;
}, db: Db = getDb()) {
  const validation = await validatePostalAddress({
    addressLine1: params.addressLine1,
    addressLine2: params.addressLine2,
    city: params.city,
    state: params.state,
    postalCode: params.postalCode,
  });

  const [contact] = await db
    .insert(contacts)
    .values({
      agentId: params.agentId,
      source: "postcard_import",
      sourceRef: params.sourceRef ?? null,
      status: "qualified",
      score: validation.isDeliverable ? "warm" : "cold",
      intent: "direct_mail",
      name: params.name,
      firstName: params.firstName ?? null,
      lastName: params.lastName ?? null,
      preferredLanguage: "en",
      tags: params.tags ?? [],
      addressLine1:
        typeof validation.normalizedAddress.primary_line === "string"
          ? validation.normalizedAddress.primary_line
          : params.addressLine1,
      addressLine2:
        typeof validation.normalizedAddress.secondary_line === "string"
          ? validation.normalizedAddress.secondary_line
          : params.addressLine2 ?? null,
      city:
        typeof validation.normalizedAddress.city === "string"
          ? validation.normalizedAddress.city
          : params.city,
      state:
        typeof validation.normalizedAddress.state === "string"
          ? validation.normalizedAddress.state
          : params.state,
      postalCode:
        typeof validation.normalizedAddress.zip_code === "string"
          ? validation.normalizedAddress.zip_code
          : params.postalCode,
      country: "US",
      addressVerified: validation.isDeliverable,
      addressVerifiedAt: validation.isDeliverable ? new Date() : null,
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

  return contact;
}

export async function createManualPostcardContact(params: {
  agentId: number;
  fullName: string;
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  state: string;
  postalCode: string;
  tags?: string[];
}, db: Db = getDb()) {
  return createValidatedContact(
    {
      agentId: params.agentId,
      name: params.fullName,
      addressLine1: params.addressLine1,
      addressLine2: params.addressLine2,
      city: params.city,
      state: params.state,
      postalCode: params.postalCode,
      tags: params.tags,
      sourceRef: "manual",
    },
    db
  );
}

export async function importPostcardContactsFromCsv(
  agentId: number,
  csvText: string,
  db: Db = getDb()
) {
  const rows = parseCsvText(csvText);

  const [importRecord] = await db
    .insert(postcardContactImports)
    .values({
      agentId,
      filename: "pasted.csv",
      totalRows: rows.length,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  let importedRows = 0;
  let failedRows = 0;

  for (const row of rows) {
    const mapped = mapCsvRowToContact(row);
    if (!mapped) {
      failedRows += 1;
      continue;
    }

    await createValidatedContact(
      {
        agentId,
        name: mapped.name,
        firstName: mapped.firstName,
        lastName: mapped.lastName,
        addressLine1: mapped.addressLine1,
        addressLine2: mapped.addressLine2,
        city: mapped.city,
        state: mapped.state,
        postalCode: mapped.postalCode,
        tags: mapped.tags,
        sourceRef: `import:${importRecord.id}`,
      },
      db
    );

    importedRows += 1;
  }

  await db
    .update(postcardContactImports)
    .set({
      importedRows,
      failedRows,
      updatedAt: new Date(),
    })
    .where(eq(postcardContactImports.id, importRecord.id));

  return {
    importId: importRecord.id,
    importedRows,
    failedRows,
  };
}

function buildSuggestedCopy(params: {
  prompt: string;
  agentName: string;
  templateName: string;
  language: "en" | "zh" | "zh_en";
}) {
  const concisePrompt = params.prompt.trim();
  const enHeadline = concisePrompt.includes("valuation")
    ? "Curious what your home could command right now?"
    : "Your neighborhood is moving. Are you positioned for it?";
  const zhHeadline = concisePrompt.includes("估值")
    ? "想知道你家现在大概值多少钱吗？"
    : "你所在社区正在变化，你准备好了吗？";

  return {
    headline: params.language === "zh" ? zhHeadline : enHeadline,
    body:
      params.language === "zh"
        ? `这张 ${params.templateName} postcard 会把屋主引导回 AI 估值或市场更新漏斗。建议正文围绕“近期成交、窗口期、下一步咨询”展开。`
        : `This ${params.templateName} postcard should route homeowners into the AI valuation or market-update funnel. Keep the body focused on recent movement, timing pressure, and a clear next consultation step.`,
    callout:
      params.language === "zh"
        ? `联系 ${params.agentName}，拿到更贴近你房产情况的策略判断。`
        : `Reply to ${params.agentName} for a sharper pricing and timing read.`,
  };
}

export async function generatePostcardCopy(params: {
  agentId: number;
  prompt: string;
  templateName: string;
  language: "en" | "zh" | "zh_en";
  agentName: string;
}, db: Db = getDb()) {
  const suggestion = buildSuggestedCopy(params);

  await db.insert(generatedContent).values({
    agentId: params.agentId,
    sourceType: "manual",
    sourceId: params.templateName,
    contentType: "postcard_copy",
    content: JSON.stringify(suggestion, null, 2),
    language: params.language,
    platform: "postcard",
    metadata: {
      prompt: params.prompt,
    },
    createdAt: new Date(),
  });

  return suggestion;
}

async function recalculateCampaignCounts(campaignId: number, db: Db = getDb()) {
  const mailings = await db
    .select()
    .from(postcardMailings)
    .where(eq(postcardMailings.campaignId, campaignId));

  const contactIds = mailings.map((mailing) => mailing.contactId);
  const mailingContacts =
    contactIds.length > 0
      ? await db
          .select()
          .from(contacts)
          .where(inArray(contacts.id, contactIds))
      : [];

  const verifiedIds = new Set(
    mailingContacts.filter((contact) => contact.addressVerified).map((contact) => contact.id)
  );
  const submittedStatuses = new Set(["submitted", "mailed", "in_transit", "delivered", "returned"]);

  const counts = {
    recipientCount: mailings.length,
    validatedCount: mailings.filter((mailing) => verifiedIds.has(mailing.contactId)).length,
    submittedCount: mailings.filter((mailing) => submittedStatuses.has(mailing.status)).length,
    deliveredCount: mailings.filter((mailing) => mailing.status === "delivered").length,
    failedCount: mailings.filter((mailing) => mailing.status === "failed").length,
  };

  await db
    .update(postcardCampaigns)
    .set({
      ...counts,
      updatedAt: new Date(),
    })
    .where(eq(postcardCampaigns.id, campaignId));

  return counts;
}

export async function createDraftPostcardCampaign(params: {
  agentId: number;
  name: string;
  templateId: number;
  contactIds: number[];
}, db: Db = getDb()) {
  const [template] = await db
    .select()
    .from(postcardTemplates)
    .where(
      and(
        eq(postcardTemplates.id, params.templateId),
        or(eq(postcardTemplates.isSystem, true), eq(postcardTemplates.agentId, params.agentId))
      )
    )
    .limit(1);

  if (!template) {
    throw new Error("Choose a valid postcard template.");
  }

  const audience = await db
    .select()
    .from(contacts)
    .where(and(eq(contacts.agentId, params.agentId), inArray(contacts.id, params.contactIds)));

  const deliverableAudience = audience.filter(
    (contact) => contact.addressLine1 && contact.city && contact.state && contact.postalCode
  );

  if (deliverableAudience.length === 0) {
    throw new Error("Select at least one contact before creating a campaign.");
  }

  const quote = quotePostcardCampaign(template.sizeCode, deliverableAudience.length);

  const [campaign] = await db
    .insert(postcardCampaigns)
    .values({
      agentId: params.agentId,
      templateId: template.id,
      name: params.name,
      status: "draft",
      sendStrategy: "send_now",
      unitPriceCents: quote.unitPriceCents,
      subtotalCents: quote.subtotalCents,
      serviceFeeCents: quote.serviceFeeCents,
      totalCents: quote.totalCents,
      audienceSnapshot: {
        contactIds: deliverableAudience.map((contact) => contact.id),
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  const mailingRows: InsertPostcardMailing[] = deliverableAudience.map((contact) => ({
    campaignId: campaign.id,
    contactId: contact.id,
    provider: "lob_mock",
    channel: "postcard",
    status: contact.addressVerified ? "ready" : "validating",
    costCents: quote.unitPriceCents,
    createdAt: new Date(),
    updatedAt: new Date(),
  }));

  await db.insert(postcardMailings).values(
    mailingRows
  );

  await recalculateCampaignCounts(campaign.id, db);
  return campaign;
}

export async function processPostcardDispatch(campaignId: number, db: Db = getDb()) {
  const [campaign] = await db
    .select()
    .from(postcardCampaigns)
    .where(eq(postcardCampaigns.id, campaignId))
    .limit(1);

  if (!campaign) {
    throw new Error("Campaign not found.");
  }

  const [template] = await db
    .select()
    .from(postcardTemplates)
    .where(eq(postcardTemplates.id, campaign.templateId ?? 0))
    .limit(1);

  const mailings = await db
    .select()
    .from(postcardMailings)
    .where(eq(postcardMailings.campaignId, campaign.id));

  const relatedContacts =
    mailings.length > 0
      ? await db
          .select()
          .from(contacts)
          .where(inArray(contacts.id, mailings.map((mailing) => mailing.contactId)))
      : [];

  const contactsById = new Map(relatedContacts.map((contact) => [contact.id, contact]));

  await db
    .update(postcardCampaigns)
    .set({
      status: "processing",
      updatedAt: new Date(),
    })
    .where(eq(postcardCampaigns.id, campaign.id));

  for (const mailing of mailings) {
    const contact = contactsById.get(mailing.contactId);
    if (!contact?.addressLine1 || !contact.city || !contact.state || !contact.postalCode) {
      await db
        .update(postcardMailings)
        .set({
          status: "failed",
          failureReason: "Missing postal address",
          updatedAt: new Date(),
        })
        .where(eq(postcardMailings.id, mailing.id));
      await db.insert(postcardEvents).values({
        mailingId: mailing.id,
        eventType: "failed",
        payload: {
          reason: "missing_address",
        },
        eventTimestamp: new Date(),
        createdAt: new Date(),
      });
      continue;
    }

    const dispatch = await dispatchPostcard({
      mailingId: mailing.id,
      channel: mailing.channel as "postcard" | "letter",
      recipient: {
        name: contact.name || "Current Resident",
        addressLine1: contact.addressLine1,
        addressLine2: contact.addressLine2,
        city: contact.city,
        state: contact.state,
        postalCode: contact.postalCode,
      },
      sizeCode: template?.sizeCode ?? "6x9",
      sendDate: campaign.scheduledAt,
    });

    await db
      .update(postcardMailings)
      .set({
        provider: dispatch.provider,
        providerReference: dispatch.providerReference,
        status: dispatch.status,
        expectedDeliveryAt: dispatch.expectedDeliveryAt ?? null,
        renderPayload: {
          templateName: template?.name ?? null,
          ...dispatch.payload,
        },
        updatedAt: new Date(),
      })
      .where(eq(postcardMailings.id, mailing.id));

    await db.insert(postcardEvents).values({
      mailingId: mailing.id,
      eventType: dispatch.status,
      payload: dispatch.payload,
      eventTimestamp: new Date(),
      createdAt: new Date(),
    });
  }

  const counts = await recalculateCampaignCounts(campaign.id, db);

  await db
    .update(postcardCampaigns)
    .set({
      status: counts.failedCount === counts.recipientCount ? "failed" : "completed",
      updatedAt: new Date(),
    })
    .where(eq(postcardCampaigns.id, campaign.id));

  return counts;
}

export async function launchPostcardCampaign(params: {
  agentId: number;
  campaignId: number;
  sendStrategy: "send_now" | "scheduled" | "arrive_by";
  scheduledAt?: Date | null;
}, db: Db = getDb()) {
  const [campaign] = await db
    .select()
    .from(postcardCampaigns)
    .where(and(eq(postcardCampaigns.id, params.campaignId), eq(postcardCampaigns.agentId, params.agentId)))
    .limit(1);

  if (!campaign) {
    throw new Error("Campaign not found.");
  }

  const nextStatus = params.sendStrategy === "send_now" ? "queued" : "scheduled";

  await db
    .update(postcardCampaigns)
    .set({
      sendStrategy: params.sendStrategy,
      scheduledAt: params.scheduledAt ?? null,
      status: nextStatus,
      updatedAt: new Date(),
    })
    .where(eq(postcardCampaigns.id, campaign.id));

  const mailings = await db
    .select()
    .from(postcardMailings)
    .where(eq(postcardMailings.campaignId, campaign.id));

  if (mailings.length > 0) {
    await db.insert(postcardEvents).values(
      mailings.map((mailing) => ({
        mailingId: mailing.id,
        eventType: nextStatus,
        payload: {
          sendStrategy: params.sendStrategy,
          scheduledAt: params.scheduledAt?.toISOString() ?? null,
        },
        eventTimestamp: new Date(),
        createdAt: new Date(),
      }))
    );
  }

  if (params.sendStrategy === "send_now" && process.env.NODE_ENV !== "production") {
    await processPostcardDispatch(campaign.id, db);
  }

  return {
    campaignId: campaign.id,
    status: nextStatus,
  };
}

export async function listPostcardCampaigns(agentId: number, db: Db = getDb()) {
  const campaigns = await db
    .select({
      campaign: postcardCampaigns,
      templateName: postcardTemplates.name,
    })
    .from(postcardCampaigns)
    .leftJoin(postcardTemplates, eq(postcardCampaigns.templateId, postcardTemplates.id))
    .where(eq(postcardCampaigns.agentId, agentId))
    .orderBy(desc(postcardCampaigns.createdAt))
    .limit(20);

  return campaigns.map(({ campaign, templateName }) => ({
    ...campaign,
    templateName: templateName ?? "Template",
  }));
}
