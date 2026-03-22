import { brandConfig, brandMark } from "@/lib/brand";

export const siteConfig = {
  name: brandConfig.appName,
  shortName: brandConfig.shortName,
  companyName: brandConfig.companyName,
  mark: brandMark,
  url: brandConfig.appUrl,
  projectUrl: brandConfig.projectUrl,
  projectLabel: brandConfig.projectLabel,
  supportEmail: brandConfig.supportEmail,
} as const;

export function absoluteUrl(path: string) {
  return `${siteConfig.url}${path}`;
}

export function getMailboxAuthOrigin(originOverride?: string | null) {
  return originOverride || siteConfig.url;
}
