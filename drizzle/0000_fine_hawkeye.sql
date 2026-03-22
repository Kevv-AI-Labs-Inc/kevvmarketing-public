CREATE TYPE "public"."role" AS ENUM('user', 'admin');--> statement-breakpoint
CREATE TABLE "ad_campaigns" (
	"id" serial PRIMARY KEY NOT NULL,
	"agent_id" integer,
	"listing_key" varchar(255) NOT NULL,
	"title" varchar(255),
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"platforms" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"budget_daily" varchar(20),
	"budget_total" varchar(20),
	"start_date" timestamp,
	"end_date" timestamp,
	"trigger_type" varchar(20) DEFAULT 'manual' NOT NULL,
	"listing_snapshot" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ad_creatives" (
	"id" serial PRIMARY KEY NOT NULL,
	"campaign_id" integer NOT NULL,
	"platform" varchar(20) NOT NULL,
	"language" varchar(10) DEFAULT 'en' NOT NULL,
	"content_type" varchar(20) DEFAULT 'image_ad' NOT NULL,
	"headline" varchar(255),
	"body" text,
	"cta_text" varchar(100),
	"image_urls" jsonb DEFAULT '[]'::jsonb,
	"video_url" text,
	"platform_ad_id" varchar(255),
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ad_performance" (
	"id" serial PRIMARY KEY NOT NULL,
	"creative_id" integer NOT NULL,
	"campaign_id" integer NOT NULL,
	"date" timestamp NOT NULL,
	"impressions" integer DEFAULT 0 NOT NULL,
	"clicks" integer DEFAULT 0 NOT NULL,
	"leads" integer DEFAULT 0 NOT NULL,
	"spend" varchar(20),
	"cpc" varchar(20),
	"ctr" varchar(20),
	"cpl" varchar(20),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_insights" (
	"id" serial PRIMARY KEY NOT NULL,
	"agent_id" integer,
	"contact_id" integer,
	"insight_type" varchar(30) NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"priority" varchar(10) DEFAULT 'medium' NOT NULL,
	"suggested_action" varchar(30),
	"action_data" jsonb,
	"is_read" boolean DEFAULT false NOT NULL,
	"is_actioned" boolean DEFAULT false NOT NULL,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"contact_id" integer,
	"agent_id" integer,
	"event_type" varchar(50) NOT NULL,
	"event_data" jsonb,
	"source_type" varchar(30),
	"source_id" varchar(255),
	"session_token" varchar(255),
	"ip_address" varchar(45),
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" serial PRIMARY KEY NOT NULL,
	"externalId" varchar(255),
	"name" varchar(255),
	"email" varchar(320),
	"phone" varchar(50),
	"budgetMin" varchar(20),
	"budgetMax" varchar(20),
	"preferredCities" text,
	"preferredBedrooms" integer,
	"preferredPropertyTypes" text,
	"lifestyleNotes" text,
	"mustHaveFeatures" text,
	"dealBreakers" text,
	"profileSummary" text,
	"agentId" integer,
	"buyer_type" varchar(20),
	"language" varchar(10) DEFAULT 'en',
	"wechat_id" varchar(100),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cma_reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"agent_id" integer,
	"listing_key" varchar(255),
	"address" varchar(500),
	"target_data" jsonb,
	"comps_data" jsonb,
	"ai_analysis" text,
	"suggested_price_low" varchar(20),
	"suggested_price_high" varchar(20),
	"market_trends" jsonb,
	"branding" jsonb,
	"pdf_url" text,
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"agent_id" integer,
	"type" varchar(30) NOT NULL,
	"title" varchar(255) NOT NULL,
	"content_zh" text,
	"content_en" text,
	"platform" varchar(30),
	"variables" jsonb,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deal_stories" (
	"id" serial PRIMARY KEY NOT NULL,
	"agent_id" integer,
	"company_id" integer,
	"listing_key" varchar(255),
	"closed_date" timestamp,
	"list_price" varchar(20),
	"closed_price" varchar(20),
	"days_on_market" integer,
	"city" varchar(100),
	"state_or_province" varchar(50),
	"property_type" varchar(50),
	"client_type" varchar(20),
	"story_text" text,
	"key_takeaways" jsonb,
	"tags" jsonb,
	"embedding" vector(1536),
	"embedding_model" varchar(100),
	"embedding_updated_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drip_campaigns" (
	"id" serial PRIMARY KEY NOT NULL,
	"agent_id" integer,
	"name" varchar(255) NOT NULL,
	"trigger_type" varchar(30) NOT NULL,
	"trigger_config" jsonb,
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"total_enrollments" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drip_enrollments" (
	"id" serial PRIMARY KEY NOT NULL,
	"campaign_id" integer NOT NULL,
	"contact_id" integer NOT NULL,
	"current_step" integer DEFAULT 0 NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"next_fire_at" timestamp,
	"last_fired_at" timestamp,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drip_steps" (
	"id" serial PRIMARY KEY NOT NULL,
	"campaign_id" integer NOT NULL,
	"step_order" integer NOT NULL,
	"channel" varchar(20) NOT NULL,
	"template_id" integer,
	"subject" varchar(255),
	"content" text,
	"delay_hours" integer DEFAULT 24 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "engagement_scores" (
	"id" serial PRIMARY KEY NOT NULL,
	"contact_id" integer NOT NULL,
	"agent_id" integer,
	"score" integer DEFAULT 0 NOT NULL,
	"factors" jsonb,
	"score_model" varchar(30) DEFAULT 'v1' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "generated_content" (
	"id" serial PRIMARY KEY NOT NULL,
	"agent_id" integer,
	"source_type" varchar(30) NOT NULL,
	"source_id" varchar(255),
	"content_type" varchar(30) NOT NULL,
	"content" text NOT NULL,
	"language" varchar(10) DEFAULT 'en' NOT NULL,
	"platform" varchar(30),
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "listing_subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"agent_id" integer,
	"client_id" integer,
	"name" varchar(255),
	"cities" jsonb,
	"min_price" varchar(20),
	"max_price" varchar(20),
	"min_beds" integer,
	"max_beds" integer,
	"property_types" jsonb,
	"keywords" text,
	"channel" varchar(20) DEFAULT 'email' NOT NULL,
	"frequency" varchar(20) DEFAULT 'instant' NOT NULL,
	"language" varchar(10) DEFAULT 'en',
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"last_notified_at" timestamp,
	"match_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "neighborhood_scores" (
	"id" serial PRIMARY KEY NOT NULL,
	"listing_key" varchar(255),
	"zip_code" varchar(10),
	"lat" varchar(20) NOT NULL,
	"lng" varchar(20) NOT NULL,
	"overall_score" integer DEFAULT 0 NOT NULL,
	"school_score" integer DEFAULT 0,
	"school_data" jsonb,
	"community_score" integer DEFAULT 0,
	"community_data" jsonb,
	"convenience_score" integer DEFAULT 0,
	"poi_data" jsonb,
	"commute_score" integer DEFAULT 0,
	"commute_data" jsonb,
	"safety_score" integer DEFAULT 0,
	"cached_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recommendationLogs" (
	"id" serial PRIMARY KEY NOT NULL,
	"clientId" integer,
	"propertyId" integer,
	"listingKey" varchar(255),
	"similarityScore" varchar(20),
	"boostScore" varchar(20),
	"finalScore" varchar(20),
	"aiPitchText" text,
	"isSent" integer DEFAULT 0,
	"isClicked" integer DEFAULT 0,
	"feedbackRating" integer,
	"feedbackNotes" text,
	"feedbackType" varchar(20),
	"queryText" text,
	"hardFilters" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "share_session_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"share_session_id" integer NOT NULL,
	"event_type" varchar(50) NOT NULL,
	"event_data" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "share_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"token" varchar(64) NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"title" varchar(255),
	"intro_message" text,
	"client_name" varchar(255),
	"created_by_open_id" varchar(64) NOT NULL,
	"created_by_company_id" integer,
	"created_by_api_key_id" integer,
	"created_by_name" varchar(255),
	"created_by_email" varchar(320),
	"agent_branding" jsonb NOT NULL,
	"listing_keys" jsonb NOT NULL,
	"tour_plan" jsonb,
	"external_listings" jsonb,
	"wechat_share_config" jsonb,
	"expires_at" timestamp,
	"view_count" integer DEFAULT 0 NOT NULL,
	"last_viewed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "showing_feedback" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer,
	"property_id" integer,
	"listing_key" varchar(255),
	"agent_id" integer,
	"showing_date" timestamp,
	"overall_rating" integer,
	"would_revisit" boolean,
	"price_reaction" varchar(20),
	"feedback_text" text,
	"liked" jsonb,
	"disliked" jsonb,
	"embedding" vector(1536),
	"embedding_model" varchar(100),
	"embedding_updated_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "showing_tours" (
	"id" serial PRIMARY KEY NOT NULL,
	"agent_name" varchar(255),
	"agent_email" varchar(255),
	"agent_phone" varchar(50),
	"agent_logo_url" text,
	"client_name" varchar(255),
	"client_email" varchar(255),
	"tour_date" timestamp,
	"start_address" text,
	"property_ids" jsonb NOT NULL,
	"optimized_route" jsonb,
	"pdf_url" text,
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "social_posts" (
	"id" serial PRIMARY KEY NOT NULL,
	"agent_id" integer,
	"platform" varchar(30) NOT NULL,
	"content" text NOT NULL,
	"content_zh" text,
	"image_urls" jsonb DEFAULT '[]'::jsonb,
	"video_url" text,
	"hashtags" jsonb DEFAULT '[]'::jsonb,
	"scheduled_at" timestamp,
	"published_at" timestamp,
	"external_post_id" varchar(255),
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"listing_key" varchar(255),
	"template_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscription_notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"subscription_id" integer NOT NULL,
	"listing_key" varchar(255) NOT NULL,
	"channel" varchar(20) NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"sent_at" timestamp,
	"clicked_at" timestamp,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"openId" varchar(64) NOT NULL,
	"name" text,
	"email" varchar(320),
	"loginMethod" varchar(64),
	"role" "role" DEFAULT 'user' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"lastSignedIn" timestamp DEFAULT now() NOT NULL,
	"picture" text,
	CONSTRAINT "users_openId_unique" UNIQUE("openId")
);
--> statement-breakpoint
CREATE TABLE "video_jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"agent_id" integer,
	"listing_key" varchar(255),
	"title" varchar(255),
	"provider" varchar(20) NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"job_external_id" varchar(255),
	"prompt" text,
	"aspect_ratio" varchar(10) DEFAULT '9:16',
	"image_count" integer DEFAULT 0,
	"video_url" text,
	"thumbnail_url" text,
	"duration_seconds" integer,
	"metadata" jsonb,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE UNIQUE INDEX "share_sessions_token_unique" ON "share_sessions" USING btree ("token");