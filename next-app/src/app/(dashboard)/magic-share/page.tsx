"use client";
import dynamic from "next/dynamic";
const MagicShareStudio = dynamic(() => import("@/pages-legacy/MagicShareStudio"), { ssr: false });
export default function Page() { return <MagicShareStudio />; }
