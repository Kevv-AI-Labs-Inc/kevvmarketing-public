import { NextRequest, NextResponse } from "next/server";
import { eq, lt } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { DEFAULT_AUTHENTICATED_PATH } from "@/const";
import { getDb } from "@/lib/db";
import { magicLinks } from "@/lib/db/schema";
import {
  createMagicLinkToken,
  getMagicLinkExpiry,
  normalizeMagicLinkEmail,
  buildMagicLinkUrl,
  buildMagicLinkEmailText,
} from "@/lib/magic-link";
import { isSystemEmailConfigured, sendSystemEmail } from "@/lib/email";
import { siteConfig } from "@/lib/site";
import {
  assertMagicLinkRequestAllowed,
  normalizeRateLimitIp,
} from "@/server/security/publicRateLimit";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    email?: string;
    callbackUrl?: string;
  } | null;

  const rawEmail = body?.email?.trim().toLowerCase();
  if (!rawEmail) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  if (!isSystemEmailConfigured()) {
    return NextResponse.json(
      { error: "Email delivery is not configured" },
      { status: 503 }
    );
  }

  const email = normalizeMagicLinkEmail(rawEmail);
  const { token, tokenHash } = createMagicLinkToken();
  const expiresAt = getMagicLinkExpiry();
  const callbackUrl = body?.callbackUrl || DEFAULT_AUTHENTICATED_PATH;
  const requestIp = normalizeRateLimitIp(
    request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip")
  );

  const db = getDb();

  try {
    await assertMagicLinkRequestAllowed({
      db,
      email,
      ipAddress: requestIp,
    });
  } catch (error) {
    if (error instanceof TRPCError && error.code === "TOO_MANY_REQUESTS") {
      return NextResponse.json({ error: error.message }, { status: 429 });
    }
    throw error;
  }

  await db.delete(magicLinks).where(lt(magicLinks.expiresAt, new Date()));
  await db.delete(magicLinks).where(eq(magicLinks.email, email));

  // Insert new token
  await db.insert(magicLinks).values({
    email,
    tokenHash,
    requestIp,
    expiresAt,
  });

  const signInUrl = buildMagicLinkUrl(token, callbackUrl);
  const text = buildMagicLinkEmailText(signInUrl);

  try {
    await sendSystemEmail({
      to: email,
      subject: `Sign in to ${siteConfig.name}`,
      text,
    });
  } catch (error) {
    console.error("[MagicLink] Failed to send:", error);
    return NextResponse.json(
      { error: "Failed to send sign-in email" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    message: "Check your inbox for a secure sign-in link.",
  });
}
