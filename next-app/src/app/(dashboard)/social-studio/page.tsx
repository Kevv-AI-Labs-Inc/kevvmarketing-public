"use client";
import dynamic from "next/dynamic";
const SocialStudio = dynamic(() => import("@/pages-legacy/SocialStudio"), { ssr: false });
export default function Page() { return <SocialStudio />; }
