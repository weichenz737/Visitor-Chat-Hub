-- P2: session-level unread counters for agent and visitor
CREATE TABLE IF NOT EXISTS conversation_unread (
  session_id INTEGER PRIMARY KEY REFERENCES chat_sessions(id) ON DELETE CASCADE,
  agent_unread_count INTEGER NOT NULL DEFAULT 0,
  visitor_unread_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Backfill counters from existing messages (read_at = read by recipient)
INSERT INTO conversation_unread (session_id, agent_unread_count, visitor_unread_count, updated_at)
SELECT
  s.id,
  COALESCE((
    SELECT count(*)::int FROM messages m
    WHERE m.session_id = s.id AND m.sender_type = 'visitor' AND m.read_at IS NULL
  ), 0),
  COALESCE((
    SELECT count(*)::int FROM messages m
    WHERE m.session_id = s.id AND m.sender_type = 'agent' AND m.read_at IS NULL
  ), 0),
  NOW()
FROM chat_sessions s
ON CONFLICT (session_id) DO NOTHING;
