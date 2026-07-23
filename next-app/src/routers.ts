/**
 * App router — re-exports all service routers for Next.js tRPC.
 * Replaces the Express version. Auth routes removed (handled by NextAuth).
 */
import { router, publicProcedure } from "@/server/trpc";
import { systemRouter } from "./server/_core/systemRouter";
import { shareRouter } from "./server/shareRouter";
import { dealStoryRouter } from "./server/dealStoryRouter";
import { studioRouter } from "./server/studioRouter";
import { showingTourRouter } from "./server/showingTourRouter";
import { contentRouter } from "./server/contentFactory/contentRouter";
import { mlsRouter } from "./server/mls/mlsRouter";
import { subscriptionRouter } from "./server/subscriptionRouter";
import { leadCaptureRouter } from "./server/leadCaptureRouter";
import { profileRouter } from "./server/profileRouter";
import { postcardRouter } from "./server/postcardRouter";
import { prospectingRouter } from "./server/prospectingRouter";
import { flyerRouter } from "./server/flyerRouter";

export const appRouter = router({
  system: systemRouter,
  mls: mlsRouter,
  share: shareRouter,
  dealStory: dealStoryRouter,
  studio: studioRouter,
  showingTour: showingTourRouter,
  content: contentRouter,
  subscription: subscriptionRouter,
  leads: leadCaptureRouter,
  profile: profileRouter,
  postcard: postcardRouter,
  prospecting: prospectingRouter,
  flyer: flyerRouter,
  // Auth is handled by NextAuth — no tRPC auth routes needed
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
  }),
});

export type AppRouter = typeof appRouter;
