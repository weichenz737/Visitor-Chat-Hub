-- P4: session transfer history and ownership changes
CREATE TABLE IF NOT EXISTS session_transfers (
  id SERIAL PRIMARY KEY,
  session_id INTEGER NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  from_agent_id INTEGER NOT NULL REFERENCES agents(id),
  to_agent_id INTEGER NOT NULL REFERENCES agents(id),
  initiated_by INTEGER NOT NULL REFERENCES agents(id),
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS session_transfers_session_id_idx ON session_transfers(session_id);
CREATE INDEX IF NOT EXISTS session_transfers_from_agent_id_idx ON session_transfers(from_agent_id);
CREATE INDEX IF NOT EXISTS session_transfers_to_agent_id_idx ON session_transfers(to_agent_id);
CREATE INDEX IF NOT EXISTS session_transfers_created_at_idx ON session_transfers(created_at DESC);
