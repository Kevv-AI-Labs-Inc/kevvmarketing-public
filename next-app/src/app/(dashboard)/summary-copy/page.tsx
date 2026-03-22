"use client";

import dynamic from "next/dynamic";

const AIRecommend = dynamic(() => import("@/pages-legacy/AIRecommend"), {
  ssr: false,
});

export default function Page() {
  return <AIRecommend />;
}
