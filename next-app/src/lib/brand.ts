function readPublicEnv(value: string | undefined, fallback: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}

export const brandConfig = {
  appName: readPublicEnv(process.env.NEXT_PUBLIC_APP_NAME, "Kevv Marketing"),
  shortName: readPublicEnv(process.env.NEXT_PUBLIC_APP_SHORT_NAME, "Kevv"),
  companyName: readPublicEnv(process.env.NEXT_PUBLIC_COMPANY_NAME, "Kevv AI Labs Inc."),
  supportEmail: readPublicEnv(process.env.NEXT_PUBLIC_SUPPORT_EMAIL, "support@kevv.ai"),
  appUrl: readPublicEnv(process.env.NEXT_PUBLIC_APP_URL, "https://marketing.kevv.ai"),
  projectUrl: readPublicEnv(
    process.env.NEXT_PUBLIC_PROJECT_URL,
    "https://kevv.ai",
  ),
  projectLabel: readPublicEnv(process.env.NEXT_PUBLIC_PROJECT_LABEL, "kevv.ai"),
} as const;

export const brandMark = brandConfig.shortName.slice(0, 1).toUpperCase() || "O";
