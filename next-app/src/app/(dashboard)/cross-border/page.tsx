"use client";
import dynamic from "next/dynamic";
const CrossBorder = dynamic(() => import("@/pages-legacy/CrossBorder"), { ssr: false });
export default function Page() { return <CrossBorder />; }
