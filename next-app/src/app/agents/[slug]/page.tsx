"use client";

import { useParams } from "next/navigation";

import { PublicAgentSitePage } from "@/components/agent-site/public-agent-site-page";

export default function AgentPublicPageRoute() {
  const params = useParams<{ slug: string }>();
  return <PublicAgentSitePage slug={params.slug} />;
}
