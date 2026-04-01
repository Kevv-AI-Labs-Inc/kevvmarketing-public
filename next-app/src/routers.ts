/**
 * App router — re-exports all service routers for Next.js tRPC.
 * Replaces the Express version. Auth routes removed (handled by NextAuth).
 */
import { router, publicProcedure } from "@/server/trpc";
import { systemRouter } from "./server/_core/systemRouter";
import { shareRouter } from "./server/shareRouter";
import { smartMatchRouter } from "./server/smartMatchRouter";
import { dealStoryRouter } from "./server/dealStoryRouter";
import { showingFeedbackRouter } from "./server/showingFeedbackRouter";
import { studioRouter } from "./server/studioRouter";
import { showingTourRouter } from "./server/showingTourRouter";
import { trackingRouter } from "./server/tracking/trackingRouter";
import { contentRouter } from "./server/contentFactory/contentRouter";
import { cmaRouter } from "./server/cma/cmaRouter";
import { mlsRouter } from "./server/mls/mlsRouter";
import { aiRouter } from "./server/ai/aiRouter";
import { vectorRouter } from "./server/vector/vectorRouter";
import { subscriptionRouter } from "./server/subscriptionRouter";
import { leadCaptureRouter } from "./server/leadCaptureRouter";
import { profileRouter } from "./server/profileRouter";
import { homeValueRouter } from "./server/homeValueRouter";
import { postcardRouter } from "./server/postcardRouter";
import { prospectingRouter } from "./server/prospectingRouter";

export const appRouter = router({
  system: systemRouter,
  mls: mlsRouter,
  share: shareRouter,
  smartMatch: smartMatchRouter,
  dealStory: dealStoryRouter,
  showingFeedback: showingFeedbackRouter,
  studio: studioRouter,
  showingTour: showingTourRouter,
  tracking: trackingRouter,
  content: contentRouter,
  cma: cmaRouter,
  ai: aiRouter,
  vector: vectorRouter,
  subscription: subscriptionRouter,
  leads: leadCaptureRouter,
  profile: profileRouter,
  homeValue: homeValueRouter,
  postcard: postcardRouter,
  prospecting: prospectingRouter,
  // Auth is handled by NextAuth — no tRPC auth routes needed
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
  }),
});

export type AppRouter = typeof appRouter;
