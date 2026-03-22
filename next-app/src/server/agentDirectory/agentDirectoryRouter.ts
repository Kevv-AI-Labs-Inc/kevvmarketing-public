/**
 * Agent Directory Router — stub for MLS agent directory features.
 *
 * Called by: AgentDirectory.tsx
 * Endpoints: agentDirectory.list, agentDirectory.exportCsv,
 *            agentDirectory.syncAgents, agentDirectory.refreshStats,
 *            agentDirectory.syncStatus, agentDirectory.statsStatus
 *
 * TODO: Wire up to the listing-data-service agent endpoints
 * when the agent sync pipeline is ready.
 */

import { z } from "zod";
import { router, protectedProcedure } from "../trpc";

export const agentDirectoryRouter = router({
  /**
   * list — Paginated agent listing with search and sorting.
   */
  list: protectedProcedure
    .input(
      z.object({
        search: z.string().optional().default(""),
        page: z.number().min(1).optional().default(1),
        pageSize: z.number().min(1).max(200).optional().default(50),
        sortBy: z.string().optional().default("totalClosedDeals"),
        sortDir: z.enum(["asc", "desc"]).optional().default("desc"),
      })
    )
    .query(async () => {
      return {
        rows: [] as Array<Record<string, unknown>>,
        total: 0,
        stats: {
          ready: false,
          refreshing: false,
          stale: false,
          lastUpdatedAt: null as string | null,
        },
      };
    }),

  /**
   * exportCsv — Export agent data as CSV.
   */
  exportCsv: protectedProcedure
    .input(
      z.object({
        search: z.string().optional().default(""),
      })
    )
    .query(async () => {
      return { csv: "" };
    }),

  /**
   * syncAgents — Trigger MLS agent sync.
   */
  syncAgents: protectedProcedure.mutation(async () => {
    return { started: false, message: "Agent sync not yet configured" };
  }),

  /**
   * refreshStats — Trigger stats recalculation.
   */
  refreshStats: protectedProcedure.mutation(async () => {
    return { started: false, message: "Stats refresh not yet configured" };
  }),

  /**
   * syncStatus — Check if an agent sync is running.
   */
  syncStatus: protectedProcedure.query(async () => {
    return {
      syncing: false,
      lastResult: null as string | null,
    };
  }),

  /**
   * statsStatus — Check stats computation status.
   */
  statsStatus: protectedProcedure.query(async () => {
    return {
      ready: false,
      refreshing: false,
      stale: false,
      lastUpdatedAt: null as string | null,
    };
  }),
});
