"use client";
import dynamic from "next/dynamic";
const XhsShare = dynamic(() => import("@/pages-legacy/XhsShare"), { ssr: false });
export default function Page() { return <XhsShare />; }
