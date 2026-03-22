/**
 * API Key Authentication Middleware
 * 
 * Validates API keys for service-to-service calls between trusted internal services.
 * Tracks usage per user/company/endpoint in the api_usage table.
 */

import { createHash } from "crypto";
import { eq, and } from "drizzle-orm";
import { getDb } from "./db";
import { apiKeys, apiUsage } from "../drizzle/schema";

function getStaticApiKeysFromEnv(): string[] {
    const single = (process.env.BBO_STATIC_API_KEY ?? "").trim();
    const multi = (process.env.BBO_STATIC_API_KEYS ?? "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    return [...(single ? [single] : []), ...multi];
}

/**
 * Hash an API key using SHA-256 for storage comparison.
 */
export function hashApiKey(key: string): string {
    return createHash("sha256").update(key).digest("hex");
}

/**
 * Generate a new API key with the standard prefix format.
 * Returns both the raw key (to give to the user) and its hash (to store).
 */
export function generateApiKey(): { rawKey: string; hash: string; prefix: string } {
    const randomPart = createHash("sha256")
        .update(crypto.randomUUID() + Date.now())
        .digest("hex")
        .slice(0, 32);
    const rawKey = `bbo_sk_${randomPart}`;
    const hash = hashApiKey(rawKey);
    const prefix = rawKey.slice(0, 10);
    return { rawKey, hash, prefix };
}

export type ApiKeyContext = {
    apiKeyId: number;
    companyId: number | null;
    label: string | null;
};

/**
 * Validate an API key from the Authorization header.
 * Returns the key context if valid, null if invalid.
 */
export async function validateApiKey(authHeader: string | undefined): Promise<ApiKeyContext | null> {
    if (!authHeader) return null;

    const key = authHeader.startsWith("Bearer ")
        ? authHeader.slice(7)
        : authHeader;

    if (!key.startsWith("bbo_sk_")) return null;

    // Optional static key(s) from environment for bootstrap/testing scenarios.
    // Keeps third-party integrations unblocked even before api_keys table is populated.
    const staticKeys = getStaticApiKeysFromEnv();
    if (staticKeys.includes(key)) {
        return {
            apiKeyId: 0,
            companyId: null,
            label: "static-env",
        };
    }

    const db = await getDb();
    if (!db) return null;

    const keyHash = hashApiKey(key);
    const result = await db
        .select()
        .from(apiKeys)
        .where(and(eq(apiKeys.keyHash, keyHash), eq(apiKeys.isActive, true)))
        .limit(1);

    if (result.length === 0) return null;

    const apiKey = result[0];

    // Update last used timestamp (fire and forget)
    db.update(apiKeys)
        .set({ lastUsedAt: new Date() })
        .where(eq(apiKeys.id, apiKey.id))
        .catch(() => { }); // Don't block on this

    return {
        apiKeyId: apiKey.id,
        companyId: apiKey.companyId,
        label: apiKey.label,
    };
}

/**
 * Record an API usage event for billing/analytics.
 */
export async function recordUsage(params: {
    apiKeyId: number;
    kevvUserId?: number;
    companyId?: number;
    endpoint: string;
    tokensUsed?: number;
    responseTimeMs?: number;
    success?: boolean;
    errorMessage?: string;
}): Promise<void> {
    const db = await getDb();
    if (!db) return;

    await db.insert(apiUsage).values({
        apiKeyId: params.apiKeyId,
        kevvUserId: params.kevvUserId ?? null,
        companyId: params.companyId ?? null,
        endpoint: params.endpoint,
        tokensUsed: params.tokensUsed ?? 0,
        responseTimeMs: params.responseTimeMs ?? null,
        success: params.success ?? true,
        errorMessage: params.errorMessage ?? null,
    }).catch((err) => {
        console.error("[API Usage] Failed to record usage:", err.message);
    });
}
