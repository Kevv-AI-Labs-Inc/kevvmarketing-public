"use client";
import dynamic from "next/dynamic";
const ShowingTour = dynamic(() => import("@/pages-legacy/ShowingTour"), { ssr: false });
export default function Page() { return <ShowingTour />; }
