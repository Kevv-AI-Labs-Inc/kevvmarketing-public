-- Flyer Studio: flyers table
-- Phase 3: Persistent draft storage for marketing flyers

CREATE TABLE IF NOT EXISTS flyers (
  id SERIAL PRIMARY KEY,
  agent_id INTEGER NOT NULL,
  open_id VARCHAR(64) NOT NULL,
  title VARCHAR(255) NOT NULL,
  template_id VARCHAR(64) NOT NULL,
  size_key VARCHAR(32) NOT NULL DEFAULT 'letter',
  status VARCHAR(20) NOT NULL DEFAULT 'draft', -- draft | exported | shared
  flyer_data JSONB NOT NULL,
  thumbnail_url VARCHAR(1024),
  exported_url VARCHAR(1024),
  r2_key VARCHAR(512),
  share_token VARCHAR(64),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Index for agent listing pages
CREATE INDEX IF NOT EXISTS flyers_open_id_idx ON flyers (open_id);
CREATE INDEX IF NOT EXISTS flyers_agent_id_idx ON flyers (agent_id);
CREATE INDEX IF NOT EXISTS flyers_share_token_idx ON flyers (share_token);
