DO $$
BEGIN
    CREATE TYPE "agent_tier" AS ENUM ('free', 'pro', 'premium');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    CREATE TYPE "agent_profile_status" AS ENUM ('draft', 'active', 'suspended');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    CREATE TYPE "lead_score" AS ENUM ('hot', 'warm', 'cold');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    CREATE TYPE "contact_status" AS ENUM ('new', 'contacted', 'qualified', 'converted', 'lost', 'archived');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    CREATE TYPE "conversation_status" AS ENUM ('active', 'closed', 'converted');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    CREATE TYPE "message_role" AS ENUM ('system', 'user', 'assistant');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    CREATE TYPE "postcard_campaign_status" AS ENUM ('draft', 'ready', 'scheduled', 'queued', 'processing', 'completed', 'failed', 'canceled');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    CREATE TYPE "postcard_send_strategy" AS ENUM ('send_now', 'scheduled', 'arrive_by');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    CREATE TYPE "postcard_mailing_status" AS ENUM ('pending', 'validating', 'ready', 'submitted', 'mailed', 'in_transit', 'delivered', 'returned', 'failed');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    CREATE TYPE "postcard_mailing_channel" AS ENUM ('postcard', 'letter');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "agent_profiles" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer,
  "slug" varchar(64) NOT NULL,
  "email" varchar(320) NOT NULL,
  "name" varchar(255) NOT NULL,
  "phone" varchar(32),
  "title" varchar(128) DEFAULT 'Licensed Real Estate Agent',
  "brokerage" varchar(255),
  "license_state" varchar(16),
  "office_address" varchar(255),
  "booking_url" text,
  "photo_url" text,
  "logo_url" text,
  "hero_image_url" text,
  "bio" text,
  "service_areas" jsonb DEFAULT '[]'::jsonb,
  "specialties" jsonb DEFAULT '[]'::jsonb,
  "languages" jsonb DEFAULT '["English"]'::jsonb,
  "awards" jsonb DEFAULT '[]'::jsonb,
  "testimonials" jsonb DEFAULT '[]'::jsonb,
  "transactions" jsonb DEFAULT '[]'::jsonb,
  "neighborhood_knowledge" jsonb DEFAULT '{}'::jsonb,
  "social_links" jsonb DEFAULT '{}'::jsonb,
  "visibility_settings" jsonb DEFAULT '{"showPhone":true,"showEmail":true,"showTransactions":true,"showAwards":true,"showTestimonials":true,"showAddress":true}'::jsonb,
  "years_experience" integer DEFAULT 0,
  "template_id" varchar(32) DEFAULT 'classic',
  "color_scheme" varchar(32) DEFAULT 'gold',
  "status" "agent_profile_status" DEFAULT 'active' NOT NULL,
  "tier" "agent_tier" DEFAULT 'free' NOT NULL,
  "stripe_customer_id" varchar(128),
  "stripe_subscription_id" varchar(128),
  "subscription_status" varchar(32),
  "current_period_end" timestamp,
  "last_published_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "contacts" (
  "id" serial PRIMARY KEY NOT NULL,
  "agent_id" integer,
  "agent_profile_id" integer,
  "conversation_session_id" integer,
  "valuation_run_id" integer,
  "external_id" varchar(255),
  "source" varchar(64) DEFAULT 'manual' NOT NULL,
  "source_ref" varchar(255),
  "status" "contact_status" DEFAULT 'new' NOT NULL,
  "score" "lead_score" DEFAULT 'cold' NOT NULL,
  "intent" varchar(64),
  "summary" text,
  "name" varchar(255),
  "first_name" varchar(100),
  "last_name" varchar(100),
  "email" varchar(320),
  "phone" varchar(64),
  "wechat_id" varchar(100),
  "preferred_language" varchar(10) DEFAULT 'en',
  "budget_min" varchar(20),
  "budget_max" varchar(20),
  "area" varchar(255),
  "timeline" varchar(255),
  "notes" text,
  "tags" jsonb DEFAULT '[]'::jsonb,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "address_line_1" varchar(255),
  "address_line_2" varchar(255),
  "city" varchar(120),
  "state" varchar(32),
  "postal_code" varchar(20),
  "country" varchar(2) DEFAULT 'US',
  "address_verified" boolean DEFAULT false NOT NULL,
  "address_verified_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "conversation_sessions" (
  "id" serial PRIMARY KEY NOT NULL,
  "session_key" varchar(64) NOT NULL,
  "agent_id" integer,
  "agent_profile_id" integer,
  "contact_id" integer,
  "source" varchar(64) DEFAULT 'agent_site_chat' NOT NULL,
  "status" "conversation_status" DEFAULT 'active' NOT NULL,
  "visitor_id" varchar(64),
  "visitor_name" varchar(255),
  "visitor_email" varchar(320),
  "visitor_phone" varchar(64),
  "detected_language" varchar(10) DEFAULT 'en',
  "page_path" varchar(255),
  "referrer" varchar(512),
  "utm_source" varchar(128),
  "utm_medium" varchar(128),
  "utm_campaign" varchar(128),
  "summary" text,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "last_message_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "conversation_messages" (
  "id" serial PRIMARY KEY NOT NULL,
  "session_id" integer NOT NULL,
  "role" "message_role" NOT NULL,
  "content" text NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "valuation_runs" (
  "id" serial PRIMARY KEY NOT NULL,
  "agent_id" integer,
  "agent_profile_id" integer,
  "contact_id" integer,
  "source" varchar(64) DEFAULT 'home_value' NOT NULL,
  "status" varchar(20) DEFAULT 'completed' NOT NULL,
  "locale" varchar(10) DEFAULT 'en',
  "address" text NOT NULL,
  "result" jsonb,
  "model_used" varchar(100),
  "provider" varchar(100),
  "summary" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "postcard_contact_imports" (
  "id" serial PRIMARY KEY NOT NULL,
  "agent_id" integer,
  "filename" varchar(255) NOT NULL,
  "total_rows" integer DEFAULT 0 NOT NULL,
  "imported_rows" integer DEFAULT 0 NOT NULL,
  "failed_rows" integer DEFAULT 0 NOT NULL,
  "mapping_config" jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "postcard_address_validations" (
  "id" serial PRIMARY KEY NOT NULL,
  "contact_id" integer NOT NULL,
  "provider" varchar(32) NOT NULL,
  "is_deliverable" boolean DEFAULT false NOT NULL,
  "analysis_summary" text,
  "normalized_address" jsonb,
  "provider_payload" jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "postcard_templates" (
  "id" serial PRIMARY KEY NOT NULL,
  "agent_id" integer,
  "name" varchar(255) NOT NULL,
  "category" varchar(64) NOT NULL,
  "is_system" boolean DEFAULT false NOT NULL,
  "size_code" varchar(16) DEFAULT '4x6' NOT NULL,
  "thumbnail_url" text,
  "note" text,
  "front_editor_state" jsonb,
  "back_editor_state" jsonb,
  "front_render_definition" jsonb,
  "back_render_definition" jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "postcard_campaigns" (
  "id" serial PRIMARY KEY NOT NULL,
  "agent_id" integer,
  "template_id" integer,
  "name" varchar(255) NOT NULL,
  "status" "postcard_campaign_status" DEFAULT 'draft' NOT NULL,
  "send_strategy" "postcard_send_strategy" DEFAULT 'send_now' NOT NULL,
  "scheduled_at" timestamp,
  "arrive_by_date" timestamp,
  "currency" varchar(3) DEFAULT 'USD' NOT NULL,
  "mail_type" varchar(32) DEFAULT 'usps_first_class' NOT NULL,
  "unit_price_cents" integer DEFAULT 0 NOT NULL,
  "subtotal_cents" integer DEFAULT 0 NOT NULL,
  "service_fee_cents" integer DEFAULT 0 NOT NULL,
  "total_cents" integer DEFAULT 0 NOT NULL,
  "recipient_count" integer DEFAULT 0 NOT NULL,
  "validated_count" integer DEFAULT 0 NOT NULL,
  "submitted_count" integer DEFAULT 0 NOT NULL,
  "delivered_count" integer DEFAULT 0 NOT NULL,
  "failed_count" integer DEFAULT 0 NOT NULL,
  "audience_snapshot" jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "postcard_mailings" (
  "id" serial PRIMARY KEY NOT NULL,
  "campaign_id" integer NOT NULL,
  "contact_id" integer NOT NULL,
  "provider" varchar(32) DEFAULT 'lob_mock' NOT NULL,
  "provider_reference" varchar(255),
  "channel" "postcard_mailing_channel" DEFAULT 'postcard' NOT NULL,
  "status" "postcard_mailing_status" DEFAULT 'pending' NOT NULL,
  "cost_cents" integer DEFAULT 0 NOT NULL,
  "expected_delivery_at" timestamp,
  "delivered_at" timestamp,
  "failure_reason" text,
  "render_payload" jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "postcard_events" (
  "id" serial PRIMARY KEY NOT NULL,
  "mailing_id" integer NOT NULL,
  "event_type" varchar(32) NOT NULL,
  "payload" jsonb,
  "event_timestamp" timestamp DEFAULT now() NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "agent_profiles_slug_unique" ON "agent_profiles" ("slug");
CREATE UNIQUE INDEX IF NOT EXISTS "agent_profiles_email_unique" ON "agent_profiles" ("email");
CREATE UNIQUE INDEX IF NOT EXISTS "agent_profiles_user_id_unique" ON "agent_profiles" ("user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "conversation_sessions_key_unique" ON "conversation_sessions" ("session_key");
CREATE INDEX IF NOT EXISTS "contacts_agent_updated_idx" ON "contacts" ("agent_id", "updated_at" DESC);
CREATE INDEX IF NOT EXISTS "contacts_profile_updated_idx" ON "contacts" ("agent_profile_id", "updated_at" DESC);
CREATE INDEX IF NOT EXISTS "valuation_runs_agent_created_idx" ON "valuation_runs" ("agent_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "postcard_campaigns_agent_created_idx" ON "postcard_campaigns" ("agent_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "postcard_mailings_campaign_status_idx" ON "postcard_mailings" ("campaign_id", "status");
