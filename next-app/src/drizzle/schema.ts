/**
 * Schema re-export shim.
 * Many server routers import from "../../drizzle/schema".
 * This file redirects to the canonical schema location.
 */
export * from "@/lib/db/schema";
