"use client";

import { useParams } from "next/navigation";

import { PublicHomeValuePage } from "@/components/home-value/public-home-value-page";

export default function PublicHomeValueRoute() {
  const params = useParams<{ slug: string }>();
  return <PublicHomeValuePage slug={params.slug} />;
}
