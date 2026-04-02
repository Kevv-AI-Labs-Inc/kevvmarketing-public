/**
 * AI Task Registry — Orchestration Layer
 *
 * Maps each business feature to its own AI model configuration.
 * This is the single source of truth for "which model runs which task".
 *
 * Why:
 *   Different tasks have different cost / quality / latency tradeoffs:
 *   - Valuation + Prospecting → need strong reasoning → heavier model
 *   - Content gen + Smart Match → need speed → lighter model
 *   - Embeddings → fixed model, separate Azure deployment
 *
 * Configuration priority (highest wins):
 *   1. Per-task env var  (AI_TASK_HOME_VALUE_MODEL=gpt-4o)
 *   2. Global model var  (OPENAI_MODEL=gpt-4o-mini)
 *   3. Hardcoded default (gpt-4o-mini)
 *
 * Azure note:
 *   In Azure OpenAI the "model" parameter IS the deployment name.
 *   Set OPENAI_API_STYLE=azure and use your Azure deployment names
 *   as model values. The existing openaiApi.ts handles endpoint + auth
 *   routing automatically.
 *
 * Usage:
 *   import { AI_TASKS } from "@/server/_core/ai-tasks";
 *   await invokeLLM({ task: AI_TASKS.HOME_VALUE, messages: [...] });
 */

import { ENV } from "./env";

// ─── Task Identifiers ──────────────────────────────────────────

export const AI_TASKS = {
  /** Home value estimation with CMA + neighborhood data */
  HOME_VALUE: "home-value",
  /** Prospecting pitch brief generation */
  PROSPECTING: "prospecting",
  /** Area magnet market report */
  AREA_MAGNET: "area-magnet",
  /** Social/email/XHS content generation */
  CONTENT: "content",
  /** CMA comparative market analysis narrative (legacy) */
  CMA: "cma",
  /** CMA full pipeline — final synthesis report (heavy reasoning) */
  CMA_REPORT: "cma-report",
  /** CMA photo analysis — interior condition assessment (Vision) */
  CMA_PHOTO: "cma-photo",
  /** Smart match market brief / welcome text / share analysis */
  SMART_MATCH: "smart-match",
  /** Vector embedding generation */
  EMBEDDING: "embedding",
} as const;

export type AITask = (typeof AI_TASKS)[keyof typeof AI_TASKS];

// ─── Task Profile ──────────────────────────────────────────────

export interface AITaskProfile {
  /** Azure deployment name or OpenAI model ID */
  model: string;
  /** Default max tokens for this task (overridable per-call) */
  maxTokens: number;
  /** Temperature (undefined = provider default) */
  temperature?: number;
  /** API scope for Azure endpoint routing */
  scope: "chat" | "embeddings";
  /** Human-readable description for logging */
  description: string;
}

// ─── Registry ──────────────────────────────────────────────────

/**
 * Default profiles keyed by task. Each can be overridden via
 * environment variable AI_TASK_{TASK_NAME}_MODEL.
 *
 * Recommended Azure deployments:
 *
 *   Heavy reasoning (valuation, prospecting, area magnet):
 *     → gpt-4o  (or gpt-4.1 when available)
 *
 *   Medium tasks (content gen, CMA narrative):
 *     → gpt-4o-mini
 *
 *   Light tasks (smart match snippets):
 *     → gpt-4o-mini
 *
 *   Embeddings:
 *     → text-embedding-3-small (1536 dim, cheapest)
 *     → text-embedding-3-large (3072 dim, higher quality)
 */
const PROFILES: Record<AITask, AITaskProfile> = {
  [AI_TASKS.HOME_VALUE]: {
    model: process.env.AI_TASK_HOME_VALUE_MODEL || ENV.openaiModel,
    maxTokens: 1024,
    scope: "chat",
    description: "Home value estimation with CMA + neighborhood data",
  },
  [AI_TASKS.PROSPECTING]: {
    model: process.env.AI_TASK_PROSPECTING_MODEL || ENV.openaiModel,
    maxTokens: 4000,
    scope: "chat",
    description: "Prospecting pitch brief for expired/FSBO listings",
  },
  [AI_TASKS.AREA_MAGNET]: {
    model:
      process.env.AI_TASK_AREA_MAGNET_MODEL ||
      ENV.openaiAreaMagnetModel ||
      ENV.openaiModel,
    maxTokens: 4000,
    scope: "chat",
    description: "Area magnet market snapshot report",
  },
  [AI_TASKS.CONTENT]: {
    model: process.env.AI_TASK_CONTENT_MODEL || ENV.openaiModel,
    maxTokens: 2000,
    scope: "chat",
    description: "Marketing content (social, email, XHS, newsletter)",
  },
  [AI_TASKS.CMA]: {
    model: process.env.AI_TASK_CMA_MODEL || ENV.openaiModel,
    maxTokens: 2000,
    scope: "chat",
    description: "CMA comparative analysis narrative (legacy)",
  },
  [AI_TASKS.CMA_REPORT]: {
    model: process.env.AI_TASK_CMA_REPORT_MODEL || ENV.openaiModel,
    maxTokens: 4000,
    scope: "chat",
    description: "CMA full pipeline final synthesis — bilingual report",
  },
  [AI_TASKS.CMA_PHOTO]: {
    model: process.env.AI_TASK_CMA_PHOTO_MODEL || ENV.openaiModel,
    maxTokens: 1000,
    scope: "chat",
    description: "CMA interior photo condition assessment (Vision)",
  },
  [AI_TASKS.SMART_MATCH]: {
    model: process.env.AI_TASK_SMART_MATCH_MODEL || ENV.openaiModel,
    maxTokens: 1000,
    scope: "chat",
    description: "Smart match brief / welcome text / share analysis",
  },
  [AI_TASKS.EMBEDDING]: {
    model: process.env.AI_TASK_EMBEDDING_MODEL || ENV.openaiEmbeddingModel,
    maxTokens: 0,
    scope: "embeddings",
    description: "Vector embedding for similarity search",
  },
};

// ─── Public API ────────────────────────────────────────────────

/**
 * Resolve the AI profile for a given task.
 * Returns model, maxTokens, scope, etc.
 */
export function resolveTaskProfile(task: AITask): AITaskProfile {
  return PROFILES[task] ?? PROFILES[AI_TASKS.CONTENT];
}

/**
 * Resolve just the model name for a task (convenience).
 */
export function resolveTaskModel(task: AITask): string {
  return resolveTaskProfile(task).model;
}

/**
 * List all registered tasks and their current model assignments.
 * Useful for admin/debug dashboards.
 */
export function listTaskProfiles(): Array<{
  task: AITask;
  profile: AITaskProfile;
}> {
  return Object.entries(PROFILES).map(([task, profile]) => ({
    task: task as AITask,
    profile,
  }));
}
