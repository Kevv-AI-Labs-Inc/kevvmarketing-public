"use client";

import dynamic from "next/dynamic";

const Home = dynamic(() => import("@/pages-legacy/Home"), { ssr: false });

export default function DashboardPage() {
  return <Home />;
}
