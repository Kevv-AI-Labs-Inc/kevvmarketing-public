import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
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

  const db = getDb();

  // Remove expired tokens for this email
  await db.delete(magicLinks).where(eq(magicLinks.email, email));

  // Insert new token
  await db.insert(magicLinks).values({
    email,
    tokenHash,
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
