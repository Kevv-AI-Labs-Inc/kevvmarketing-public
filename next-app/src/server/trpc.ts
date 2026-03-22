/**
 * tRPC initialization for Next.js — replaces the Express version.
 * The middleware and procedures remain the same but the context type is updated.
 */
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";
import { ENV } from "./_core/env";

const UNAUTHED_ERR_MSG = "Please login (10001)";
const NOT_ADMIN_ERR_MSG = "You do not have required permission (10002)";
const NOT_OWNER_ERR_MSG = "Owner permission required (10003)";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async (opts) => {
  const { ctx, next } = opts;
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

export const protectedProcedure = t.procedure.use(requireUser);


function isOwnerOpenId(openId: string) {
  const ownerOpenId = ENV.ownerOpenId;
  return ownerOpenId.length > 0 && openId === ownerOpenId;
}

export const ownerProcedure = t.procedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;
    if (!ctx.user) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
    }
    if (!isOwnerOpenId(ctx.user.openId)) {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_OWNER_ERR_MSG });
    }
    return next({ ctx: { ...ctx, user: ctx.user } });
  })
);

export const adminProcedure = t.procedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;
    if (!ctx.user || ctx.user.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }
    return next({ ctx: { ...ctx, user: ctx.user } });
  })
);
