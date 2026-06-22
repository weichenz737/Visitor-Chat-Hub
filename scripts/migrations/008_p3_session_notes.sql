-- P3: private session notes (one note per agent per session, for transfer history)
CREATE TABLE IF NOT EXISTS session_notes (
  id SERIAL PRIMARY KEY,
  session_id INTEGER NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  agent_id INTEGER NOT NULL REFERENCES agents(id),
  content TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS session_notes_session_agent_idx
  ON session_notes(session_id, agent_id);

CREATE INDEX IF NOT EXISTS session_notes_session_id_idx
  ON session_notes(session_id);
