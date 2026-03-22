/**
 * Content Router — tRPC endpoints for the content factory.
 *
 * Endpoints:
 * - content.generate        — AI generate content
 * - content.templates.list  — list templates
 * - content.templates.create — create template
 * - content.social.create   — create social post
 * - content.social.schedule — schedule a post
 * - content.social.list     — list posts
 * - content.social.cancel   — cancel a scheduled post
 * - content.generated.list  — list AI-generated content
 */

import { z } from "zod";
import { eq, desc, and } from "drizzle-orm";
import { getDb } from "../db";
import { protectedProcedure, router } from "../_core/trpc";
import {
  contentTemplates,
  socialPosts,
  generatedContent,
} from "../../drizzle/schema";
import { generateContent, type ContentFormat } from "./aiContentGenerator";

// ─── Router ────────────────────────────────────────────────

export const contentRouter = router({
  /**
   * AI generate content based on format and listing data.
   */
  generate: protectedProcedure
    .input(
      z.object({
        format: z.string(),
        platform: z.string().optional(),
        language: z.enum(["en", "zh", "zh_en"]).default("en"),
        agentName: z.string(),
        agentTitle: z.string().optional(),
        tone: z.enum(["professional", "casual", "luxury", "friendly"]).optional(),
        customPrompt: z.string().optional(),
        // Listing data (optional, for listing-related content)
        listingKey: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Generate content via AI
      const result = await generateContent({
        format: input.format as ContentFormat,
        platform: input.platform,
        language: input.language,
        agentName: input.agentName,
        agentTitle: input.agentTitle,
        tone: input.tone,
        customPrompt: input.customPrompt,
      });

      // Save to generated_content table for audit trail
      await db.insert(generatedContent).values({
        agentId: ctx.user?.id ?? null,
        sourceType: input.listingKey ? "listing" : "manual",
        sourceId: input.listingKey,
        contentType: input.format,
        content: result.content,
        language: input.language,
        platform: input.platform,
      });

      return result;
    }),

  // ─── Templates ─────────────────────────────────────

  templateList: protectedProcedure
    .input(
      z.object({
        type: z.string().optional(),
        platform: z.string().optional(),
      }).optional(),
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const conditions = [];
      if (input?.type) conditions.push(eq(contentTemplates.type, input.type));
      if (input?.platform) conditions.push(eq(contentTemplates.platform, input.platform));

      const templates = await db
        .select()
        .from(contentTemplates)
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(desc(contentTemplates.createdAt));

      return { data: templates };
    }),

  templateCreate: protectedProcedure
    .input(
      z.object({
        type: z.string(),
        title: z.string(),
        contentZh: z.string().optional(),
        contentEn: z.string().optional(),
        platform: z.string().optional(),
        variables: z.array(z.string()).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const [template] = await db
        .insert(contentTemplates)
        .values({
          agentId: ctx.user?.id ?? null,
          type: input.type,
          title: input.title,
          contentZh: input.contentZh,
          contentEn: input.contentEn,
          platform: input.platform,
          variables: input.variables ?? [],
        })
        .returning();

      return template;
    }),

  // ─── Social Posts ──────────────────────────────────

  socialCreate: protectedProcedure
    .input(
      z.object({
        platform: z.string(),
        content: z.string(),
        contentZh: z.string().optional(),
        imageUrls: z.array(z.string()).optional(),
        videoUrl: z.string().optional(),
        hashtags: z.array(z.string()).optional(),
        listingKey: z.string().optional(),
        templateId: z.number().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const [post] = await db
        .insert(socialPosts)
        .values({
          agentId: ctx.user?.id ?? null,
          platform: input.platform,
          content: input.content,
          contentZh: input.contentZh,
          imageUrls: input.imageUrls ?? [],
          videoUrl: input.videoUrl,
          hashtags: input.hashtags ?? [],
          listingKey: input.listingKey,
          templateId: input.templateId,
          status: "draft",
        })
        .returning();

      return post;
    }),

  socialSchedule: protectedProcedure
    .input(
      z.object({
        postId: z.number(),
        scheduledAt: z.string(), // ISO date string
      }),
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      await db
        .update(socialPosts)
        .set({
          scheduledAt: new Date(input.scheduledAt),
          status: "scheduled",
          updatedAt: new Date(),
        })
        .where(eq(socialPosts.id, input.postId));

      return { success: true };
    }),

  socialList: protectedProcedure
    .input(
      z.object({
        status: z.string().optional(),
        platform: z.string().optional(),
        page: z.number().default(1),
        perPage: z.number().default(20),
      }).optional(),
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const page = input?.page ?? 1;
      const perPage = input?.perPage ?? 20;
      const offset = (page - 1) * perPage;

      const conditions = [];
      if (input?.status) conditions.push(eq(socialPosts.status, input.status));
      if (input?.platform) conditions.push(eq(socialPosts.platform, input.platform));

      const posts = await db
        .select()
        .from(socialPosts)
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(desc(socialPosts.createdAt))
        .limit(perPage)
        .offset(offset);

      return { data: posts, page, perPage };
    }),

  socialCancel: protectedProcedure
    .input(z.object({ postId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      await db
        .update(socialPosts)
        .set({ status: "draft", scheduledAt: null, updatedAt: new Date() })
        .where(eq(socialPosts.id, input.postId));

      return { success: true };
    }),

  // ─── Generated Content History ─────────────────────

  generatedList: protectedProcedure
    .input(
      z.object({
        contentType: z.string().optional(),
        language: z.string().optional(),
        page: z.number().default(1),
        perPage: z.number().default(20),
      }).optional(),
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const page = input?.page ?? 1;
      const perPage = input?.perPage ?? 20;
      const offset = (page - 1) * perPage;

      const conditions = [];
      if (input?.contentType)
        conditions.push(eq(generatedContent.contentType, input.contentType));
      if (input?.language)
        conditions.push(eq(generatedContent.language, input.language));

      const items = await db
        .select()
        .from(generatedContent)
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(desc(generatedContent.createdAt))
        .limit(perPage)
        .offset(offset);

      return { data: items, page, perPage };
    }),
  // ─── Xiaohongshu Content Package ────────────────────

  xhsGenerate: protectedProcedure
    .input(
      z.object({
        agentName: z.string(),
        agentTitle: z.string().optional(),
        listingKey: z.string().optional(),
        customPrompt: z.string().optional(),
        // Manual listing data for when listingKey isn't available
        address: z.string().optional(),
        city: z.string().optional(),
        price: z.string().optional(),
        propertyType: z.string().optional(),
        beds: z.number().optional(),
        baths: z.number().optional(),
        sqft: z.number().optional(),
        highlights: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Build a manual listing context if no listingKey
      const manualListingPrompt = input.address
        ? `
## 房源数据
- 地址: ${input.address}${input.city ? `, ${input.city}` : ""}
- 价格: ${input.price ? `$${input.price}` : "待询"}
- 类型: ${input.propertyType ?? "Residential"}
- 卧室/浴室: ${input.beds ?? "N/A"} / ${input.baths ?? "N/A"}
- 面积: ${input.sqft ? `${input.sqft} sqft` : "N/A"}
${input.highlights ? `- 亮点: ${input.highlights}` : ""}
`
        : "";

      const result = await generateContent({
        format: "xhs_post" as ContentFormat,
        platform: "xiaohongshu",
        language: "zh",
        agentName: input.agentName,
        agentTitle: input.agentTitle,
        customPrompt: [manualListingPrompt, input.customPrompt]
          .filter(Boolean)
          .join("\n"),
      });

      // Save to generated_content table
      await db.insert(generatedContent).values({
        agentId: ctx.user?.id ?? null,
        sourceType: input.listingKey ? "listing" : "manual",
        sourceId: input.listingKey,
        contentType: "xhs_post",
        content: JSON.stringify({
          title: result.title,
          body: result.content,
          hashtags: result.hashtags,
          photoTips: result.photoTips,
        }),
        language: "zh",
        platform: "xiaohongshu",
      });

      return {
        title: result.title ?? "",
        body: result.content,
        hashtags: result.hashtags ?? [],
        photoTips: result.photoTips ?? [],
      };
    }),
});
