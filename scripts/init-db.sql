CREATE TABLE IF NOT EXISTS agents (
  id SERIAL PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'agent',
  display_name TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  introduction TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS agents_last_seen_at_idx ON agents (last_seen_at);

CREATE TABLE IF NOT EXISTS chat_sessions (
  id SERIAL PRIMARY KEY,
  visitor_id TEXT,
  visitor_nickname TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'waiting',
  agent_id INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS sessions_agent_id_idx ON chat_sessions (agent_id);

CREATE TABLE IF NOT EXISTS messages (
  id SERIAL PRIMARY KEY,
  session_id INTEGER NOT NULL,
  owner_id INTEGER,
  sender_type TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'text',
  content TEXT NOT NULL,
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS messages_owner_id_idx ON messages (owner_id);
