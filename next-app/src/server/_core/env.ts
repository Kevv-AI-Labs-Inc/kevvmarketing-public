import { resolveDatabaseUrl } from "./database-url";

export const ENV = {
  // 基础
  databaseUrl: resolveDatabaseUrl() ?? "",
  isProduction: process.env.NODE_ENV === "production",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",

  // AI Provider — default to OpenAI in production runtime
  aiProvider: (process.env.AI_PROVIDER ?? "openai") as "gemini" | "openai",

  // Google Gemini
  geminiApiKey: process.env.GEMINI_API_KEY ?? "",
  geminiModel: process.env.GEMINI_MODEL ?? "gemini-2.0-flash",
  geminiEmbeddingModel: process.env.GEMINI_EMBEDDING_MODEL ?? "gemini-embedding-001",

  // OpenAI (fallback provider)
  openaiApiStyle: process.env.OPENAI_API_STYLE ?? "",
  azureOpenaiEndpoint: process.env.AZURE_OPENAI_ENDPOINT ?? "",
  azureOpenaiChatEndpoint: process.env.AZURE_OPENAI_CHAT_ENDPOINT ?? "",
  azureOpenaiChatApiKey: process.env.AZURE_OPENAI_CHAT_API_KEY ?? "",
  azureOpenaiEmbeddingEndpoint:
    process.env.AZURE_OPENAI_EMBEDDING_ENDPOINT ?? "",
  azureOpenaiEmbeddingApiKey:
    process.env.AZURE_OPENAI_EMBEDDING_API_KEY ?? "",
  azureOpenaiBatchEndpoint: process.env.AZURE_OPENAI_BATCH_ENDPOINT ?? "",
  azureOpenaiBatchApiKey: process.env.AZURE_OPENAI_BATCH_API_KEY ?? "",
  azureOpenaiVideoEndpoint: process.env.AZURE_OPENAI_VIDEO_ENDPOINT ?? "",
  azureOpenaiVideoApiKey: process.env.AZURE_OPENAI_VIDEO_API_KEY ?? "",
  openaiApiKey: process.env.OPENAI_API_KEY ?? "",
  openaiBaseUrl: process.env.OPENAI_BASE_URL ?? "https://api.openai.com",
  openaiModel: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
  openaiAreaMagnetModel: process.env.OPENAI_AREA_MAGNET_MODEL ?? "gpt-5-pro",
  openaiSearchModel: process.env.OPENAI_SEARCH_MODEL ?? "gpt-4o-search-preview",
  openaiEmbeddingModel: process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small",
  openaiBatchEndpoint: process.env.OPENAI_BATCH_ENDPOINT ?? "/v1/embeddings",
  openaiBatchRequestUrl: process.env.OPENAI_BATCH_REQUEST_URL ?? "/v1/embeddings",

  // Cloudflare R2 — 文件存储
  r2AccountId: process.env.R2_ACCOUNT_ID ?? "",
  r2AccessKeyId: process.env.R2_ACCESS_KEY_ID ?? "",
  r2SecretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? "",
  r2BucketName: process.env.R2_BUCKET_NAME ?? "bbo-storage",
  r2PublicUrl: process.env.R2_PUBLIC_URL ?? "",

  // Route providers (server-side)
  mapRouteProvider: (process.env.MAP_ROUTE_PROVIDER ?? "google") as
    | "google"
    | "none",
  googleMapsServerApiKey: process.env.GOOGLE_MAPS_SERVER_API_KEY ?? "",
  mapRouteRequestTimeoutMs: (() => {
    const parsed = Number.parseInt(
      process.env.MAP_ROUTE_REQUEST_TIMEOUT_MS ?? "15000",
      10
    );
    if (!Number.isFinite(parsed) || parsed <= 0) return 15000;
    return parsed;
  })(),

  // Listing-Data Service — the source of truth for property data
  listingDataServiceUrl: process.env.LISTING_DATA_SERVICE_URL ?? "",
  listingDataServiceApiKey: process.env.LISTING_DATA_SERVICE_API_KEY ?? "",

  // Webhook security
  webhookSecret: process.env.WEBHOOK_SECRET ?? "",

  // Video studio providers
  videoProvider: (process.env.VIDEO_PROVIDER ?? "local") as
    | "local"
    | "sora"
    | "jimeng",
  videoRequestTimeoutMs: (() => {
    const parsed = Number.parseInt(
      process.env.VIDEO_REQUEST_TIMEOUT_MS ?? "30000",
      10
    );
    if (!Number.isFinite(parsed) || parsed <= 0) return 30000;
    return parsed;
  })(),

  // OpenAI Sora (cloud video)
  openaiVideoModel: process.env.OPENAI_VIDEO_MODEL ?? "sora-2",
  openaiVideoApiPath: process.env.OPENAI_VIDEO_API_PATH ?? "/v1/videos",

  // Jimeng / Dreamina (cloud video)
  jimengApiKey: process.env.JIMENG_API_KEY ?? "",
  jimengApiBaseUrl: process.env.JIMENG_API_BASE_URL ?? "",
  jimengVideoModel: process.env.JIMENG_VIDEO_MODEL ?? "jimeng-3.0",
  jimengVideoApiPath: process.env.JIMENG_VIDEO_API_PATH ?? "/v1/videos",
};
