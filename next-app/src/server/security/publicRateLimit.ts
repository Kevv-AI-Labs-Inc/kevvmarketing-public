import { TRPCError } from "@trpc/server";
import { and, eq, gte, sql } from "drizzle-orm";

import { getDb, type Db } from "@/lib/db";
import { clientEvents, magicLinks } from "@/lib/db/schema";

type DbLike = Db;

type PublicEventRateLimitInput = {
  db?: DbLike;
  ipAddress?: string | null;
  eventType: string;
  sourceType: string;
  sourceId: string;
  windowMs: number;
  maxRequests: number;
  message: string;
};

type MagicLinkRateLimitInput = {
  db?: DbLike;
  email: string;
  ipAddress?: string | null;
  emailCooldownMs?: number;
  ipWindowMs?: number;
  ipMaxRequests?: number;
};

export function normalizeRateLimitIp(value?: string | null): string | null {
  const raw = value?.split(",")[0]?.trim();
  return raw && raw.length > 0 ? raw.slice(0, 45) : null;
}

export function isDevAuthBypassEnabled() {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.ENABLE_DEV_AUTH_BYPASS === "true"
  );
}

export async function assertPublicEventRateLimit(
  input: PublicEventRateLimitInput
) {
  const db = input.db ?? getDb();
  const ipAddress = normalizeRateLimitIp(input.ipAddress);
  if (!ipAddress) return;

  const since = new Date(Date.now() - input.windowMs);
  const [row] = await db
    .select({
      count: sql<number>`count(*)::integer`,
    })
    .from(clientEvents)
    .where(
      and(
        eq(clientEvents.ipAddress, ipAddress),
        eq(clientEvents.eventType, input.eventType),
        eq(clientEvents.sourceType, input.sourceType),
        eq(clientEvents.sourceId, input.sourceId),
        gte(clientEvents.createdAt, since)
      )
    );

  if (Number(row?.count ?? 0) >= input.maxRequests) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: input.message,
    });
  }
}

export async function assertMagicLinkRequestAllowed(
  input: MagicLinkRateLimitInput
) {
  const db = input.db ?? getDb();
  const requestIp = normalizeRateLimitIp(input.ipAddress);
  const emailCooldownMs = input.emailCooldownMs ?? 60_000;
  const ipWindowMs = input.ipWindowMs ?? 10 * 60_000;
  const ipMaxRequests = input.ipMaxRequests ?? 8;

  const recentEmailSince = new Date(Date.now() - emailCooldownMs);
  const [recentForEmail] = await db
    .select({
      count: sql<number>`count(*)::integer`,
    })
    .from(magicLinks)
    .where(
      and(
        eq(magicLinks.email, input.email),
        gte(magicLinks.createdAt, recentEmailSince)
      )
    );

  if (Number(recentForEmail?.count ?? 0) > 0) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "Please wait before requesting another sign-in link.",
    });
  }

  if (!requestIp) return;

  const recentIpSince = new Date(Date.now() - ipWindowMs);
  const [recentForIp] = await db
    .select({
      count: sql<number>`count(*)::integer`,
    })
    .from(magicLinks)
    .where(
      and(
        eq(magicLinks.requestIp, requestIp),
        gte(magicLinks.createdAt, recentIpSince)
      )
    );

  if (Number(recentForIp?.count ?? 0) >= ipMaxRequests) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "Too many sign-in attempts. Please try again later.",
    });
  }
}
