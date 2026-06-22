-- P3: agent online presence for visitor header
ALTER TABLE agents ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS agents_last_seen_at_idx ON agents(last_seen_at);
