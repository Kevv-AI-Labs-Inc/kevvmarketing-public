import { and, desc, eq, ilike, or } from "drizzle-orm";
import { z } from "zod";

import { contacts } from "@/lib/db/schema";
import { getDb } from "@/server/db";
import { protectedProcedure, router } from "@/server/trpc";

export const leadCaptureRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        query: z.string().trim().max(255).optional(),
        source: z.string().trim().max(64).optional(),
        status: z
          .enum(["new", "contacted", "qualified", "converted", "lost", "archived"])
          .optional(),
        limit: z.number().min(1).max(100).default(50),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const conditions = [eq(contacts.agentId, ctx.user.id)];

      if (input?.source) {
        conditions.push(eq(contacts.source, input.source));
      }
      if (input?.status) {
        conditions.push(eq(contacts.status, input.status));
      }
      if (input?.query) {
        conditions.push(
          or(
            ilike(contacts.name, `%${input.query}%`),
            ilike(contacts.email, `%${input.query}%`),
            ilike(contacts.phone, `%${input.query}%`),
            ilike(contacts.area, `%${input.query}%`)
          )!
        );
      }

      return db
        .select()
        .from(contacts)
        .where(and(...conditions))
        .orderBy(desc(contacts.updatedAt))
        .limit(input?.limit ?? 50);
    }),

  updateStatus: protectedProcedure
    .input(
      z.object({
        contactId: z.number().int(),
        status: z.enum(["new", "contacted", "qualified", "converted", "lost", "archived"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const [contact] = await db
        .update(contacts)
        .set({
          status: input.status,
          updatedAt: new Date(),
        })
        .where(and(eq(contacts.id, input.contactId), eq(contacts.agentId, ctx.user.id)))
        .returning();

      if (!contact) {
        throw new Error("Contact not found");
      }

      return contact;
    }),
});
