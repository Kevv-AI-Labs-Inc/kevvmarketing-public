import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { agentProfiles, homeValueLinks } from "@/lib/db/schema";
import { HvRedirect } from "./hv-redirect";

type Props = { params: Promise<{ token: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const db = getDb();

  const [link] = await db
    .select({
      ogTitle: homeValueLinks.ogTitle,
      ogDescription: homeValueLinks.ogDescription,
      ogImageUrl: homeValueLinks.ogImageUrl,
      agentProfileId: homeValueLinks.agentProfileId,
    })
    .from(homeValueLinks)
    .where(eq(homeValueLinks.token, token))
    .limit(1);

  if (!link) {
    return { title: "Link not found" };
  }

  let agentName = "";
  if (link.agentProfileId) {
    const [profile] = await db
      .select({ name: agentProfiles.name })
      .from(agentProfiles)
      .where(eq(agentProfiles.id, link.agentProfileId))
      .limit(1);
    agentName = profile?.name ?? "";
  }

  const title = link.ogTitle ?? `What's your home worth? Free instant estimate${agentName ? ` from ${agentName}` : ""}`;
  const description =
    link.ogDescription ??
    "Get a free AI-powered home valuation in seconds. Find out your property's estimated market value with real comparable sales data.";

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "article",
      ...(link.ogImageUrl ? { images: [{ url: link.ogImageUrl, width: 1200, height: 630 }] } : {}),
    },
  };
}

export default async function HvTokenPage({ params }: Props) {
  const { token } = await params;
  return <HvRedirect token={token} />;
}
