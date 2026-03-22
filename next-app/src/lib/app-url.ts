import { siteConfig } from "@/lib/site";

const LOCAL_DEV_FALLBACK = "http://127.0.0.1:3000";

function normalizeOrigin(value?: string | null) {
  if (!value) return null;

  const trimmed = value.trim().replace(/\/+$/, "");
  if (!trimmed) return null;

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  return `https://${trimmed}`;
}

export function getAppBaseUrl() {
  if (typeof window !== "undefined") return "";

  const candidates = [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.AUTH_URL,
    process.env.RAILWAY_PUBLIC_DOMAIN,
    process.env.VERCEL_URL,
    siteConfig.url,
  ];

  for (const candidate of candidates) {
    const origin = normalizeOrigin(candidate);
    if (origin) return origin;
  }

  return LOCAL_DEV_FALLBACK;
}
