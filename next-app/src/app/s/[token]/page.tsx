"use client";

import dynamic from "next/dynamic";
import { useParams } from "next/navigation";

const ListingShare = dynamic(() => import("@/pages-legacy/ListingShare"), { ssr: false });

export default function Page() {
  const params = useParams<{ token: string }>();
  return <ListingShare token={params.token} />;
}
