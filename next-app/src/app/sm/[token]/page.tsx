"use client";
import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
const SmartMatchShareInner = dynamic(() => import("@/pages-legacy/SmartMatchShare"), { ssr: false });
export default function Page() {
  const params = useParams<{ token: string }>();
  // SmartMatchShare reads token from URL via useParams inside itself (wouter), 
  // but in case it expects it as a prop, pass it through
  return <SmartMatchShareInner token={params.token} />;
}
