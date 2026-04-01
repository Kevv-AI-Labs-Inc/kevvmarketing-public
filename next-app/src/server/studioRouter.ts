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

/* ────────────────────────────────────────────────────────────── */
/*  Provider schema                                              */
/* ────────────────────────────────────────────────────────────── */

const cloudProviderSchema = z.enum(["sora"]);

const createCloudVideoTaskInput = z.object({
  provider: cloudProviderSchema,
  title: z.string().trim().min(1).max(255),
  prompt: z.string().trim().max(4000).optional(),
  imageUrls: z.array(z.string().url()).min(1).max(80),
  aspectRatio: z.enum(["9:16", "16:9", "1:1"]).default("9:16"),
  durationSecondsPerImage: z.number().min(0.5).max(12).default(2.5),
});

type CloudVideoResult = {
  provider: "sora";
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

async function fetchWithTimeout(
  url: string,
  init: RequestInit
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ENV.videoRequestTimeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
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

async function postJsonWithTimeout(
  url: string,
  headers: Record<string, string>,
  body: unknown
) {
  const response = await fetchWithTimeout(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
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
}

/* ────────────────────────────────────────────────────────────── */
/*  Sora 2 (Azure OpenAI)                                       */
/* ────────────────────────────────────────────────────────────── */

function buildSoraUrl(suffix = "") {
  const configuredPath = ENV.openaiVideoApiPath.trim();
  const normalized = configuredPath
    .replace(/^\/+/, "")
    .replace(/^v1\//i, "");
  const resource = normalized || "videos";
  return buildOpenAiApiUrl(
    suffix ? `${resource}/${suffix}` : resource,
    { scope: "video" }
  );
}

async function createSoraTask(
  input: z.infer<typeof createCloudVideoTaskInput>
): Promise<CloudVideoResult> {
  if (!resolveOpenAiApiKey({ scope: "video" })) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        "Sora API key not configured. Set AZURE_OPENAI_VIDEO_ENDPOINT + AZURE_OPENAI_VIDEO_API_KEY.",
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
    duration: Math.round(
      input.imageUrls.length * input.durationSecondsPerImage
    ),
    n: 1,
  };

  const result = await postJsonWithTimeout(url, headers, body);
  const record = asRecord(result);

  const downloadUrl = pickFirstString(result, [
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

/**
 * Poll an in-progress Sora 2 video generation job.
 */
async function pollSoraJob(jobId: string) {
  if (!resolveOpenAiApiKey({ scope: "video" })) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Sora API key not configured",
    });
  }

  const url = buildSoraUrl(jobId);
  const headers = buildOpenAiAuthHeaders({ scope: "video" });

  const response = await fetchWithTimeout(url, {
    method: "GET",
    headers,
  });
  const text = await response.text();
  const parsed = text ? safeJsonParse(text) : {};

  if (!response.ok) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Sora poll failed (${response.status})`,
      cause: parsed,
    });
  }

  const record = asRecord(parsed);
  const status = asString(record.status) ?? "unknown";

  const downloadUrl = pickFirstString(parsed, [
    ["data", "0", "url"],
    ["data", "0", "video", "url"],
    ["output", "video_url"],
    ["video_url"],
    ["url"],
  ]);

  return {
    jobId,
    status,
    downloadUrl,
    raw: parsed,
  };
}

/* ────────────────────────────────────────────────────────────── */
/*  Router                                                       */
/* ────────────────────────────────────────────────────────────── */

export const studioRouter = router({
  /**
   * Provider availability status.
   * Sora 2 (Azure OpenAI) is the primary provider.
   * Local and Jimeng are marked as development-only.
   */
  providerStatus: protectedProcedure.query(() => {
    const soraEnabled = Boolean(resolveOpenAiApiKey({ scope: "video" }));

    return {
      defaultProvider: "sora" as const,
      providers: {
        sora: {
          enabled: soraEnabled,
          label: "Sora 2",
          sublabel: "Azure OpenAI",
          note: soraEnabled
            ? `Model: ${ENV.openaiVideoModel}`
            : "Set AZURE_OPENAI_VIDEO_ENDPOINT + AZURE_OPENAI_VIDEO_API_KEY to enable",
          status: soraEnabled ? ("ready" as const) : ("not_configured" as const),
        },
        local: {
          enabled: false,
          label: "Local Render",
          sublabel: "Browser",
          note: "In development — Ken Burns slideshow with transitions",
          status: "dev" as const,
        },
        jimeng: {
          enabled: false,
          label: "Jimeng",
          sublabel: "Dreamina",
          note: "In development — ByteDance AI video model",
          status: "dev" as const,
        },
      },
    };
  }),

  createCloudVideoTask: protectedProcedure
    .input(createCloudVideoTaskInput)
    .mutation(async ({ input }) => {
      return createSoraTask(input);
    }),

  /**
   * Poll an in-progress Sora 2 job for completion status.
   */
  pollVideoJob: protectedProcedure
    .input(z.object({ jobId: z.string().min(1) }))
    .query(async ({ input }) => {
      return pollSoraJob(input.jobId);
    }),

  /**
   * Upload a user image (base64) to R2 for use in video generation.
   */
  uploadImage: protectedProcedure
    .input(
      z.object({
        base64Data: z.string().min(1),
        fileName: z.string().trim().max(255).optional(),
        mimeType: z
          .enum(["image/jpeg", "image/png", "image/webp"])
          .default("image/jpeg"),
      })
    )
    .mutation(async ({ input }) => {
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

      const raw = input.base64Data.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(raw, "base64");

      const { url } = await storagePut(r2Key, buffer, input.mimeType);

      return { url, filename };
    }),

  listUploads: protectedProcedure.query(() => {
    return [] as { filename: string; url: string }[];
  }),

  // ─── Video Job Persistence ─────────────────────────────────

  saveJob: protectedProcedure
    .input(
      z.object({
        listingKey: z.string().max(255).optional(),
        title: z.string().max(255).optional(),
        provider: z.enum(["local", "sora", "jimeng"]),
        status: z
          .enum(["pending", "processing", "completed", "failed"])
          .default("completed"),
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

  listJobs: protectedProcedure
    .input(
      z
        .object({
          limit: z.number().min(1).max(50).default(20),
          offset: z.number().min(0).default(0),
        })
        .optional()
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
