"use client";
import dynamic from "next/dynamic";
const NewListings = dynamic(() => import("@/pages-legacy/NewListings"), { ssr: false });
export default function Page() { return <NewListings />; }
