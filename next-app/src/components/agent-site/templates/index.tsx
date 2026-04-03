"use client";

import dynamic from "next/dynamic";
import type { AgentProfile } from "@/lib/db/schema";

export type TemplateProps = {
  profile: AgentProfile;
  preview?: boolean;
};

// Lazy-load each template to keep initial bundle small.
const BoldTemplate = dynamic(
  () => import("./bold-template").then((m) => ({ default: m.BoldTemplate })),
  { ssr: false }
);
const ModernTemplate = dynamic(() => import("./modern-template"), { ssr: false });
const ElegantTemplate = dynamic(() => import("./elegant-template"), { ssr: false });
const ClassicTemplate = dynamic(() => import("./classic-template"), { ssr: false });
const MinimalTemplate = dynamic(() => import("./minimal-template"), { ssr: false });
const UrbanTemplate = dynamic(
  () => import("./urban-template").then((m) => ({ default: m.UrbanTemplate })),
  { ssr: false }
);

const templateMap: Record<string, React.ComponentType<TemplateProps>> = {
  bold: BoldTemplate,
  modern: ModernTemplate,
  elegant: ElegantTemplate,
  classic: ClassicTemplate,
  minimal: MinimalTemplate,
  urban: UrbanTemplate,
  luxury: ClassicTemplate, // luxury falls back to classic
};

/**
 * Renders the correct template based on profile.templateId.
 * Falls back to ClassicTemplate if the ID is unknown.
 */
export function TemplateRenderer({ profile, preview }: TemplateProps) {
  const Template = templateMap[profile.templateId ?? "classic"] ?? ClassicTemplate;
  return <Template profile={profile} preview={preview} />;
}
