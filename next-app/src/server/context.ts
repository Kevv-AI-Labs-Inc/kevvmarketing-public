/**
 * tRPC context for Next.js — replaces the Express context.
 * Uses NextAuth session instead of custom SDK for authentication.
 */
import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import type { User } from "@/lib/db/schema";
import type { ApiKeyContext } from "@/server/apiKeyAuth";
import { isDevAuthBypassEnabled } from "@/server/security/publicRateLimit";

export type TrpcContext = {
  user: User | null;
  headers: Headers;
  ip: string | null;
  userAgent: string | null;
  apiKey?: ApiKeyContext;
};

function getHeaderValue(headers: Headers, name: string): string | null {
  const value = headers.get(name);
  return value && value.trim().length > 0 ? value.trim() : null;
}

function getRequestIp(headers: Headers): string | null {
  const forwardedFor = getHeaderValue(headers, "x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    return first || null;
  }
  return getHeaderValue(headers, "x-real-ip");
}

export async function createContext(
  opts: FetchCreateContextFnOptions
): Promise<TrpcContext> {
  let user: User | null = null;
  const headers = opts.req.headers;

  try {
    const session = await auth();
    if (session?.user?.email) {
      const db = getDb();
      const [dbUser] = await db
        .select()
        .from(users)
        .where(eq(users.email, session.user.email))
        .limit(1);
      user = dbUser ?? null;
    }
  } catch {
    user = null;
  }

  // Dev-mode bypass: provide a fake demo user when not authenticated
  if (!user && isDevAuthBypassEnabled()) {
    const now = new Date();
    user = {
      id: 0,
      openId: "dev-demo-user",
      name: "Demo User",
      email: "demo@kevv.ai",
      loginMethod: "dev-bypass",
      role: "admin",
      createdAt: now,
      updatedAt: now,
      lastSignedIn: now,
      picture: null,
      googleId: null,
      microsoftEntraId: null,
    } as User;
  }

  return {
    user,
    headers,
    ip: getRequestIp(headers),
    userAgent: getHeaderValue(headers, "user-agent"),
  };
}
