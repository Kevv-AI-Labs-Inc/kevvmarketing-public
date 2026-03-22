-- Migration: Dual 3072d embeddings → Single 1536d embedding
-- All existing vector data is NULL, so no data loss.

-- ══════════════════════════════════════════════════════════════════
-- PROPERTIES TABLE
-- ══════════════════════════════════════════════════════════════════
ALTER TABLE properties DROP COLUMN IF EXISTS "embeddingGemini";
ALTER TABLE properties DROP COLUMN IF EXISTS "embeddingOpenai";
ALTER TABLE properties DROP COLUMN IF EXISTS "embeddingOpenaiSearch";
ALTER TABLE properties DROP COLUMN IF EXISTS "embeddingGeminiModel";
ALTER TABLE properties DROP COLUMN IF EXISTS "embeddingOpenaiModel";
ALTER TABLE properties ADD COLUMN IF NOT EXISTS "embedding" vector(1536);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS "embeddingModel" varchar(100);

-- ══════════════════════════════════════════════════════════════════
-- AGENT_PROFILES TABLE
-- ══════════════════════════════════════════════════════════════════
ALTER TABLE agent_profiles DROP COLUMN IF EXISTS "embedding_gemini";
ALTER TABLE agent_profiles DROP COLUMN IF EXISTS "embedding_openai";
ALTER TABLE agent_profiles ADD COLUMN IF NOT EXISTS "embedding" vector(1536);

-- ══════════════════════════════════════════════════════════════════
-- CLIENT_PROFILES TABLE
-- ══════════════════════════════════════════════════════════════════
ALTER TABLE client_profiles DROP COLUMN IF EXISTS "embedding_gemini";
ALTER TABLE client_profiles DROP COLUMN IF EXISTS "embedding_openai";
ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS "embedding" vector(1536);

-- ══════════════════════════════════════════════════════════════════
-- NEIGHBORHOODS TABLE
-- ══════════════════════════════════════════════════════════════════
ALTER TABLE neighborhoods DROP COLUMN IF EXISTS "embedding_gemini";
ALTER TABLE neighborhoods DROP COLUMN IF EXISTS "embedding_openai";
ALTER TABLE neighborhoods DROP COLUMN IF EXISTS "embedding_gemini_model";
ALTER TABLE neighborhoods DROP COLUMN IF EXISTS "embedding_openai_model";
ALTER TABLE neighborhoods ADD COLUMN IF NOT EXISTS "embedding" vector(1536);
ALTER TABLE neighborhoods ADD COLUMN IF NOT EXISTS "embedding_model" varchar(100);

-- ══════════════════════════════════════════════════════════════════
-- DEAL_STORIES TABLE
-- ══════════════════════════════════════════════════════════════════
ALTER TABLE deal_stories DROP COLUMN IF EXISTS "embedding_gemini";
ALTER TABLE deal_stories DROP COLUMN IF EXISTS "embedding_openai";
ALTER TABLE deal_stories DROP COLUMN IF EXISTS "embedding_gemini_model";
ALTER TABLE deal_stories DROP COLUMN IF EXISTS "embedding_openai_model";
ALTER TABLE deal_stories ADD COLUMN IF NOT EXISTS "embedding" vector(1536);
ALTER TABLE deal_stories ADD COLUMN IF NOT EXISTS "embedding_model" varchar(100);

-- ══════════════════════════════════════════════════════════════════
-- SHOWING_FEEDBACK TABLE
-- ══════════════════════════════════════════════════════════════════
ALTER TABLE showing_feedback DROP COLUMN IF EXISTS "embedding_gemini";
ALTER TABLE showing_feedback DROP COLUMN IF EXISTS "embedding_openai";
ALTER TABLE showing_feedback DROP COLUMN IF EXISTS "embedding_gemini_model";
ALTER TABLE showing_feedback DROP COLUMN IF EXISTS "embedding_openai_model";
ALTER TABLE showing_feedback ADD COLUMN IF NOT EXISTS "embedding" vector(1536);
ALTER TABLE showing_feedback ADD COLUMN IF NOT EXISTS "embedding_model" varchar(100);

SELECT 'Migration to 1536d single embedding complete!' AS result;
