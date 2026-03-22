"use client";
import dynamic from "next/dynamic";
const Studios = dynamic(() => import("@/pages-legacy/Studios"), { ssr: false });
export default function Page() { return <Studios />; }
