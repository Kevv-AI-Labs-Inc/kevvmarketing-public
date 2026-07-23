DROP TABLE IF EXISTS "smart_match_feedback";
--> statement-breakpoint
DROP TABLE IF EXISTS "smart_match_sessions";
--> statement-breakpoint
DROP TABLE IF EXISTS "smart_match_results";
--> statement-breakpoint
DROP TABLE IF EXISTS "smart_match_runs";
--> statement-breakpoint
DROP TABLE IF EXISTS "buyer_profiles";
--> statement-breakpoint
DROP TABLE IF EXISTS "recommendationLogs";
--> statement-breakpoint
DROP TABLE IF EXISTS "clients";
--> statement-breakpoint
DROP TABLE IF EXISTS "showing_feedback";
--> statement-breakpoint
DROP TABLE IF EXISTS "cma_reports";
--> statement-breakpoint
DROP TABLE IF EXISTS "home_value_links";
--> statement-breakpoint
ALTER TABLE IF EXISTS "contacts" DROP COLUMN IF EXISTS "valuation_run_id";
--> statement-breakpoint
DROP TABLE IF EXISTS "valuation_runs";
--> statement-breakpoint
DROP TYPE IF EXISTS "home_value_link_source";
