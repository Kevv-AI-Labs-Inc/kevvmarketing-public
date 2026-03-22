"use client";
import dynamic from "next/dynamic";
const AgentDirectory = dynamic(() => import("@/pages-legacy/AgentDirectory"), { ssr: false });
export default function Page() { return <AgentDirectory />; }
