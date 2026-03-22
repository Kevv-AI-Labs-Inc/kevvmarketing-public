"use client";
import dynamic from "next/dynamic";
const Subscriptions = dynamic(() => import("@/pages-legacy/Subscriptions"), { ssr: false });
export default function Page() { return <Subscriptions />; }
