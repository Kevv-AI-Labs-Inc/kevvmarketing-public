"use client";
import dynamic from "next/dynamic";
const WechatShare = dynamic(() => import("@/pages-legacy/WechatShare"), { ssr: false });
export default function Page() { return <WechatShare />; }
