import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { ENV } from "./_core/env";
import {
  buildOpenAiApiUrl,
  buildOpenAiAuthHeaders,
  resolveOpenAiApiKey,
} from "./_core/openaiApi";
import { protectedProcedure, router } from "./_core/trpc";
import { storagePut } from "./storage";
import { randomBytes } from "crypto";
import { getDb } from "./db";
import { videoJobs } from "../drizzle/schema";
import { desc, eq } from "drizzle-orm";

const cloudProviderSchema = z.enum(["sora", "jimeng"]);

const createCloudVideoTaskInput = z.object({
  provider: cloudProviderSchema,
  title: z.string().trim().min(1).max(255),
  prompt: z.string().trim().max(4000).optional(),
  imageUrls: z.array(z.string().url()).min(1).max(80),
  aspectRatio: z.enum(["9:16", "16:9", "1:1"]).default("9:16"),
  durationSecondsPerImage: z.number().min(0.5).max(12).default(2.5),
});

type CloudVideoResult = {
  provider: "sora" | "jimeng";
  status: "processing" | "completed";
  jobId: string | null;
  downloadUrl: string | null;
  raw: unknown;
};

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord {
  if (!value || typeof value !== "object") return {};
  return value as UnknownRecord;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function pickFirstString(source: unknown, paths: string[][]): string | null {
  const root = asRecord(source);
  for (const path of paths) {
    let current: unknown = root;
    for (const segment of path) {
      const record = asRecord(current);
      current = record[segment];
      if (current == null) break;
    }
    const found = asString(current);
    if (found) return found;
  }
  return null;
}

async function postJsonWithTimeout(url: string, headers: Record<string, string>, body: unknown) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ENV.videoRequestTimeoutMs);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const text = await response.text();
    const parsed = text ? safeJsonParse(text) : {};
    if (!response.ok) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Video provider request failed (${response.status})`,
        cause: parsed,
      });
    }
    return parsed;
  } catch (error) {
    if (error instanceof TRPCError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new TRPCError({
        code: "TIMEOUT",
        message: `Video provider request timed out after ${ENV.videoRequestTimeoutMs}ms`,
      });
    }
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Video provider request failed",
      cause: error,
    });
  } finally {
    clearTimeout(timeout);
  }
}

function safeJsonParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return { raw: value };
  }
}

function buildSoraUrl() {
  const configuredPath = ENV.openaiVideoApiPath.trim();
  const normalized = configuredPath
    .replace(/^\/+/, "")
    .replace(/^v1\//i, "");
  return buildOpenAiApiUrl(normalized || "videos", { scope: "video" });
}

function buildJimengUrl() {
  const base = ENV.jimengApiBaseUrl.replace(/\/$/, "");
  const path = ENV.jimengVideoApiPath.startsWith("/")
    ? ENV.jimengVideoApiPath
    : `/${ENV.jimengVideoApiPath}`;
  return `${base}${path}`;
}

async function createSoraTask(input: z.infer<typeof createCloudVideoTaskInput>): Promise<CloudVideoResult> {
  if (!resolveOpenAiApiKey({ scope: "video" })) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Sora API key not configured",
    });
  }

  const url = buildSoraUrl();
  const headers = {
    ...buildOpenAiAuthHeaders({ scope: "video" }),
    "Content-Type": "application/json",
  };

  const body = {
    model: ENV.openaiVideoModel,
    input: input.imageUrls.map((imageUrl, index) => ({
      type: "image_url" as const,
      image_url: imageUrl,
      ...(index === 0 && input.prompt ? { caption: input.prompt } : {}),
    })),
    aspect_ratio: input.aspectRatio,
    duration: Math.round(input.imageUrls.length * input.durationSecondsPerImage),
    n: 1,
  };

  const result = await postJsonWithTimeout(url, headers, body);
  const record = asRecord(result);

  const downloadUrl =
    pickFirstString(result, [
      ["data", "0", "url"],
      ["data", "0", "video", "url"],
      ["url"],
      ["video_url"],
    ]);

  return {
    provider: "sora",
    status: downloadUrl ? "completed" : "processing",
    jobId: asString(record.id) ?? asString(record.job_id),
    downloadUrl,
    raw: result,
  };
}

async function createJimengTask(input: z.infer<typeof createCloudVideoTaskInput>): Promise<CloudVideoResult> {
  if (!ENV.jimengApiKey || !ENV.jimengApiBaseUrl) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Jimeng API not configured (set JIMENG_API_KEY and JIMENG_API_BASE_URL)",
    });
  }

  const url = buildJimengUrl();
  const headers = {
    Authorization: `Bearer ${ENV.jimengApiKey}`,
    "Content-Type": "application/json",
  };

  const body = {
    model: ENV.jimengVideoModel,
    prompt: input.prompt || "professional real estate video",
    image_urls: input.imageUrls,
    aspect_ratio: input.aspectRatio,
    duration: Math.round(input.imageUrls.length * input.durationSecondsPerImage),
  };

  const result = await postJsonWithTimeout(url, headers, body);
  const record = asRecord(result);

  const downloadUrl = pickFirstString(result, [
    ["data", "video_url"],
    ["video_url"],
    ["url"],
  ]);

  return {
    provider: "jimeng",
    status: downloadUrl ? "completed" : "processing",
    jobId: asString(record.id) ?? asString(record.task_id),
    downloadUrl,
    raw: result,
  };
}

export const studioRouter = router({
  providerStatus: protectedProcedure.query(() => {
    const soraEnabled = Boolean(resolveOpenAiApiKey({ scope: "video" }));
    const jimengEnabled = Boolean(ENV.jimengApiKey && ENV.jimengApiBaseUrl);

    return {
      defaultProvider: ENV.videoProvider,
      providers: {
        sora: {
          enabled: soraEnabled,
          label: "Sora",
          note: soraEnabled
            ? `Model: ${ENV.openaiVideoModel}`
            : "Set OpenAI/Azure Video API key to enable",
        },
        jimeng: {
          enabled: jimengEnabled,
          label: "Jimeng",
          note: jimengEnabled
            ? `Model: ${ENV.jimengVideoModel}`
            : "Set JIMENG_API_KEY + JIMENG_API_BASE_URL to enable",
        },
      },
    };
  }),

  createCloudVideoTask: protectedProcedure
    .input(createCloudVideoTaskInput)
    .mutation(async ({ input }) => {
      if (input.provider === "sora") {
        return createSoraTask(input);
      }
      return createJimengTask(input);
    }),

  /**
   * Upload a user image (base64) to R2 for use in video generation.
   */
  uploadImage: protectedProcedure
    .input(
      z.object({
        base64Data: z.string().min(1),
        fileName: z.string().trim().max(255).optional(),
        mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]).default("image/jpeg"),
      })
    )
    .mutation(async ({ input }) => {
      // Validate size (max 10MB base64 ≈ ~14MB string)
      if (input.base64Data.length > 14_000_000) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Image too large. Maximum 10MB.",
        });
      }

      const extMap: Record<string, string> = {
        "image/jpeg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
      };
      const ext = extMap[input.mimeType] || ".jpg";
      const id = randomBytes(12).toString("hex");
      const filename = `${id}${ext}`;
      const r2Key = `studio/uploads/${filename}`;

      // Strip data URI prefix if present
      const raw = input.base64Data.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(raw, "base64");

      const { url } = await storagePut(r2Key, buffer, input.mimeType);

      return { url, filename };
    }),

  /**
   * List previously uploaded images.
   * Client-side tracks uploaded URLs per session.
   */
  listUploads: protectedProcedure.query(() => {
    return [] as { filename: string; url: string }[];
  }),

  // ─── Video Job Persistence ─────────────────────────────────

  /**
   * saveJob — Persist a video generation job to the database.
   */
  saveJob: protectedProcedure
    .input(
      z.object({
        listingKey: z.string().max(255).optional(),
        title: z.string().max(255).optional(),
        provider: z.enum(["local", "sora", "jimeng"]),
        status: z.enum(["pending", "processing", "completed", "failed"]).default("completed"),
        jobExternalId: z.string().max(255).optional(),
        prompt: z.string().max(4000).optional(),
        aspectRatio: z.enum(["9:16", "16:9", "1:1"]).default("9:16"),
        imageCount: z.number().min(0).default(0),
        videoUrl: z.string().optional(),
        thumbnailUrl: z.string().optional(),
        durationSeconds: z.number().optional(),
        errorMessage: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      const [job] = await db
        .insert(videoJobs)
        .values({
          agentId: ctx.user.id,
          listingKey: input.listingKey,
          title: input.title,
          provider: input.provider,
          status: input.status,
          jobExternalId: input.jobExternalId,
          prompt: input.prompt,
          aspectRatio: input.aspectRatio,
          imageCount: input.imageCount,
          videoUrl: input.videoUrl,
          thumbnailUrl: input.thumbnailUrl,
          durationSeconds: input.durationSeconds,
          errorMessage: input.errorMessage,
          completedAt: input.status === "completed" ? new Date() : null,
        })
        .returning();
      return job;
    }),

  /**
   * listJobs — Paginated list of past video jobs for the current agent.
   */
  listJobs: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(50).default(20),
        offset: z.number().min(0).default(0),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const limit = input?.limit ?? 20;
      const offset = input?.offset ?? 0;
      const db = await getDb();
      const jobs = await db
        .select()
        .from(videoJobs)
        .where(eq(videoJobs.agentId, ctx.user.id))
        .orderBy(desc(videoJobs.createdAt))
        .limit(limit)
        .offset(offset);
      return jobs;
    }),

  /**
   * getJob — Get a single video job by ID.
   */
  getJob: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      const [job] = await db
        .select()
        .from(videoJobs)
        .where(eq(videoJobs.id, input.id))
        .limit(1);
      if (!job) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Video job not found",
        });
      }
      if (job.agentId !== ctx.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Access denied",
        });
      }
      return job;
    }),
});

export type StudioRouter = typeof studioRouter;
