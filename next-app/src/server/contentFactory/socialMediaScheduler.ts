/**
 * Social Media Scheduler — schedule and publish posts.
 *
 * Manages the lifecycle: draft → scheduled → published.
 * Uses a simple polling pattern (no external queue needed for MVP).
 */

import { getDb } from "../db";
import { socialPosts } from "../../drizzle/schema";
import { eq, and, lte } from "drizzle-orm";

// ─── Scheduler ─────────────────────────────────────────────

/**
 * Process due posts — publish any posts whose scheduled_at has passed.
 * Intended to be called periodically (e.g., every 5 min via setInterval).
 */
export async function processDuePosts(): Promise<{
  published: number;
  failed: number;
}> {
  const db = await getDb();
  if (!db) return { published: 0, failed: 0 };

  const now = new Date();

  // Find scheduled posts that are due
  const duePosts = await db
    .select()
    .from(socialPosts)
    .where(
      and(
        eq(socialPosts.status, "scheduled"),
        lte(socialPosts.scheduledAt, now),
      ),
    )
    .limit(50); // Process in batches

  let published = 0;
  let failed = 0;

  for (const post of duePosts) {
    try {
      // TODO: Replace with actual platform API calls
      // For now, just mark as published
      await publishToSocialPlatform(post);

      await db
        .update(socialPosts)
        .set({
          status: "published",
          publishedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(socialPosts.id, post.id));

      published++;
    } catch (err) {
      console.error(`[socialScheduler] Failed to publish post ${post.id}:`, err);
      await db
        .update(socialPosts)
        .set({ status: "failed", updatedAt: new Date() })
        .where(eq(socialPosts.id, post.id));
      failed++;
    }
  }

  if (published > 0 || failed > 0) {
    console.log(`[socialScheduler] Processed: published=${published}, failed=${failed}`);
  }

  return { published, failed };
}

// ─── Platform Publishing Stubs ─────────────────────────────

interface PostData {
  platform: string;
  content: string;
  contentZh?: string | null;
  imageUrls?: string[] | null;
  videoUrl?: string | null;
  hashtags?: string[] | null;
}

async function publishToSocialPlatform(post: PostData): Promise<string> {
  // Platform-specific publishing logic stubs
  switch (post.platform) {
    case "instagram":
      return publishToInstagram(post);
    case "facebook":
      return publishToFacebook(post);
    case "xiaohongshu":
      return publishToXiaohongshu(post);
    case "wechat":
      return publishToWeChatMoments(post);
    case "linkedin":
      return publishToLinkedIn(post);
    default:
      throw new Error(`Unsupported social platform: ${post.platform}`);
  }
}

async function publishToInstagram(post: PostData): Promise<string> {
  // TODO: Instagram Graph API
  console.log("[socialScheduler] Stub: publishToInstagram", post.platform);
  return `ig_${Date.now()}`;
}

async function publishToFacebook(post: PostData): Promise<string> {
  // TODO: Facebook Graph API
  console.log("[socialScheduler] Stub: publishToFacebook", post.platform);
  return `fb_${Date.now()}`;
}

async function publishToXiaohongshu(post: PostData): Promise<string> {
  // TODO: Xiaohongshu Open Platform
  console.log("[socialScheduler] Stub: publishToXiaohongshu", post.platform);
  return `xhs_${Date.now()}`;
}

async function publishToWeChatMoments(post: PostData): Promise<string> {
  // TODO: WeChat OA / WeCom API
  console.log("[socialScheduler] Stub: publishToWeChatMoments", post.platform);
  return `wx_${Date.now()}`;
}

async function publishToLinkedIn(post: PostData): Promise<string> {
  // TODO: LinkedIn Marketing API
  console.log("[socialScheduler] Stub: publishToLinkedIn", post.platform);
  return `li_${Date.now()}`;
}

// ─── Start Scheduler ───────────────────────────────────────

let _schedulerInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Start the social media scheduler (runs every 5 minutes).
 */
export function startSocialScheduler(): void {
  if (_schedulerInterval) return;

  const INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

  _schedulerInterval = setInterval(() => {
    processDuePosts().catch((err) =>
      console.error("[socialScheduler] Error:", err),
    );
  }, INTERVAL_MS);

  console.log("[socialScheduler] Started (interval: 5 min)");
}

/**
 * Stop the social media scheduler.
 */
export function stopSocialScheduler(): void {
  if (_schedulerInterval) {
    clearInterval(_schedulerInterval);
    _schedulerInterval = null;
    console.log("[socialScheduler] Stopped");
  }
}
