"use client";
import dynamic from "next/dynamic";
const CMAStudio = dynamic(() => import("@/pages-legacy/CMAStudio"), { ssr: false });
export default function Page() { return <CMAStudio />; }
