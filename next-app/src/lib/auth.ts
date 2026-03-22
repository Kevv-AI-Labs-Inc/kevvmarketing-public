/**
 * NextAuth.js v5 configuration for Kevv Marketing.
 * Supports Google OAuth, Microsoft Entra ID, and one-time magic links.
 */

// NextAuth v5 reads AUTH_SECRET automatically.
// Fall back to JWT_SECRET for backward compat with old Express env config.
if (!process.env.AUTH_SECRET && process.env.JWT_SECRET) {
  process.env.AUTH_SECRET = process.env.JWT_SECRET;
}

// Ensure AUTH_URL is set so NextAuth knows its public origin when
// running behind Railway's reverse proxy (which internally listens on
// localhost:8080). Without this, baseUrl resolves to localhost:8080
// and all redirects break.
if (!process.env.AUTH_URL) {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    process.env.AUTH_URL = process.env.NEXT_PUBLIC_APP_URL;
  } else if (process.env.RAILWAY_PUBLIC_DOMAIN) {
    process.env.AUTH_URL = `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
  }
}

import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { magicLinks, users } from "@/lib/db/schema";
import {
  getGoogleClientId,
  getGoogleClientSecret,
  getMicrosoftClientId,
  getMicrosoftClientSecret,
  getMicrosoftIssuer,
} from "@/lib/auth-provider-config";
import { hashMagicLinkToken, normalizeMagicLinkEmail } from "@/lib/magic-link";

const googleClientId = getGoogleClientId();
const googleClientSecret = getGoogleClientSecret();
const microsoftClientId = getMicrosoftClientId();
const microsoftClientSecret = getMicrosoftClientSecret();
const microsoftIssuer = getMicrosoftIssuer();

type SupportedProvider = "google" | "microsoft-entra-id" | "magic-link";

/**
 * Upsert a user by email. Creates if not exists, updates provider IDs if exists.
 */
async function provisionUser(params: {
  email: string;
  name?: string | null;
  image?: string | null;
  provider: SupportedProvider;
  providerAccountId?: string | null;
}) {
  const db = getDb();
  const email = normalizeMagicLinkEmail(params.email);
  const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);

  const userPatch: Record<string, unknown> = {
    picture: params.image || existing?.picture || null,
    name: existing?.name || params.name || "Agent",
    loginMethod: params.provider,
    lastSignedIn: new Date(),
    updatedAt: new Date(),
    googleId:
      params.provider === "google"
        ? existing?.googleId || params.providerAccountId || null
        : existing?.googleId || null,
    microsoftEntraId:
      params.provider === "microsoft-entra-id"
        ? existing?.microsoftEntraId || params.providerAccountId || null
        : existing?.microsoftEntraId || null,
  };

  if (!existing) {
    // New user — generate a unique openId from the provider account ID or email
    const openId = params.providerAccountId || `ml_${email}`;
    await db.insert(users).values({
      openId,
      email,
      ...userPatch,
    } as typeof users.$inferInsert);
  } else {
    await db.update(users).set(userPatch).where(eq(users.id, existing.id));
  }

  const [dbUser] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!dbUser) throw new Error("User could not be provisioned");
  return dbUser;
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      id: "magic-link",
      name: "Magic Link",
      credentials: {
        token: { label: "Token", type: "text" },
      },
      async authorize(credentials) {
        const token = typeof credentials?.token === "string" ? credentials.token.trim() : "";
        if (!token) return null;

        const db = getDb();
        const tokenHash = hashMagicLinkToken(token);
        const [record] = await db
          .select()
          .from(magicLinks)
          .where(eq(magicLinks.tokenHash, tokenHash))
          .limit(1);

        if (!record) return null;
        if (new Date(record.expiresAt).getTime() <= Date.now()) {
          await db.delete(magicLinks).where(eq(magicLinks.id, record.id));
          return null;
        }

        await db.delete(magicLinks).where(eq(magicLinks.id, record.id));

        const dbUser = await provisionUser({
          email: record.email,
          provider: "magic-link",
        });

        return {
          id: String(dbUser.id),
          email: dbUser.email,
          name: dbUser.name,
          image: dbUser.picture,
        };
      },
    }),
    ...(googleClientId && googleClientSecret
      ? [Google({ clientId: googleClientId, clientSecret: googleClientSecret })]
      : []),
    ...(microsoftClientId && microsoftClientSecret
      ? [MicrosoftEntraID({
        clientId: microsoftClientId,
        clientSecret: microsoftClientSecret,
        issuer: microsoftIssuer,
      })]
      : []),
  ],
  callbacks: {
    async signIn({ user, account }) {
      const provider =
        account?.provider === "credentials" ? "magic-link" : account?.provider;

      if (!user.email) {
        const params = new URLSearchParams({ error: "missing-email" });
        if (provider) params.set("provider", provider);
        return `/login?${params.toString()}`;
      }

      if (
        provider !== "google" &&
        provider !== "microsoft-entra-id" &&
        provider !== "magic-link"
      ) {
        return `/login?error=unsupported-provider`;
      }

      if (provider === "magic-link") return true;

      try {
        await provisionUser({
          email: user.email,
          name: user.name,
          image: user.image,
          provider,
          providerAccountId: account?.providerAccountId,
        });
      } catch (error) {
        console.error("[Auth] Sign-in callback failed:", error);
        const params = new URLSearchParams({ error: "account-sync-failed" });
        params.set("provider", provider);
        return `/login?${params.toString()}`;
      }

      return true;
    },
    async jwt({ token, user, account }) {
      const email = user?.email || token.email;

      if (account?.provider) {
        token.authProvider =
          account.provider === "credentials" ? "magic-link" : account.provider;
      }

      if (email) {
        try {
          const db = getDb();
          const [dbUser] = await db
            .select()
            .from(users)
            .where(eq(users.email, email))
            .limit(1);

          if (dbUser) {
            token.userId = dbUser.id;
            token.role = dbUser.role;
          }
        } catch (error) {
          console.error("[Auth] JWT sync failed:", error);
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.userId !== undefined ? String(token.userId) : "";
        session.user.role = token.role as string;
        session.user.authProvider = token.authProvider as string | undefined;
      }
      return session;
    },
    async redirect({ url, baseUrl }) {
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      try {
        const target = new URL(url);
        if (target.origin === baseUrl) return url;
      } catch {
        return `${baseUrl}/`;
      }
      return `${baseUrl}/`;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: {
    strategy: "jwt",
  },
  trustHost: true,
});
