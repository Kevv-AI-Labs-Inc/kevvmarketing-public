import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
  customType,
} from "drizzle-orm/pg-core";

/**
 * Custom pgvector type for Drizzle ORM.
 * Stores 3072-dimensional vectors for embedding similarity search.
 * Dual columns (Gemini + OpenAI) enable A/B testing.
 */
const vector = customType<{
  data: number[];
  driverData: string;
  config: { dimensions: number };
}>({
  dataType(config) {
    return `vector(${config?.dimensions ?? 3072})`;
  },
  fromDriver(value: string): number[] {
    // pgvector returns "[0.1,0.2,...]" format
    return value.slice(1, -1).split(",").map(Number);
  },
  toDriver(value: number[]): string {
    return `[${value.join(",")}]`;
  },
});

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const roleEnum = pgEnum("role", ["user", "admin"]);

export const users = pgTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: serial("id").primaryKey(),
  /** OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: roleEnum("role").default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
  picture: text("picture"),
  // Auth provider IDs for multi-provider SSO
  googleId: varchar("googleId", { length: 128 }),
  microsoftEntraId: varchar("microsoftEntraId", { length: 128 }),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Magic Link Authentication ──────────────────────────────
export const magicLinks = pgTable("magic_links", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 320 }).notNull(),
  tokenHash: varchar("tokenHash", { length: 128 }).notNull().unique(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── Marketing App Tables ──────────────────────────────────
// NOTE: properties, media, members, offices, open_houses, agent_deal_stats,
// syncLog tables have been moved to listing-data-service.
// This schema only contains marketing-app tables.




export const clients = pgTable("clients", {
  id: serial("id").primaryKey(),
  externalId: varchar("externalId", { length: 255 }), // ID from external system (e.g., Homix CRM)
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 50 }),
  // Preferences
  budgetMin: varchar("budgetMin", { length: 20 }),
  budgetMax: varchar("budgetMax", { length: 20 }),
  preferredCities: text("preferredCities"), // JSON array
  preferredBedrooms: integer("preferredBedrooms"),
  preferredPropertyTypes: text("preferredPropertyTypes"), // JSON array
  // Qualitative Preferences
  lifestyleNotes: text("lifestyleNotes"),
  mustHaveFeatures: text("mustHaveFeatures"), // JSON array
  dealBreakers: text("dealBreakers"), // JSON array
  profileSummary: text("profileSummary"), // Full profile text for AI
  agentId: integer("agentId"),
  buyerType: varchar("buyer_type", { length: 20 }),
  // local | cross_border | investor | first_time
  language: varchar("language", { length: 10 }).default("en"),
  // en | zh | zh_en
  wechatId: varchar("wechat_id", { length: 100 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export const recommendationLogs = pgTable("recommendationLogs", {
  id: serial("id").primaryKey(),
  clientId: integer("clientId"),
  propertyId: integer("propertyId"),
  listingKey: varchar("listingKey", { length: 255 }),
  // AI Output
  similarityScore: varchar("similarityScore", { length: 20 }),
  boostScore: varchar("boostScore", { length: 20 }),
  finalScore: varchar("finalScore", { length: 20 }),
  aiPitchText: text("aiPitchText"), // Generated recommendation text
  // Feedback
  isSent: integer("isSent").default(0),
  isClicked: integer("isClicked").default(0),
  feedbackRating: integer("feedbackRating"), // 1-5 rating
  feedbackNotes: text("feedbackNotes"),
  feedbackType: varchar("feedbackType", { length: 20 }), // 'approved', 'rejected', 'pending'
  // Context
  queryText: text("queryText"), // Original client profile text used
  hardFilters: text("hardFilters"), // JSON of filters applied
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Client = typeof clients.$inferSelect;
export type InsertClient = typeof clients.$inferInsert;
export type RecommendationLog = typeof recommendationLogs.$inferSelect;
export type InsertRecommendationLog = typeof recommendationLogs.$inferInsert;

// ============================================================
// Integration tables for optional vector-search / listing-data services
// ============================================================

// NOTE: agentProfiles, clientProfiles, companyMlsAccess, apiKeys, apiUsage,
// cmaAnalyses tables have been moved to listing-data-service.

/**
 * Public listing share sessions for client-facing presentations.
 * Stores agent branding, selected listing keys and optional tour plan.
 */
export const shareSessions = pgTable(
  "share_sessions",
  {
    id: serial("id").primaryKey(),
    token: varchar("token", { length: 64 }).notNull(),
    status: varchar("status", { length: 20 }).default("active").notNull(), // active | revoked | expired
    title: varchar("title", { length: 255 }),
    introMessage: text("intro_message"),
    clientName: varchar("client_name", { length: 255 }),
    createdByOpenId: varchar("created_by_open_id", { length: 64 }).notNull(),
    createdByCompanyId: integer("created_by_company_id"),
    createdByApiKeyId: integer("created_by_api_key_id"),
    createdByName: varchar("created_by_name", { length: 255 }),
    createdByEmail: varchar("created_by_email", { length: 320 }),
    agentBranding: jsonb("agent_branding").notNull(),
    shareConfig: jsonb("share_config"),
    listingKeys: jsonb("listing_keys").notNull(), // string[]
    tourPlan: jsonb("tour_plan"), // { startTime, slotMinutes, travelMinutes, stops: [...] }
    externalListings: jsonb("external_listings"), // ExternalListing[]
    wechatShareConfig: jsonb("wechat_share_config"),
    // { title, description, thumbUrl, enabled } — WeChat JSSDK share card config
    expiresAt: timestamp("expires_at"),
    viewCount: integer("view_count").default(0).notNull(),
    lastViewedAt: timestamp("last_viewed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  table => [uniqueIndex("share_sessions_token_unique").on(table.token)]
);

/**
 * Engagement events for a share session (view/open/click/etc).
 */
export const shareSessionEvents = pgTable("share_session_events", {
  id: serial("id").primaryKey(),
  shareSessionId: integer("share_session_id").notNull(),
  eventType: varchar("event_type", { length: 50 }).notNull(),
  eventData: jsonb("event_data"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ============================================================
// AI-Native Tables — Neighborhoods, Deal Stories, Showing Feedback
// ============================================================

// NOTE: neighborhoods table has been moved to listing-data-service.

/**
 * Deal stories — completed transaction narratives.
 * Each closed deal is summarized into a searchable story for experience matching.
 * "Find me an agent who's done a deal like this" → vector similarity on narratives.
 */
export const dealStories = pgTable("deal_stories", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id"), // FK to agent_profiles.kevv_user_id (or BBO user id)
  companyId: integer("company_id"),
  // Deal basics
  listingKey: varchar("listing_key", { length: 255 }), // FK to properties if still in DB
  closedDate: timestamp("closed_date"),
  listPrice: varchar("list_price", { length: 20 }),
  closedPrice: varchar("closed_price", { length: 20 }),
  daysOnMarket: integer("days_on_market"),
  // Context
  city: varchar("city", { length: 100 }),
  stateOrProvince: varchar("state_or_province", { length: 50 }),
  propertyType: varchar("property_type", { length: 50 }),
  clientType: varchar("client_type", { length: 20 }), // "buyer" | "seller" | "dual"
  // Narrative (LLM-generated or agent-written)
  storyText: text("story_text"), // "Relocated Chinese family from NYC, $1.2M budget, Irvine school district..."
  keyTakeaways: jsonb("key_takeaways"), // string[]
  tags: jsonb("tags"), // string[] — e.g. ["relocation", "first-time-buyer", "investment", "mandarin"]
  // Vector embedding
  embedding: vector("embedding", { dimensions: 1536 }),
  embeddingModel: varchar("embedding_model", { length: 100 }),
  embeddingUpdatedAt: timestamp("embedding_updated_at"),
  // Meta
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/**
 * Showing feedback — per-visit client reactions.
 * Each record captures how a client reacted to a specific property showing.
 * Over time these accumulate to reveal true preferences vs. stated preferences.
 * Periodically aggregated back into client profile embeddings.
 */
export const showingFeedback = pgTable("showing_feedback", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id"), // FK to clients or client_profiles
  propertyId: integer("property_id"), // FK to properties
  listingKey: varchar("listing_key", { length: 255 }),
  agentId: integer("agent_id"),
  showingDate: timestamp("showing_date"),
  // Structured feedback
  overallRating: integer("overall_rating"), // 1-5
  wouldRevisit: boolean("would_revisit"),
  priceReaction: varchar("price_reaction", { length: 20 }), // "too_high" | "fair" | "good_deal"
  // Qualitative (agent notes or client comments)
  feedbackText: text("feedback_text"), // "Loved the floor plan but kitchen too small, HOA concerned her"
  liked: jsonb("liked"), // string[] — things they liked
  disliked: jsonb("disliked"), // string[] — things they didn't like
  // Vector embedding
  embedding: vector("embedding", { dimensions: 1536 }),
  embeddingModel: varchar("embedding_model", { length: 100 }),
  embeddingUpdatedAt: timestamp("embedding_updated_at"),
  // Meta
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Type exports for marketing tables
export type ShareSession = typeof shareSessions.$inferSelect;
export type InsertShareSession = typeof shareSessions.$inferInsert;
export type ShareSessionEvent = typeof shareSessionEvents.$inferSelect;
export type InsertShareSessionEvent = typeof shareSessionEvents.$inferInsert;
export type DealStory = typeof dealStories.$inferSelect;
export type InsertDealStory = typeof dealStories.$inferInsert;
export type ShowingFeedback = typeof showingFeedback.$inferSelect;
export type InsertShowingFeedback = typeof showingFeedback.$inferInsert;

/**
 * Showing tours — smart route-optimized property tours.
 * Agent inputs a set of properties → system optimizes driving route →
 * generates a branded PDF showing guide.
 */
export const showingTours = pgTable("showing_tours", {
  id: serial("id").primaryKey(),
  // Agent info
  agentName: varchar("agent_name", { length: 255 }),
  agentEmail: varchar("agent_email", { length: 255 }),
  agentPhone: varchar("agent_phone", { length: 50 }),
  agentLogoUrl: text("agent_logo_url"),
  // Client info
  clientName: varchar("client_name", { length: 255 }),
  clientEmail: varchar("client_email", { length: 255 }),
  // Tour details
  tourDate: timestamp("tour_date"),
  startAddress: text("start_address"), // Meeting point / first stop
  // Property IDs — ordered by optimized route
  propertyIds: jsonb("property_ids").$type<string[]>().notNull(), // listingKey[]
  // Route optimization result
  optimizedRoute: jsonb("optimized_route").$type<{
    optimizedOrder: number[];
    totalDistanceMeters: number;
    totalDurationSeconds: number;
    legs: Array<{
      fromIndex: number;
      toIndex: number;
      distanceText: string;
      durationText: string;
    }>;
  }>(),
  // Generated PDF
  pdfUrl: text("pdf_url"),
  // Status
  status: varchar("status", { length: 20 }).default("draft").notNull(), // draft | optimized | pdf_ready
  // Meta
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type ShowingTour = typeof showingTours.$inferSelect;
export type InsertShowingTour = typeof showingTours.$inferInsert;

// ============================================================
// Ad Engine Tables — Campaign management, creatives, performance
// ============================================================

/**
 * Ad campaigns — one per listing+agent.
 * Triggered manually or automatically when a listing goes live / price drops.
 */
export const adCampaigns = pgTable("ad_campaigns", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id"),
  listingKey: varchar("listing_key", { length: 255 }).notNull(),
  title: varchar("title", { length: 255 }),
  status: varchar("status", { length: 20 }).default("draft").notNull(),
  // draft | generating | active | paused | completed | failed
  platforms: jsonb("platforms").$type<string[]>().default([]).notNull(),
  // e.g. ["google","meta","wechat"]
  budgetDaily: varchar("budget_daily", { length: 20 }),
  budgetTotal: varchar("budget_total", { length: 20 }),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  triggerType: varchar("trigger_type", { length: 20 }).default("manual").notNull(),
  // manual | listing_new | listing_price_drop
  // Listing snapshot (cached from listing-data-service at creation)
  listingSnapshot: jsonb("listing_snapshot"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/**
 * Ad creatives — generated assets per campaign+platform.
 * Each campaign can have multiple creatives per platform and language.
 */
export const adCreatives = pgTable("ad_creatives", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").notNull(),
  platform: varchar("platform", { length: 20 }).notNull(),
  // google | meta | wechat | xiaohongshu
  language: varchar("language", { length: 10 }).default("en").notNull(),
  // en | zh | zh_en
  contentType: varchar("content_type", { length: 20 }).default("image_ad").notNull(),
  // image_ad | video_ad | carousel | text_post | article
  headline: varchar("headline", { length: 255 }),
  body: text("body"),
  ctaText: varchar("cta_text", { length: 100 }),
  imageUrls: jsonb("image_urls").$type<string[]>().default([]),
  videoUrl: text("video_url"),
  platformAdId: varchar("platform_ad_id", { length: 255 }),
  // external ID from Google/Meta after publishing
  status: varchar("status", { length: 20 }).default("draft").notNull(),
  // draft | approved | published | rejected | paused
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/**
 * Ad performance — daily metrics per creative.
 * Aggregated from platform APIs (Google/Meta reporting).
 */
export const adPerformance = pgTable("ad_performance", {
  id: serial("id").primaryKey(),
  creativeId: integer("creative_id").notNull(),
  campaignId: integer("campaign_id").notNull(),
  date: timestamp("date").notNull(),
  impressions: integer("impressions").default(0).notNull(),
  clicks: integer("clicks").default(0).notNull(),
  leads: integer("leads").default(0).notNull(),
  spend: varchar("spend", { length: 20 }),
  cpc: varchar("cpc", { length: 20 }),
  ctr: varchar("ctr", { length: 20 }),
  cpl: varchar("cpl", { length: 20 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Ad engine type exports
export type AdCampaign = typeof adCampaigns.$inferSelect;
export type InsertAdCampaign = typeof adCampaigns.$inferInsert;
export type AdCreative = typeof adCreatives.$inferSelect;
export type InsertAdCreative = typeof adCreatives.$inferInsert;
export type AdPerformance = typeof adPerformance.$inferSelect;
export type InsertAdPerformance = typeof adPerformance.$inferInsert;

// ============================================================
// Client Event Tracking — behavior events + engagement scoring
// ============================================================

/**
 * Client events — universal event log for all client interactions.
 * Feeds engagement scoring, drip triggers, and analytics.
 */
export const clientEvents = pgTable("client_events", {
  id: serial("id").primaryKey(),
  contactId: integer("contact_id"),
  agentId: integer("agent_id"),
  eventType: varchar("event_type", { length: 50 }).notNull(),
  // share_view | share_click | share_like | listing_view | listing_save
  // showing_booked | showing_feedback | form_submit | email_open | email_click
  // sms_reply | wechat_message | ad_click | ad_lead
  eventData: jsonb("event_data").$type<Record<string, unknown>>(),
  sourceType: varchar("source_type", { length: 30 }),
  // share_page | ad_campaign | drip_email | direct | wechat
  sourceId: varchar("source_id", { length: 255 }),
  sessionToken: varchar("session_token", { length: 255 }),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/**
 * Engagement scores — rolling score per contact.
 * Recalculated periodically from client_events.
 */
export const engagementScores = pgTable("engagement_scores", {
  id: serial("id").primaryKey(),
  contactId: integer("contact_id").notNull(),
  agentId: integer("agent_id"),
  score: integer("score").default(0).notNull(),
  factors: jsonb("factors").$type<Record<string, number>>(),
  // e.g. { share_views: 15, showing_booked: 50, email_opens: 10, ad_clicks: 5 }
  scoreModel: varchar("score_model", { length: 30 }).default("v1").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Tracking type exports
export type ClientEvent = typeof clientEvents.$inferSelect;
export type InsertClientEvent = typeof clientEvents.$inferInsert;
export type EngagementScore = typeof engagementScores.$inferSelect;
export type InsertEngagementScore = typeof engagementScores.$inferInsert;

// ============================================================
// Content Factory — templates, social posts, generated content
// ============================================================

/**
 * Content templates — reusable bilingual templates for emails/social/WeChat.
 */
export const contentTemplates = pgTable("content_templates", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id"),
  type: varchar("type", { length: 30 }).notNull(),
  // email | sms | wechat | social | market_report
  title: varchar("title", { length: 255 }).notNull(),
  contentZh: text("content_zh"),
  contentEn: text("content_en"),
  platform: varchar("platform", { length: 30 }),
  // instagram | facebook | wechat | xiaohongshu | linkedin | email
  variables: jsonb("variables").$type<string[]>(),
  // placeholders: ["agent_name", "listing_address", "listing_price"]
  isSystem: boolean("is_system").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/**
 * Social posts — scheduled and published social media content.
 */
export const socialPosts = pgTable("social_posts", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id"),
  platform: varchar("platform", { length: 30 }).notNull(),
  content: text("content").notNull(),
  contentZh: text("content_zh"),
  imageUrls: jsonb("image_urls").$type<string[]>().default([]),
  videoUrl: text("video_url"),
  hashtags: jsonb("hashtags").$type<string[]>().default([]),
  scheduledAt: timestamp("scheduled_at"),
  publishedAt: timestamp("published_at"),
  externalPostId: varchar("external_post_id", { length: 255 }),
  status: varchar("status", { length: 20 }).default("draft").notNull(),
  // draft | scheduled | published | failed
  listingKey: varchar("listing_key", { length: 255 }),
  templateId: integer("template_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/**
 * Generated content — AI-generated outputs tracked for audit/reuse.
 */
export const generatedContent = pgTable("generated_content", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id"),
  sourceType: varchar("source_type", { length: 30 }).notNull(),
  // listing | deal_story | market_data | open_house | manual
  sourceId: varchar("source_id", { length: 255 }),
  contentType: varchar("content_type", { length: 30 }).notNull(),
  // social_post | email | market_report | deal_story | ad_copy
  content: text("content").notNull(),
  language: varchar("language", { length: 10 }).default("en").notNull(),
  platform: varchar("platform", { length: 30 }),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Content factory type exports
export type ContentTemplate = typeof contentTemplates.$inferSelect;
export type InsertContentTemplate = typeof contentTemplates.$inferInsert;
export type SocialPost = typeof socialPosts.$inferSelect;
export type InsertSocialPost = typeof socialPosts.$inferInsert;
export type GeneratedContent = typeof generatedContent.$inferSelect;
export type InsertGeneratedContent = typeof generatedContent.$inferInsert;

// ============================================================
// Drip Campaign Engine — automated multi-step workflows
// ============================================================

/**
 * Drip campaigns — automated multi-step marketing sequences.
 * Triggered by client events or manual enrollment.
 */
export const dripCampaigns = pgTable("drip_campaigns", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id"),
  name: varchar("name", { length: 255 }).notNull(),
  triggerType: varchar("trigger_type", { length: 30 }).notNull(),
  // manual | share_view_count | listing_like | showing_booked | new_lead | price_drop
  triggerConfig: jsonb("trigger_config").$type<Record<string, unknown>>(),
  // e.g. { threshold: 3, listing_key: "abc123" }
  status: varchar("status", { length: 20 }).default("draft").notNull(),
  // draft | active | paused | completed
  totalEnrollments: integer("total_enrollments").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/**
 * Drip steps — ordered actions within a drip campaign.
 */
export const dripSteps = pgTable("drip_steps", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").notNull(),
  stepOrder: integer("step_order").notNull(),
  channel: varchar("channel", { length: 20 }).notNull(),
  // email | sms | wechat | in_app | wait
  templateId: integer("template_id"),
  subject: varchar("subject", { length: 255 }),
  content: text("content"),
  delayHours: integer("delay_hours").default(24).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/**
 * Drip enrollments — contacts progressing through drip campaigns.
 */
export const dripEnrollments = pgTable("drip_enrollments", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").notNull(),
  contactId: integer("contact_id").notNull(),
  currentStep: integer("current_step").default(0).notNull(),
  status: varchar("status", { length: 20 }).default("active").notNull(),
  // active | completed | paused | unsubscribed
  nextFireAt: timestamp("next_fire_at"),
  lastFiredAt: timestamp("last_fired_at"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Drip engine type exports
export type DripCampaign = typeof dripCampaigns.$inferSelect;
export type InsertDripCampaign = typeof dripCampaigns.$inferInsert;
export type DripStep = typeof dripSteps.$inferSelect;
export type InsertDripStep = typeof dripSteps.$inferInsert;
export type DripEnrollment = typeof dripEnrollments.$inferSelect;
export type InsertDripEnrollment = typeof dripEnrollments.$inferInsert;

// ============================================================
// Neighborhood Intelligence — Chinese livability scoring
// ============================================================

/**
 * Neighborhood scores — cached livability analysis per location.
 * Combines school ratings, Asian community density, Chinese POI proximity.
 */
export const neighborhoodScores = pgTable("neighborhood_scores", {
  id: serial("id").primaryKey(),
  listingKey: varchar("listing_key", { length: 255 }),
  zipCode: varchar("zip_code", { length: 10 }),
  lat: varchar("lat", { length: 20 }).notNull(),
  lng: varchar("lng", { length: 20 }).notNull(),
  overallScore: integer("overall_score").default(0).notNull(),
  schoolScore: integer("school_score").default(0),
  schoolData: jsonb("school_data").$type<{
    schools: Array<{ name: string; rating: number; distance: string; grades: string; type: string }>;
  }>(),
  communityScore: integer("community_score").default(0),
  communityData: jsonb("community_data").$type<{
    asianPct: number; totalPop: number; medianIncome: number;
  }>(),
  convenienceScore: integer("convenience_score").default(0),
  poiData: jsonb("poi_data").$type<{
    restaurants: number; supermarkets: number; schools: number;
    details: Array<{ name: string; type: string; distance: string; rating: number }>;
  }>(),
  commuteScore: integer("commute_score").default(0),
  commuteData: jsonb("commute_data").$type<Record<string, string>>(),
  // e.g. { "downtown": "25 min", "tech_hub": "40 min" }
  safetyScore: integer("safety_score").default(0),
  cachedAt: timestamp("cached_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
});

// ============================================================
// Agent Insights — behavior-aware AI follow-up suggestions
// ============================================================

/**
 * Agent insights — actionable suggestions generated from client behavior data.
 * Each insight tells the agent WHAT happened and WHAT to do next.
 */
export const agentInsights = pgTable("agent_insights", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id"),
  contactId: integer("contact_id"),
  insightType: varchar("insight_type", { length: 30 }).notNull(),
  // hot_lead | repeated_interest | price_opportunity | preference_match
  // follow_up_reminder | buy_signal | referral_opportunity
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  priority: varchar("priority", { length: 10 }).default("medium").notNull(),
  // urgent | high | medium | low
  suggestedAction: varchar("suggested_action", { length: 30 }),
  // contact_now | send_listing | send_price_alert | send_care_message | auto_drip
  actionData: jsonb("action_data").$type<Record<string, unknown>>(),
  // { listing_key, drip_campaign_id, message_template, ... }
  isRead: boolean("is_read").default(false).notNull(),
  isActioned: boolean("is_actioned").default(false).notNull(),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ============================================================
// CMA Reports — Comparative Market Analysis presentations
// ============================================================

/**
 * CMA reports — branded property valuation presentations.
 * Agent inputs a listing → system pulls comps → AI analyzes → generates PDF.
 */
export const cmaReports = pgTable("cma_reports", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id"),
  listingKey: varchar("listing_key", { length: 255 }),
  address: varchar("address", { length: 500 }),
  targetData: jsonb("target_data").$type<Record<string, unknown>>(),
  // target property snapshot
  compsData: jsonb("comps_data").$type<Array<Record<string, unknown>>>(),
  // comparable properties with adjustments
  aiAnalysis: text("ai_analysis"),
  // AI-generated market analysis narrative
  suggestedPriceLow: varchar("suggested_price_low", { length: 20 }),
  suggestedPriceHigh: varchar("suggested_price_high", { length: 20 }),
  marketTrends: jsonb("market_trends").$type<Record<string, unknown>>(),
  // { medianPrice, avgDOM, inventory, priceChangeYoY }
  branding: jsonb("branding").$type<Record<string, unknown>>(),
  // agent branding: logo, name, phone, colors
  pdfUrl: text("pdf_url"),
  status: varchar("status", { length: 20 }).default("draft").notNull(),
  // draft | generating | ready | failed
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Phase 4 type exports
export type NeighborhoodScore = typeof neighborhoodScores.$inferSelect;
export type InsertNeighborhoodScore = typeof neighborhoodScores.$inferInsert;
export type AgentInsight = typeof agentInsights.$inferSelect;
export type InsertAgentInsight = typeof agentInsights.$inferInsert;
export type CmaReport = typeof cmaReports.$inferSelect;
export type InsertCmaReport = typeof cmaReports.$inferInsert;

// ============================================================
// API Key Management (used by apiKeyAuth.ts)
// ============================================================

export const apiKeys = pgTable("api_keys", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  label: varchar("label", { length: 255 }),
  keyHash: varchar("key_hash", { length: 128 }).notNull().unique(),
  companyId: integer("company_id"),
  userId: integer("user_id"),
  isActive: boolean("is_active").default(true).notNull(),
  lastUsedAt: timestamp("last_used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const apiUsage = pgTable("api_usage", {
  id: serial("id").primaryKey(),
  apiKeyId: integer("api_key_id").notNull(),
  kevvUserId: integer("kevv_user_id"),
  companyId: integer("company_id"),
  endpoint: varchar("endpoint", { length: 255 }).notNull(),
  tokensUsed: integer("tokens_used").default(0),
  responseTimeMs: integer("response_time_ms"),
  success: boolean("success").default(true),
  errorMessage: text("error_message"),
  statusCode: integer("status_code"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ============================================================
// Video Jobs — persist video generation history
// ============================================================

/**
 * Video jobs — tracks each video generation request (local or cloud).
 * Lets agents revisit, re-download, and audit past video outputs.
 */
export const videoJobs = pgTable("video_jobs", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id"),
  listingKey: varchar("listing_key", { length: 255 }),
  title: varchar("title", { length: 255 }),
  provider: varchar("provider", { length: 20 }).notNull(),
  // "local" | "sora" | "jimeng"
  status: varchar("status", { length: 20 }).default("pending").notNull(),
  // pending | processing | completed | failed
  jobExternalId: varchar("job_external_id", { length: 255 }),
  // cloud provider job ID (null for local)
  prompt: text("prompt"),
  aspectRatio: varchar("aspect_ratio", { length: 10 }).default("9:16"),
  imageCount: integer("image_count").default(0),
  videoUrl: text("video_url"),
  thumbnailUrl: text("thumbnail_url"),
  durationSeconds: integer("duration_seconds"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

export type VideoJob = typeof videoJobs.$inferSelect;
export type InsertVideoJob = typeof videoJobs.$inferInsert;

// ============================================================
// Listing Subscriptions — automated new-listing alerts
// ============================================================

/**
 * Listing subscriptions — saved search criteria for automated alerts.
 * Agent creates on behalf of client → system matches new listings → notifies.
 */
export const listingSubscriptions = pgTable("listing_subscriptions", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id"),
  clientId: integer("client_id"),
  name: varchar("name", { length: 255 }),
  // Search criteria
  cities: jsonb("cities").$type<string[]>(),
  minPrice: varchar("min_price", { length: 20 }),
  maxPrice: varchar("max_price", { length: 20 }),
  minBeds: integer("min_beds"),
  maxBeds: integer("max_beds"),
  propertyTypes: jsonb("property_types").$type<string[]>(),
  keywords: text("keywords"),
  // Notification settings
  channel: varchar("channel", { length: 20 }).default("email").notNull(),
  // email | sms | wechat | in_app | web_push
  frequency: varchar("frequency", { length: 20 }).default("instant").notNull(),
  // instant | daily_digest | weekly_digest
  language: varchar("language", { length: 10 }).default("en"),
  // Status
  status: varchar("status", { length: 20 }).default("active").notNull(),
  // active | paused | expired
  lastNotifiedAt: timestamp("last_notified_at"),
  matchCount: integer("match_count").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/**
 * Subscription notifications — delivery log per matched listing.
 * Tracks sent/clicked status for engagement analytics.
 */
export const subscriptionNotifications = pgTable("subscription_notifications", {
  id: serial("id").primaryKey(),
  subscriptionId: integer("subscription_id").notNull(),
  listingKey: varchar("listing_key", { length: 255 }).notNull(),
  channel: varchar("channel", { length: 20 }).notNull(),
  status: varchar("status", { length: 20 }).default("pending").notNull(),
  // pending | sent | failed | clicked
  sentAt: timestamp("sent_at"),
  clickedAt: timestamp("clicked_at"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Subscription type exports
export type ListingSubscription = typeof listingSubscriptions.$inferSelect;
export type InsertListingSubscription = typeof listingSubscriptions.$inferInsert;
export type SubscriptionNotification = typeof subscriptionNotifications.$inferSelect;
export type InsertSubscriptionNotification = typeof subscriptionNotifications.$inferInsert;
