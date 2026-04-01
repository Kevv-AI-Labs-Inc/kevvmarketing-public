"use client";
import dynamic from "next/dynamic";
const AreaMagnetStudio = dynamic(() => import("@/components/share/area-magnet-studio"), { ssr: false });
export default function Page() { return <AreaMagnetStudio />; }
