/**
 * AI Task Registry — Orchestration Layer
 *
 * Maps each business feature to its own AI model configuration.
 * This is the single source of truth for "which model runs which task".
 *
 * Why:
 *   Different tasks have different cost / quality / latency tradeoffs:
 *   - Prospecting + area reports need stronger reasoning
 *   - Content generation favors speed
 *   - Embeddings use a fixed, separate Azure deployment
 *
 * Configuration priority (highest wins):
 *   1. Per-task env var  (AI_TASK_PROSPECTING_MODEL=gpt-4o)
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
 *   await invokeLLM({ task: AI_TASKS.CONTENT, messages: [...] });
 */

import { ENV } from "./env";

// ─── Task Identifiers ──────────────────────────────────────────

export const AI_TASKS = {
  /** Prospecting pitch brief generation */
  PROSPECTING: "prospecting",
  /** Area magnet market report */
  AREA_MAGNET: "area-magnet",
  /** Social/email/XHS content generation */
  CONTENT: "content",
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
 *   Heavy reasoning (prospecting, area magnet):
 *     → gpt-4o  (or gpt-4.1 when available)
 *
 *   Medium tasks (content generation):
 *     → gpt-4o-mini
 *
 *   Embeddings:
 *     → text-embedding-3-small (1536 dim, cheapest)
 *     → text-embedding-3-large (3072 dim, higher quality)
 */
const PROFILES: Record<AITask, AITaskProfile> = {
  [AI_TASKS.PROSPECTING]: {
    model: process.env.AI_TASK_PROSPECTING_MODEL || ENV.openaiModel,
    maxTokens: 4000,
    scope: "chat",
    description: "Prospecting pitch brief for expired/FSBO listings",
  },
  [AI_TASKS.AREA_MAGNET]: {
    model: process.env.AI_TASK_AREA_MAGNET_MODEL || ENV.openaiModel,
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
