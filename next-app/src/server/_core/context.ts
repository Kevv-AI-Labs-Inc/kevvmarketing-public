/**
 * Context re-export shim.
 * Old routers import from "./_core/context" — this redirects to the new Next.js context.
 */
export { createContext, type TrpcContext } from "@/server/context";
