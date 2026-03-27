"use client";
import dynamic from "next/dynamic";
const AreaMagnetStudio = dynamic(() => import("@/pages-legacy/AreaMagnetStudio"), { ssr: false });
export default function Page() { return <AreaMagnetStudio />; }
