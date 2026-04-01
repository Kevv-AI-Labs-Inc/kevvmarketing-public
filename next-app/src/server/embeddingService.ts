/**
 * Embedding Service — OpenAI Embeddings for Marketing App
 *
 * Extracted from vectorService.ts — only the embedding generation functions
 * needed by dealStoryRouter, showingFeedbackRouter, and future marketing features.
 */

import { ENV } from "./_core/env";
import { AI_TASKS, resolveTaskProfile } from "./_core/ai-tasks";
import {
  buildOpenAiApiUrl,
  buildOpenAiAuthHeaders,
  resolveOpenAiApiKey,
} from "./_core/openaiApi";

// ─── Dimension Config ──────────────────────────────────────
export const EMBEDDING_DIMENSIONS = 1536;
const VECTOR_TEXT_MAX_CHARS = 32000;

// ─── OpenAI Provider ───────────────────────────────────────

function getOpenAIEmbeddingUrl(): string {
  return buildOpenAiApiUrl("embeddings", { scope: "embeddings" });
}

async function openaiEmbed(texts: string | string[]): Promise<number[][]> {
  if (!resolveOpenAiApiKey({ scope: "embeddings" })) {
    throw new Error(
      "OpenAI embedding key is not configured. Set OPENAI_API_KEY or AZURE_OPENAI_EMBEDDING_API_KEY."
    );
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10_000);
  let response: Response;
  try {
    response = await fetch(getOpenAIEmbeddingUrl(), {
      method: "POST",
      headers: buildOpenAiAuthHeaders({ scope: "embeddings" }),
      body: JSON.stringify({
        model: resolveTaskProfile(AI_TASKS.EMBEDDING).model,
        input: texts,
      }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI embedding error: ${response.status} ${err}`);
  }

  const data = (await response.json()) as {
    data: Array<{ embedding: number[]; index: number }>;
  };
  return data.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
}

// ─── Model ID ─────────────────────────────────────────────

export function getEmbeddingModelId(): string {
  const profile = resolveTaskProfile(AI_TASKS.EMBEDDING);
  return `openai:${profile.model}`;
}

// ─── Public API ───────────────────────────────────────────

/**
 * Generate embedding for a single text.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  if (!text || text.trim().length === 0) {
    return new Array(EMBEDDING_DIMENSIONS).fill(0);
  }

  const truncated = text.slice(0, VECTOR_TEXT_MAX_CHARS);

  try {
    const results = await openaiEmbed(truncated);
    return results[0];
  } catch (error) {
    console.warn(`[Embedding] Embedding failed, using mock:`, error);
    return generateMockEmbedding(text);
  }
}

/**
 * Mock embedding for fallback when API is unavailable.
 */
export function generateMockEmbedding(text: string): number[] {
  const vec = new Array(EMBEDDING_DIMENSIONS).fill(0);
  const lowerText = text.toLowerCase();

  // Simple hash-based mock for dev/test
  for (let i = 0; i < lowerText.length && i < EMBEDDING_DIMENSIONS; i++) {
    vec[i % EMBEDDING_DIMENSIONS] += lowerText.charCodeAt(i) / 1000;
  }

  // Normalize
  const magnitude = Math.sqrt(vec.reduce((sum: number, v: number) => sum + v * v, 0));
  if (magnitude > 0) {
    for (let i = 0; i < vec.length; i++) {
      vec[i] /= magnitude;
    }
  }

  return vec;
}
