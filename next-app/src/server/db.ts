/**
 * Database shim — re-exports the canonical Neon serverless DB.
 *
 * Old tRPC routers import `getDb` from "../db" or "./db".
 * This file redirects to the @/lib/db Neon driver, which:
 *   - Uses HTTP connections (no persistent TCP pool)
 *   - Works reliably in serverless / standalone environments
 *   - Does NOT do DDL initialization (drizzle-kit push handles that)
 *
 * The old node-postgres version with 200 lines of DDL auto-init
 * has been removed per audit (P0: startup timeout risk).
 */
export { getDb } from "@/lib/db";
export type { Db } from "@/lib/db";
