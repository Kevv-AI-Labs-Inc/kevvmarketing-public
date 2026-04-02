import { ENV } from "./env";

export type OpenAIApiStyle = "openai" | "azure";
export type OpenAIApiScope =
  | "default"
  | "chat"
  | "embeddings"
  | "video";

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function trimLeadingSlash(value: string): string {
  return value.replace(/^\/+/, "");
}

function stripUrlQueryAndHash(value: string): string {
  try {
    const parsed = new URL(value);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return value.split("?")[0].split("#")[0];
  }
}

function looksLikeAzureEndpoint(value: string): boolean {
  const normalized = value.toLowerCase();
  return (
    normalized.includes(".openai.azure.com") ||
    normalized.includes(".cognitiveservices.azure.com")
  );
}

export function resolveOpenAiApiStyle(): OpenAIApiStyle {
  const explicit = ENV.openaiApiStyle.trim().toLowerCase();
  if (explicit === "azure") return "azure";
  if (explicit === "openai") return "openai";

  const probe = (ENV.azureOpenaiEndpoint || ENV.openaiBaseUrl).trim();
  if (probe && looksLikeAzureEndpoint(probe)) {
    return "azure";
  }
  return "openai";
}

function normalizeOpenAiBaseUrl(raw: string): string {
  const base = trimTrailingSlash(raw.trim());
  if (!base) return "https://api.openai.com/v1";
  if (/\/v1$/i.test(base)) return base;
  return `${base}/v1`;
}

function normalizeAzureBaseUrl(raw: string): string {
  let base = trimTrailingSlash(stripUrlQueryAndHash(raw.trim()));
  if (!base) {
    throw new Error(
      "Azure OpenAI endpoint is missing. Set AZURE_OPENAI_ENDPOINT or OPENAI_BASE_URL."
    );
  }

  // Support "Target URI" pasted from Azure deployment details:
  // https://<resource>.cognitiveservices.azure.com/openai/deployments/<name>/...
  base = base
    .replace(/\/openai\/deployments\/[^/]+\/.*$/i, "/openai/v1")
    .replace(/\/openai\/v1\/.*$/i, "/openai/v1")
    .replace(
      /\/openai\/(chat\/completions|responses|embeddings|files|batches|videos?)$/i,
      "/openai/v1"
    );

  if (/\/openai\/v1$/i.test(base)) return base;
  if (/\/openai$/i.test(base)) return `${base}/v1`;
  return `${base}/openai/v1`;
}

function resolveAzureEndpointForScope(scope: OpenAIApiScope): string {
  switch (scope) {
    case "chat":
      return (
        ENV.azureOpenaiChatEndpoint ||
        ENV.azureOpenaiEndpoint ||
        ENV.openaiBaseUrl
      );
    case "embeddings":
      return (
        ENV.azureOpenaiEmbeddingEndpoint ||
        ENV.azureOpenaiEndpoint ||
        ENV.openaiBaseUrl
      );
    case "video":
      return (
        ENV.azureOpenaiVideoEndpoint ||
        ENV.azureOpenaiEndpoint ||
        ENV.openaiBaseUrl
      );
    default:
      return ENV.azureOpenaiEndpoint || ENV.openaiBaseUrl;
  }
}

function resolveAzureApiKeyForScope(scope: OpenAIApiScope): string {
  switch (scope) {
    case "chat":
      return ENV.azureOpenaiChatApiKey || ENV.openaiApiKey;
    case "embeddings":
      return ENV.azureOpenaiEmbeddingApiKey || ENV.openaiApiKey;
    case "video":
      return ENV.azureOpenaiVideoApiKey || ENV.openaiApiKey;
    default:
      return ENV.openaiApiKey;
  }
}

export function resolveOpenAiApiKey(options?: {
  scope?: OpenAIApiScope;
}): string {
  const scope = options?.scope ?? "default";
  const style = resolveOpenAiApiStyle();
  if (style === "azure") {
    return resolveAzureApiKeyForScope(scope);
  }
  return ENV.openaiApiKey;
}

export function resolveOpenAiApiBaseUrl(options?: {
  scope?: OpenAIApiScope;
}): string {
  const scope = options?.scope ?? "default";
  const style = resolveOpenAiApiStyle();
  if (style === "azure") {
    return normalizeAzureBaseUrl(resolveAzureEndpointForScope(scope));
  }
  return normalizeOpenAiBaseUrl(ENV.openaiBaseUrl || "https://api.openai.com");
}

/**
 * Build a unified OpenAI resource URL.
 * Accepts "chat/completions", "/chat/completions", "/v1/chat/completions", etc.
 */
export function buildOpenAiApiUrl(
  resourcePath: string,
  options?: { scope?: OpenAIApiScope }
): string {
  const base = resolveOpenAiApiBaseUrl(options);
  let path = trimLeadingSlash(resourcePath.trim());
  if (path.toLowerCase().startsWith("v1/")) {
    path = path.slice(3);
  }
  return `${base}/${path}`;
}

export function buildOpenAiAuthHeaders(options?: {
  includeContentType?: boolean;
  scope?: OpenAIApiScope;
}): Record<string, string> {
  const includeContentType = options?.includeContentType ?? true;
  const scope = options?.scope ?? "default";
  const headers: Record<string, string> = {};

  if (includeContentType) {
    headers["Content-Type"] = "application/json";
  }

  const style = resolveOpenAiApiStyle();
  const key = resolveOpenAiApiKey({ scope });
  if (!key) return headers;

  if (style === "azure") {
    headers["api-key"] = key;
  } else {
    headers.Authorization = `Bearer ${key}`;
  }

  return headers;
}
