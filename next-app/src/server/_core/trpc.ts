/**
 * tRPC core — re-exports from the Next.js-adapted version.
 * This file exists so that existing service routers can still import from "./_core/trpc".
 */
export {
  router,
  publicProcedure,
  protectedProcedure,
  adminProcedure,
} from "@/server/trpc";
