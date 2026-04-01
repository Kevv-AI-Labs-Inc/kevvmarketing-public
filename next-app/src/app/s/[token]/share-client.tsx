"use client";

import dynamic from "next/dynamic";

const ListingShare = dynamic(() => import("@/pages-legacy/ListingShare"), { ssr: false });

export function SharePageClient({ token }: { token: string }) {
  return <ListingShare token={token} />;
}
