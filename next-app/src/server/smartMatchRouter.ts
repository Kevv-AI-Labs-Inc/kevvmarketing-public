/**
 * Smart Match Router
 *
 * AI-Native MLS matching + immersive sharing system.
 * Scope:
 * - Smart Match: requirement parsing + MLS recommendations
 * - Magic Share: curated MLS sharing (Story / Kanban / Report)
 */

import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { TRPCError } from "@trpc/server";
import { sql } from "drizzle-orm";
import { randomBytes } from "crypto";
import { invokeLLM } from "./_core/llm";

// ─── DB Table Setup (dynamic migration) ────────────────

type Database = NonNullable<Awaited<ReturnType<typeof getDb>>>;

let ensureTablesPromise: Promise<void> | null = null;

async function ensureSmartMatchTables(db: Database) {
    if (!ensureTablesPromise) {
        ensureTablesPromise = (async () => {
            await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "smart_match_sessions" (
          "id" SERIAL PRIMARY KEY,
          "token" VARCHAR(64) UNIQUE NOT NULL,
          "status" VARCHAR(20) DEFAULT 'active' NOT NULL,
          "experience_mode" VARCHAR(20) DEFAULT 'story' NOT NULL,
          "client_name" VARCHAR(255),
          "client_needs" TEXT,
          "agent_open_id" VARCHAR(64) NOT NULL,
          "agent_name" VARCHAR(255),
          "share_config" JSONB,
          "mls_listings" JSONB,
          "external_listings" JSONB,
          "ai_welcome_text" TEXT,
          "market_brief" JSONB,
          "view_count" INT DEFAULT 0 NOT NULL,
          "last_viewed_at" TIMESTAMPTZ,
          "created_at" TIMESTAMPTZ DEFAULT NOW() NOT NULL,
          "updated_at" TIMESTAMPTZ DEFAULT NOW() NOT NULL
        );
      `);

            // Add new columns to existing table (safe with IF NOT EXISTS via DO block)
            await db.execute(sql`
        DO $$ BEGIN
          ALTER TABLE "smart_match_sessions" ADD COLUMN "experience_mode" VARCHAR(20) DEFAULT 'story' NOT NULL;
        EXCEPTION WHEN duplicate_column THEN NULL; END $$;
      `);
            await db.execute(sql`
        DO $$ BEGIN
          ALTER TABLE "smart_match_sessions" ADD COLUMN "ai_welcome_text" TEXT;
        EXCEPTION WHEN duplicate_column THEN NULL; END $$;
      `);
            await db.execute(sql`
        DO $$ BEGIN
          ALTER TABLE "smart_match_sessions" ADD COLUMN "market_brief" JSONB;
        EXCEPTION WHEN duplicate_column THEN NULL; END $$;
      `);

            await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "smart_match_feedback" (
          "id" SERIAL PRIMARY KEY,
          "session_id" INT NOT NULL,
          "listing_identifier" VARCHAR(500) NOT NULL,
          "reaction" VARCHAR(20),
          "comment" TEXT,
          "feedback_type" VARCHAR(20) DEFAULT 'reaction' NOT NULL,
          "listing_type" VARCHAR(20) DEFAULT 'mls' NOT NULL,
          "created_at" TIMESTAMPTZ DEFAULT NOW() NOT NULL
        );
      `);

            // Add new columns to feedback table
            await db.execute(sql`
        DO $$ BEGIN
          ALTER TABLE "smart_match_feedback" ADD COLUMN "feedback_type" VARCHAR(20) DEFAULT 'reaction' NOT NULL;
        EXCEPTION WHEN duplicate_column THEN NULL; END $$;
      `);
            await db.execute(sql`
        DO $$ BEGIN
          ALTER TABLE "smart_match_feedback" ADD COLUMN "listing_type" VARCHAR(20) DEFAULT 'mls' NOT NULL;
        EXCEPTION WHEN duplicate_column THEN NULL; END $$;
      `);
            await db.execute(sql`
        DO $$ BEGIN
          ALTER TABLE "smart_match_feedback" ADD COLUMN "comment_text" TEXT;
        EXCEPTION WHEN duplicate_column THEN NULL; END $$;
      `);
            await db.execute(sql`
        DO $$ BEGIN
          ALTER TABLE "smart_match_sessions" ADD COLUMN "agent_profile" JSONB;
        EXCEPTION WHEN duplicate_column THEN NULL; END $$;
      `);

            await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "smart_match_sessions_token_idx"
          ON "smart_match_sessions" ("token");
      `);

            await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "smart_match_feedback_session_idx"
          ON "smart_match_feedback" ("session_id", "created_at" DESC);
      `);
        })().catch((error) => {
            ensureTablesPromise = null;
            throw error;
        });
    }
    await ensureTablesPromise;
}

// ─── Helpers ─────────────────────────────────────────────

function getRows<T>(result: unknown): T[] {
    if (Array.isArray(result)) return result as T[];
    if (result && typeof result === "object") {
        const rows = (result as { rows?: unknown }).rows;
        if (Array.isArray(rows)) return rows as T[];
    }
    return [];
}

function getFirstRow<T>(result: unknown): T | null {
    const rows = getRows<T>(result);
    return rows[0] ?? null;
}

type SmartMatchSessionRow = {
    id: number;
    token: string;
    status?: string | null;
    experience_mode?: string | null;
    client_name?: string | null;
    client_needs?: string | null;
    agent_open_id?: string | null;
    agent_name?: string | null;
    share_config?: unknown;
    mls_listings?: unknown;
    external_listings?: unknown;
    ai_welcome_text?: string | null;
    market_brief?: unknown;
    agent_profile?: unknown;
    view_count?: number | null;
    last_viewed_at?: unknown;
    created_at?: unknown;
};

type SmartMatchFeedbackRow = {
    session_id?: number;
    listing_identifier?: string;
    reaction?: string | null;
    comment?: string | null;
    feedback_type?: string | null;
    listing_type?: string | null;
    created_at?: unknown;
};

async function generateUniqueToken(db: Database): Promise<string> {
    for (let i = 0; i < 8; i++) {
        const token = randomBytes(18).toString("base64url");
        const existing = await db.execute(
            sql`SELECT 1 FROM "smart_match_sessions" WHERE "token" = ${token} LIMIT 1`
        );
        if (getRows<Record<string, unknown>>(existing).length === 0) {
            return token;
        }
    }
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Unable to create unique token" });
}

function parseJsonField<T>(value: unknown): T | null {
    if (typeof value === "string") {
        try { return JSON.parse(value) as T; } catch { return value as T; }
    }
    return (value ?? null) as T | null;
}

// ─── Shared Schemas ──────────────────────────────────────

const mlsListingSchema = z.object({
    listingKey: z.string(),
    address: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    price: z.string().optional(),
    beds: z.string().optional(),
    baths: z.string().optional(),
    sqft: z.string().optional(),
    propertyType: z.string().optional(),
    publicRemarks: z.string().optional(),
    pitch: z.string().optional(),
    riskNotes: z.string().optional(),
    strategyTip: z.string().optional(),
    matchAnalysis: z.string().optional(),
    closingStrategy: z.string().optional(),
    matchReasons: z.array(z.string()).optional(),
    images: z.array(z.string()).optional(),
    latitude: z.string().optional(),
    longitude: z.string().optional(),
});

const externalListingSchema = z.object({
    url: z.string(),
    title: z.string().optional(),
    image: z.string().optional(),
    images: z.array(z.string()).optional(),
    description: z.string().optional(),
    address: z.string().trim().min(1),
    price: z.string().optional(),
    beds: z.string().optional(),
    baths: z.string().optional(),
    sqft: z.string().optional(),
    yearBuilt: z.string().optional(),
    source: z.string().optional(),
    pitch: z.string().optional(),
    riskNotes: z.string().optional(),
    strategyTip: z.string().optional(),
    matchAnalysis: z.string().optional(),
    closingStrategy: z.string().optional(),
    highlights: z.array(z.string()).optional(),
    latitude: z.string().optional(),
    longitude: z.string().optional(),
});

// ─── Router ──────────────────────────────────────────────

export const smartMatchRouter = router({
    /**
     * Generate AI-powered property recommendations (MLS only).
     */
    generateMatch: protectedProcedure
        .input(
            z.object({
                clientName: z.string().trim().min(1).max(255),
                clientNeeds: z.string().trim().min(1).max(5000),
                budgetMin: z.number().optional(),
                budgetMax: z.number().optional(),
                excludeKeys: z.array(z.string()).max(50).optional(),
                topK: z.number().int().min(1).max(20).default(10),
            })
        )
        .mutation(async () => {
            // TODO: Implement AI-powered recommendations via vector search
            return [];
        }),

    /**
     * Generate AI market brief for a client's target area
     * Returns area analysis, pricing context, and investment insights
     */
    generateMarketBrief: protectedProcedure
        .input(
            z.object({
                clientNeeds: z.string().trim().min(1).max(5000),
                clientName: z.string().trim().max(255).optional(),
                listingCount: z.number().int().min(0).max(30).default(0),
            })
        )
        .mutation(async ({ input }) => {
            try {
                const response = await invokeLLM({
                    task: "smart-match",
                    messages: [
                        {
                            role: "system",
                            content: `You are a senior real estate market analyst. Generate a concise market brief for a client's target area.
Output ONLY valid JSON with this exact structure (no markdown, no code blocks):
{
  "summary": "2-3 sentence market overview addressing the client directly",
  "avgPricePerSqft": "$XXX",
  "marketTrend": "up" | "down" | "stable",
  "inventoryLevel": "low" | "moderate" | "high",
  "competitionLevel": "low" | "moderate" | "high" | "very_high",
  "insights": ["insight 1", "insight 2", "insight 3"],
  "recommendation": "1-2 sentence strategic recommendation"
}
Write in the same language as the client's needs (Chinese if Chinese, English otherwise).`,
                        },
                        {
                            role: "user",
                            content: `Client: ${input.clientName || "Client"}
Needs: ${input.clientNeeds}
Properties selected: ${input.listingCount}

Generate a market brief for this client's target area.`,
                        },
                    ],
                });

                const content = response.choices[0]?.message?.content;
                if (content && typeof content === "string") {
                    // Try to parse JSON from the response
                    const cleaned = content.replace(/```json?\n?/g, "").replace(/```\n?/g, "").trim();
                    try {
                        return JSON.parse(cleaned);
                    } catch {
                        return { summary: content.trim(), insights: [] };
                    }
                }
                return { summary: "", insights: [] };
            } catch (error) {
                console.error("Market brief generation error:", error);
                return { summary: "", insights: [] };
            }
        }),

    /**
     * Generate AI welcome text for the share page
     */
    generateWelcomeText: protectedProcedure
        .input(
            z.object({
                clientName: z.string().trim().max(255),
                clientNeeds: z.string().trim().max(5000),
                agentName: z.string().trim().max(255),
                listingCount: z.number().int().min(1).max(30),
            })
        )
        .mutation(async ({ input }) => {
            try {
                const response = await invokeLLM({
                    task: "smart-match",
                    messages: [
                        {
                            role: "system",
                            content: `You are a top real estate agent writing a warm, professional welcome message for a client's personalized property listing page.
Keep it 2-3 sentences. Be personal and strategic — mention how many properties you screened, why you picked these, and any market context.
Write in the same language as the client's needs (Chinese if Chinese, English otherwise).
Do NOT include greetings like "Hi" or "Dear" — the UI will handle the greeting display.`,
                        },
                        {
                            role: "user",
                            content: `Agent: ${input.agentName}
Client: ${input.clientName}
Client Needs: ${input.clientNeeds}
Properties Selected: ${input.listingCount}

Write a welcome message.`,
                        },
                    ],
                });

                const content = response.choices[0]?.message?.content;
                return { text: (content && typeof content === "string") ? content.trim() : "" };
            } catch (error) {
                console.error("Welcome text generation error:", error);
                return { text: "" };
            }
        }),

    /**
     * AI-powered analysis to auto-fill share configuration.
     * Generates: headerDescription, strategyPoints, perPropertyPitch.
     */
    analyzeForShare: protectedProcedure
        .input(
            z.object({
                listings: z.array(z.object({
                    address: z.string().optional(),
                    price: z.string().optional(),
                    beds: z.string().optional(),
                    baths: z.string().optional(),
                    sqft: z.string().optional(),
                    propertyType: z.string().optional(),
                    city: z.string().optional(),
                    publicRemarks: z.string().optional(),
                })).min(1).max(30),
                clientNeeds: z.string().trim().max(5000).optional(),
            })
        )
        .mutation(async ({ input }) => {
            try {
                const listingSummaries = input.listings.map((l, i) => {
                    const parts = [
                        `#${i + 1}`,
                        l.address,
                        l.price ? `$${l.price}` : null,
                        l.beds ? `${l.beds}bd` : null,
                        l.baths ? `${l.baths}ba` : null,
                        l.sqft ? `${l.sqft}sqft` : null,
                        l.propertyType,
                        l.city,
                    ].filter(Boolean).join(" | ");
                    const remarks = l.publicRemarks ? `\nRemarks: ${l.publicRemarks.slice(0, 200)}` : "";
                    return parts + remarks;
                }).join("\n");

                const response = await invokeLLM({
                    task: "smart-match",
                    messages: [
                        {
                            role: "system",
                            content: `You are a top real estate agent preparing a curated property presentation for a client.
Based on the property data, generate polished content for the share page.
Output ONLY valid JSON (no markdown, no code blocks):
{
  "headerDescription": "2-3 sentence overview explaining why these properties were curated and what makes them special",
  "strategyPoints": ["strategy point 1", "strategy point 2", "strategy point 3"],
  "overallAnalysis": "1-2 sentence strategic recommendation"
}
- Strategy points: 3-5 bullet points covering location advantages, pricing strategy, market timing, or investment potential
- Write in the same language as the client's needs (Chinese if Chinese, English otherwise). Default to Chinese if no client needs specified.
- Be specific, professional, and persuasive.`,
                        },
                        {
                            role: "user",
                            content: `${input.clientNeeds ? `Client Needs: ${input.clientNeeds}\n\n` : ""}Properties:\n${listingSummaries}\n\nGenerate the share page content.`,
                        },
                    ],
                });

                const content = response.choices[0]?.message?.content;
                if (content && typeof content === "string") {
                    const cleaned = content.replace(/```json?\n?/g, "").replace(/```\n?/g, "").trim();
                    try {
                        return JSON.parse(cleaned);
                    } catch {
                        return { headerDescription: content.trim(), strategyPoints: [], overallAnalysis: "" };
                    }
                }
                return { headerDescription: "", strategyPoints: [], overallAnalysis: "" };
            } catch (error) {
                console.error("analyzeForShare error:", error);
                return { headerDescription: "", strategyPoints: [], overallAnalysis: "" };
            }
        }),

    /**
     * Create a smart match share session
     * Stores curated MLS + external listings for immersive sharing
     */
    createShare: protectedProcedure
        .input(
            z.object({
                experienceMode: z.enum(["story", "kanban", "report"]).default("story"),
                clientName: z.string().trim().max(255).optional(),
                clientNeeds: z.string().trim().max(5000).optional(),
                aiWelcomeText: z.string().trim().max(3000).optional(),
                marketBrief: z.record(z.string(), z.unknown()).optional(),
                shareConfig: z.object({
                    headerTitle: z.string().trim().max(255),
                    headerDescription: z.string().trim().max(2000).optional(),
                    accentColor: z.string().max(20).optional(),
                    strategyPoints: z.array(z.string().max(200)).max(10).optional(),
                }),
                mlsListings: z.array(mlsListingSchema).max(30).optional(),
                externalListings: z.array(externalListingSchema).max(20).optional(),
                agentProfile: z.object({
                    avatarUrl: z.string().max(1000).optional(),
                    phone: z.string().max(30).optional(),
                    email: z.string().max(255).optional(),
                    wechatId: z.string().max(100).optional(),
                    title: z.string().max(100).optional(),
                }).optional(),
            })
        )
        .mutation(async ({ ctx, input }) => {
            const db = await getDb();
            if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

            await ensureSmartMatchTables(db);

            const mlsCount = input.mlsListings?.length ?? 0;
            const extCount = input.externalListings?.length ?? 0;
            if (mlsCount === 0 && extCount === 0) {
                throw new TRPCError({ code: "BAD_REQUEST", message: "至少需要一套房源" });
            }

            const token = await generateUniqueToken(db);
            const now = new Date();

            await db.execute(sql`
        INSERT INTO "smart_match_sessions" (
          "token", "status", "experience_mode",
          "client_name", "client_needs",
          "agent_open_id", "agent_name",
          "share_config", "mls_listings", "external_listings",
          "ai_welcome_text", "market_brief", "agent_profile",
          "created_at", "updated_at"
        ) VALUES (
          ${token}, 'active', ${input.experienceMode},
          ${input.clientName ?? null}, ${input.clientNeeds ?? null},
          ${ctx.user.openId}, ${ctx.user.name ?? null},
          ${JSON.stringify(input.shareConfig)}::jsonb,
          ${JSON.stringify(input.mlsListings ?? [])}::jsonb,
          ${JSON.stringify(input.externalListings ?? [])}::jsonb,
          ${input.aiWelcomeText ?? null},
          ${input.marketBrief ? JSON.stringify(input.marketBrief) : null}::jsonb,
          ${input.agentProfile ? JSON.stringify(input.agentProfile) : null}::jsonb,
          ${now}, ${now}
        )
      `);

            return {
                token,
                sharePath: `/sm/${token}`,
                shareUrl: null as string | null,
                listingCount: mlsCount + extCount,
            };
        }),

    /**
     * Get a smart match share session (public, no auth)
     */
    getShare: publicProcedure
        .input(z.object({ token: z.string().trim().min(1) }))
        .query(async ({ input }) => {
            const db = await getDb();
            if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

            await ensureSmartMatchTables(db);

            const rows = await db.execute(
                sql`SELECT * FROM "smart_match_sessions" WHERE "token" = ${input.token} AND "status" = 'active' LIMIT 1`
            );
            const session = getFirstRow<SmartMatchSessionRow>(rows);

            if (!session) {
                throw new TRPCError({ code: "NOT_FOUND", message: "Share not found or expired" });
            }

            // Increment view count
            await db.execute(sql`
        UPDATE "smart_match_sessions"
        SET "view_count" = "view_count" + 1, "last_viewed_at" = NOW(), "updated_at" = NOW()
        WHERE "token" = ${input.token}
      `);

            // Get feedback
            const feedbackRows = await db.execute(
                sql`SELECT * FROM "smart_match_feedback" WHERE "session_id" = ${session.id} ORDER BY "created_at" DESC`
            );
            const feedback = getRows<SmartMatchFeedbackRow>(feedbackRows);

            return {
                experienceMode: session.experience_mode || "story",
                session: {
                    token: session.token,
                    clientName: session.client_name,
                    clientNeeds: session.client_needs,
                    viewCount: (session.view_count ?? 0) + 1,
                    createdAt: session.created_at,
                },
                shareConfig: parseJsonField<Record<string, unknown>>(session.share_config) ?? {},
                mlsListings: parseJsonField<Record<string, unknown>[]>(session.mls_listings) ?? [],
                externalListings: parseJsonField<Record<string, unknown>[]>(session.external_listings) ?? [],
                agentName: session.agent_name,
                agentProfile: parseJsonField<Record<string, unknown>>(session.agent_profile),
                aiWelcomeText: session.ai_welcome_text,
                marketBrief: parseJsonField<Record<string, unknown>>(session.market_brief),
                feedback,
            };
        }),

    /**
     * Submit client feedback on a listing (public, no auth)
     * Supports reactions (like/dislike), tour requests, and comments
     */
    submitFeedback: publicProcedure
        .input(
            z.object({
                token: z.string().trim().min(1),
                listingIdentifier: z.string().trim().min(1).max(500),
                reaction: z.enum(["like", "dislike", "neutral", "tour_request"]),
                comment: z.string().trim().max(2000).optional(),
                feedbackType: z.enum(["reaction", "comment", "tour_request"]).default("reaction"),
                listingType: z.enum(["mls", "external"]).default("mls"),
            })
        )
        .mutation(async ({ input }) => {
            const db = await getDb();
            if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

            await ensureSmartMatchTables(db);

            const rows = await db.execute(
                sql`SELECT "id" FROM "smart_match_sessions" WHERE "token" = ${input.token} AND "status" = 'active' LIMIT 1`
            );
            const session = getFirstRow<SmartMatchSessionRow>(rows);
            if (!session) {
                throw new TRPCError({ code: "NOT_FOUND", message: "Share not found" });
            }

            await db.execute(sql`
        INSERT INTO "smart_match_feedback" (
          "session_id", "listing_identifier", "reaction", "comment",
          "feedback_type", "listing_type"
        ) VALUES (
          ${session.id}, ${input.listingIdentifier}, ${input.reaction}, ${input.comment ?? null},
          ${input.feedbackType}, ${input.listingType}
        )
      `);

            return { success: true };
        }),

    /**
     * Submit a text comment on a listing (public, no auth)
     * Separate from reaction — allows longer text feedback
     */
    submitComment: publicProcedure
        .input(
            z.object({
                token: z.string().trim().min(1),
                listingIdentifier: z.string().trim().min(1).max(500),
                commentText: z.string().trim().min(1).max(2000),
                listingType: z.enum(["mls", "external"]).default("mls"),
            })
        )
        .mutation(async ({ input }) => {
            const db = await getDb();
            if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

            await ensureSmartMatchTables(db);

            const rows = await db.execute(
                sql`SELECT "id" FROM "smart_match_sessions" WHERE "token" = ${input.token} AND "status" = 'active' LIMIT 1`
            );
            const session = getFirstRow<SmartMatchSessionRow>(rows);
            if (!session) {
                throw new TRPCError({ code: "NOT_FOUND", message: "Share not found" });
            }

            await db.execute(sql`
        INSERT INTO "smart_match_feedback" (
          "session_id", "listing_identifier", "reaction", "comment", "comment_text",
          "feedback_type", "listing_type"
        ) VALUES (
          ${session.id}, ${input.listingIdentifier}, 'neutral', ${input.commentText}, ${input.commentText},
          'comment', ${input.listingType}
        )
      `);

            return { success: true };
        }),

    /**
     * Get analytics for a share session
     */
    getShareAnalytics: protectedProcedure
        .input(z.object({ token: z.string().trim().min(1) }))
        .query(async ({ ctx, input }) => {
            const db = await getDb();
            if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

            await ensureSmartMatchTables(db);

            const sessionRows = await db.execute(
                sql`SELECT "id", "view_count", "last_viewed_at", "created_at"
                    FROM "smart_match_sessions"
                    WHERE "token" = ${input.token} AND "agent_open_id" = ${ctx.user.openId}
                    LIMIT 1`
            );
            const session = getFirstRow<SmartMatchSessionRow>(sessionRows);
            if (!session) {
                throw new TRPCError({ code: "NOT_FOUND", message: "Session not found" });
            }

            const feedbackRows = await db.execute(
                sql`SELECT "listing_identifier", "reaction", "comment", "feedback_type", "listing_type", "created_at"
                    FROM "smart_match_feedback"
                    WHERE "session_id" = ${session.id}
                    ORDER BY "created_at" DESC`
            );
            const feedback = getRows<SmartMatchFeedbackRow>(feedbackRows);

            const likes = feedback.filter((f) => f.reaction === "like" || f.reaction === "tour_request").length;
            const dislikes = feedback.filter((f) => f.reaction === "dislike").length;
            const tourRequests = feedback.filter((f) => f.reaction === "tour_request").length;
            const comments = feedback.filter((f) => f.comment).length;

            return {
                viewCount: session.view_count ?? 0,
                lastViewedAt: session.last_viewed_at,
                likes,
                dislikes,
                tourRequests,
                comments,
                feedback,
            };
        }),

    /**
     * List agent's smart match sessions
     */
    listMine: protectedProcedure.query(async ({ ctx }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

        await ensureSmartMatchTables(db);

        const rows = await db.execute(
            sql`SELECT "token", "status", "experience_mode", "client_name", "client_needs", "view_count", "created_at"
          FROM "smart_match_sessions"
          WHERE "agent_open_id" = ${ctx.user.openId}
          ORDER BY "created_at" DESC
          LIMIT 20`
        );

        return getRows<SmartMatchSessionRow>(rows);
    }),

    /**
     * Plan optimized tour route for property viewing
     */
    planTourRoute: protectedProcedure
        .input(
            z.object({
                stops: z.array(z.object({
                    latitude: z.number(),
                    longitude: z.number(),
                    address: z.string().optional(),
                    label: z.string().optional(),
                })).min(2).max(15),
            })
        )
        .mutation(async ({ input }) => {
            const { analyzeWithGoogle } = await import("./mapProviders/googleProvider");
            const result = await analyzeWithGoogle({
                stops: input.stops.map((s, i) => ({
                    listingKey: s.label || `stop-${i}`,
                    address: s.address || null,
                    latitude: s.latitude,
                    longitude: s.longitude,
                })),
                optimizeWaypointOrder: true,
            });

            return {
                optimizedOrder: result.optimizedOrder,
                totalDistanceMeters: result.totalDistanceMeters,
                totalDurationSeconds: result.totalDurationSeconds,
                legs: result.legs.map(leg => ({
                    fromStopIndex: leg.fromStopIndex,
                    toStopIndex: leg.toStopIndex,
                    distanceText: leg.distanceText,
                    durationText: leg.durationText,
                    distanceMeters: leg.distanceMeters,
                    durationSeconds: leg.durationSeconds,
                })),
                path: result.path,
            };
        }),
});

export type SmartMatchRouter = typeof smartMatchRouter;
