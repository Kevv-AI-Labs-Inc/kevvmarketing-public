import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const projectRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const nextConfig: NextConfig = {
  // Railway uses `next start` with full node_modules,
  // so standalone output is not needed.
  outputFileTracingRoot: projectRoot,

  images: {
    // Allow next/image to optimize images from BBO R2 storage and common CDN sources.
    // R2_PUBLIC_URL typically looks like https://cdn.example.com or https://<bucket>.r2.dev
    remotePatterns: [
      // Cloudflare R2 custom domain (set via R2_PUBLIC_URL env var)
      ...(process.env.R2_PUBLIC_URL
        ? [
            {
              protocol: new URL(process.env.R2_PUBLIC_URL).protocol.replace(
                ":",
                ""
              ) as "http" | "https",
              hostname: new URL(process.env.R2_PUBLIC_URL).hostname,
            },
          ]
        : []),
      // Cloudflare R2 default *.r2.dev domain
      { protocol: "https" as const, hostname: "*.r2.dev" },
      // MLSGrid media CDN (upstream MLS images)
      { protocol: "https" as const, hostname: "*.mlsgrid.com" },
      { protocol: "https" as const, hostname: "*.repliers.io" },
      // Fallback: allow BBO listing-data-service origin for proxied images
      ...(process.env.LISTING_DATA_SERVICE_URL
        ? [
            {
              protocol: new URL(
                process.env.LISTING_DATA_SERVICE_URL
              ).protocol.replace(":", "") as "http" | "https",
              hostname: new URL(process.env.LISTING_DATA_SERVICE_URL).hostname,
            },
          ]
        : []),
    ],
    // Keep optimized images cached for 7 days, stale for 1 day
    minimumCacheTTL: 86400,
    // Support common device widths for listing cards + detail views
    deviceSizes: [640, 750, 828, 1080, 1200],
    imageSizes: [128, 256, 384, 512],
  },
};

export default nextConfig;
