"use client";
import dynamic from "next/dynamic";
const Listings = dynamic(() => import("@/pages-legacy/Listings"), { ssr: false });
export default function Page() { return <Listings />; }
