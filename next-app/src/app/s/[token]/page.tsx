import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { shareSessions } from "@/lib/db/schema";
import { SharePageClient } from "./share-client";

type Props = { params: Promise<{ token: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;

  try {
    const db = getDb();
    const [session] = await db
      .select({
        title: shareSessions.title,
        introMessage: shareSessions.introMessage,
        sessionType: shareSessions.sessionType,
        clientName: shareSessions.clientName,
        agentBranding: shareSessions.agentBranding,
        status: shareSessions.status,
      })
      .from(shareSessions)
      .where(eq(shareSessions.token, token))
      .limit(1);

    if (!session || session.status !== "active") {
      return { title: "Share not found" };
    }

    // Extract agent photo from branding JSON for OG image
    const branding =
      session.agentBranding && typeof session.agentBranding === "object"
        ? (session.agentBranding as Record<string, unknown>)
        : {};
    const agentName =
      typeof branding.agentName === "string" ? branding.agentName : "";
    const avatarUrl =
      typeof branding.avatarUrl === "string" ? branding.avatarUrl : "";

    const typeLabelMap: Record<string, string> = {
      area_magnet: "Market Report",
      buyer_board: "Buyer Board",
      tour_recap: "Tour Recap",
      offer_worksheet: "Offer Analysis",
    };
    const typeLabel = typeLabelMap[session.sessionType ?? ""] ?? "Property Selection";

    const title = session.title || `${typeLabel} by ${agentName || "Agent"}`;
    const description =
      session.introMessage?.slice(0, 200) ||
      (session.clientName
        ? `Curated ${typeLabel.toLowerCase()} for ${session.clientName} by ${agentName || "your agent"}`
        : `A curated ${typeLabel.toLowerCase()} from ${agentName || "your agent"}`);

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        type: "article",
        ...(avatarUrl
          ? { images: [{ url: avatarUrl, width: 400, height: 400 }] }
          : {}),
      },
      twitter: {
        card: avatarUrl ? "summary" : "summary",
        title,
        description,
        ...(avatarUrl ? { images: [avatarUrl] } : {}),
      },
    };
  } catch {
    return { title: "Share" };
  }
}

export default async function Page({ params }: Props) {
  const { token } = await params;
  return <SharePageClient token={token} />;
}
