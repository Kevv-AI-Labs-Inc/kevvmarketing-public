/**
 * AI Router — stub for AI recommendation features.
 *
 * Called by: AIRecommend.tsx (smart-match page)
 * Endpoints: ai.recommend, ai.feedback
 *
 * TODO: Wire up to the actual AI recommendation service
 * when the embedding pipeline is ready.
 */

import { z } from "zod";
import { router, protectedProcedure } from "../trpc";

export const aiRouter = router({
  /**
   * recommend — AI-powered property recommendation.
   * Takes a client profile text and returns matching properties.
   */
  recommend: protectedProcedure
    .input(
      z.object({
        profileText: z.string().min(1),
        topK: z.number().min(1).max(50).optional().default(10),
        generatePitch: z.boolean().optional().default(false),
      })
    )
    .mutation(async () => {
      // Stub: return empty recommendations until the AI service is connected
      return {
        recommendations: [],
        requirements: { hard: {}, soft: [] },
        candidateCount: 0,
        processingTime: 0,
      };
    }),

  /**
   * feedback — Submit feedback on a recommendation.
   */
  feedback: protectedProcedure
    .input(
      z.object({
        recommendationId: z.number(),
        feedbackType: z.enum(["approved", "rejected"]),
        feedbackRating: z.number().min(1).max(5).optional(),
        feedbackNotes: z.string().optional(),
      })
    )
    .mutation(async () => {
      return { success: true };
    }),
});
