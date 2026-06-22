-- P0: Permission system foundation + configurable transfer policy (used in P4)
-- Roles remain on agents.role: agent | super_admin

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO app_settings (key, value)
VALUES (
  'transfer.history_policy',
  '{"mode":"readonly_for_original_agent","description":"Original agent can read history but not send after transfer"}'::jsonb
)
ON CONFLICT (key) DO NOTHING;

-- Ensure upload directory structure (files created at runtime by LocalStorageProvider)
-- uploads/images/
-- uploads/files/
