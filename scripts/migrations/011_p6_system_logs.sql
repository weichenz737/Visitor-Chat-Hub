-- P6: system audit logs for super_admin
CREATE TABLE IF NOT EXISTS system_logs (
  id SERIAL PRIMARY KEY,
  actor_id INTEGER REFERENCES agents(id) ON DELETE SET NULL,
  actor_username TEXT,
  actor_role TEXT,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id INTEGER,
  detail TEXT,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS system_logs_created_at_idx ON system_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS system_logs_action_idx ON system_logs(action);
CREATE INDEX IF NOT EXISTS system_logs_actor_id_idx ON system_logs(actor_id);
