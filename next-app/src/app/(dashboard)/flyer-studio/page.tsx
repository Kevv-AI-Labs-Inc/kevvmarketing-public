"use client";
import dynamic from "next/dynamic";
const FlyerStudio = dynamic(() => import("@/pages-legacy/FlyerStudio"), { ssr: false });
export default function Page() { return <FlyerStudio />; }
