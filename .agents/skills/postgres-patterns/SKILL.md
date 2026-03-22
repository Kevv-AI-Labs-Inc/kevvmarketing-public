---
name: postgres-patterns
description: PostgreSQL patterns for the Kevv marketing-app. Index selection, query optimization, queue processing, and schema design for campaigns, events, and content tables.
---

# PostgreSQL Patterns — Marketing Database

Quick reference for PostgreSQL best practices in the marketing-app context. For listing data queries, use the listing-data-service API instead of direct DB access.

## When to Activate

- Designing new marketing tables (campaigns, events, content)
- Writing queries for analytics or reporting
- Troubleshooting slow queries
- Implementing background job queues (ad publishing, email sends)
- Adding indexes to existing tables

## Index Cheat Sheet

| Query Pattern | Index Type | Example |
|---|---|---|
| `WHERE col = value` | B-tree (default) | `CREATE INDEX idx ON campaigns (status)` |
| `WHERE col > value` | B-tree | `CREATE INDEX idx ON events (created_at)` |
| `WHERE a = x AND b > y` | Composite | `CREATE INDEX idx ON events (agent_id, created_at)` |
| `WHERE jsonb @> '{}'` | GIN | `CREATE INDEX idx ON content USING gin (metadata)` |
| Full-text search | GIN | `CREATE INDEX idx ON posts USING gin (search_vector)` |
| Time-series ranges | BRIN | `CREATE INDEX idx ON client_events USING brin (created_at)` |

### Marketing-Specific Index Patterns

```sql
-- Campaign lookup by agent + status (most common query)
CREATE INDEX idx_campaigns_agent_status
  ON ad_campaigns (agent_id, status, created_at DESC);

-- Active drip enrollments needing next step
CREATE INDEX idx_drip_active
  ON drip_enrollments (status, next_step_at)
  WHERE status = 'active';

-- Client events for engagement scoring (time-series, use BRIN)
CREATE INDEX idx_client_events_time
  ON client_events USING brin (created_at);

-- Share session token lookup (unique, already indexed by constraint)
-- No additional index needed if token has UNIQUE constraint

-- Content templates by agent + type
CREATE INDEX idx_templates_agent_type
  ON content_templates (agent_id, type);
```

## Data Types

| Use Case | Use | Avoid |
|---|---|---|
| IDs | `bigint` or `serial` | Random UUIDs (fragmentation) |
| Text content | `text` | `varchar(255)` (arbitrary limit) |
| Timestamps | `timestamptz` | `timestamp` (timezone bugs) |
| Money / prices | `numeric(12,2)` | `float` (precision loss) |
| Status flags | `varchar(20)` with CHECK | `boolean` (can't extend) |
| JSON metadata | `jsonb` | `json` (can't index) |
| Engagement scores | `numeric(5,2)` | `integer` (need decimals) |

## Queue Processing (Ad Publishing, Email, etc.)

Use `FOR UPDATE SKIP LOCKED` for concurrent job processing:

```sql
-- Worker picks next pending job without blocking others
UPDATE ad_publish_queue
SET status = 'processing', started_at = NOW()
WHERE id = (
  SELECT id FROM ad_publish_queue
  WHERE status = 'pending'
    AND scheduled_at <= NOW()
  ORDER BY scheduled_at
  LIMIT 1
  FOR UPDATE SKIP LOCKED
)
RETURNING *;
```

```sql
-- Drip campaign: find contacts needing next step
UPDATE drip_enrollments
SET status = 'sending', updated_at = NOW()
WHERE id IN (
  SELECT id FROM drip_enrollments
  WHERE status = 'active'
    AND next_step_at <= NOW()
  ORDER BY next_step_at
  LIMIT 50
  FOR UPDATE SKIP LOCKED
)
RETURNING *;
```

## Common Patterns

### Cursor Pagination (for events / analytics)
```sql
-- O(1) performance regardless of dataset size
SELECT * FROM client_events
WHERE id > $last_id
ORDER BY id ASC
LIMIT 20;
```

### Partial Index (only index what you query)
```sql
-- Only index active campaigns (much smaller than full table)
CREATE INDEX idx_active_campaigns
  ON ad_campaigns (agent_id, created_at DESC)
  WHERE status IN ('active', 'scheduled');
```

### Covering Index (avoid table lookup)
```sql
-- Dashboard query: list campaigns with just name and status
CREATE INDEX idx_campaign_dashboard
  ON ad_campaigns (agent_id, status)
  INCLUDE (title, created_at, budget);
```

### UPSERT (engagement scores)
```sql
INSERT INTO engagement_scores (contact_id, score, factors, updated_at)
VALUES ($1, $2, $3, NOW())
ON CONFLICT (contact_id)
DO UPDATE SET
  score = EXCLUDED.score,
  factors = EXCLUDED.factors,
  updated_at = NOW();
```

### Batch Insert (event tracking)
```sql
-- Batch insert client events (much faster than individual inserts)
INSERT INTO client_events (contact_id, event_type, event_data, created_at)
SELECT * FROM unnest(
  $1::int[],
  $2::varchar[],
  $3::jsonb[],
  $4::timestamptz[]
);
```

## Anti-Pattern Detection

```sql
-- Find unindexed foreign keys (causes slow JOINs)
SELECT conrelid::regclass, a.attname
FROM pg_constraint c
JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
WHERE c.contype = 'f'
  AND NOT EXISTS (
    SELECT 1 FROM pg_index i
    WHERE i.indrelid = c.conrelid AND a.attnum = ANY(i.indkey)
  );

-- Find slow queries
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
WHERE mean_exec_time > 100
ORDER BY mean_exec_time DESC
LIMIT 20;

-- Check table bloat (need VACUUM?)
SELECT relname, n_dead_tup, last_vacuum, last_autovacuum
FROM pg_stat_user_tables
WHERE n_dead_tup > 1000
ORDER BY n_dead_tup DESC;

-- Find missing indexes on frequently filtered columns
SELECT schemaname, relname, seq_scan, idx_scan
FROM pg_stat_user_tables
WHERE seq_scan > 1000 AND idx_scan < 100
ORDER BY seq_scan DESC;
```

## Schema Conventions for Marketing Tables

```sql
-- Standard table template
CREATE TABLE marketing_feature (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  agent_id    BIGINT NOT NULL,           -- FK to users/agents
  status      VARCHAR(20) NOT NULL DEFAULT 'draft',
  -- ... feature-specific columns ...
  metadata    JSONB,                     -- extensible metadata
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Always add: updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_updated_at
  BEFORE UPDATE ON marketing_feature
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```
