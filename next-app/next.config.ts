import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const projectRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const nextConfig: NextConfig = {
  // Railway uses `next start` with full node_modules,
  // so standalone output is not needed.
  outputFileTracingRoot: projectRoot,
};

export default nextConfig;
