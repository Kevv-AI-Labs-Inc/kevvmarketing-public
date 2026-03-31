"use client";
import dynamic from "next/dynamic";
const Cultural = dynamic(() => import("@/pages-legacy/Cultural"), { ssr: false });
export default function Page() { return <Cultural />; }
