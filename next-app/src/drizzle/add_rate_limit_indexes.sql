-- Rate limiting indexes for public endpoint protection
-- Added by codex/security-cleanup branch

-- Composite index for assertPublicEventRateLimit queries
-- Covers: ip_address + event_type + source_type + source_id + created_at
CREATE INDEX IF NOT EXISTS idx_client_events_ratelimit
  ON client_events (ip_address, event_type, source_type, source_id, created_at);

-- Index for magic-link IP-based rate limiting
CREATE INDEX IF NOT EXISTS idx_magic_links_request_ip_created
  ON magic_links ("requestIp", "createdAt");

-- Index for magic-link email cooldown check
CREATE INDEX IF NOT EXISTS idx_magic_links_email_created
  ON magic_links (email, "createdAt");

-- Add requestIp column if it doesn't exist yet
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'magic_links' AND column_name = 'requestIp'
  ) THEN
    ALTER TABLE magic_links ADD COLUMN "requestIp" varchar(45);
  END IF;
END $$;
