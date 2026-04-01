"use client";

import { useParams, useSearchParams } from "next/navigation";

import { PublicHomeValuePage } from "@/components/home-value/public-home-value-page";

export default function PublicHomeValueRoute() {
  const params = useParams<{ slug: string }>();
  const searchParams = useSearchParams();
  const linkToken = searchParams.get("ref") ?? undefined;
  return <PublicHomeValuePage slug={params.slug} linkToken={linkToken} />;
}
