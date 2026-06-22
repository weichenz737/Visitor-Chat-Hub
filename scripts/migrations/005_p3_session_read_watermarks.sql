-- P3: session read watermarks (replace conversation_unread +1 model)

ALTER TABLE chat_sessions
  ADD COLUMN IF NOT EXISTS agent_last_read_msg_id INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS visitor_last_read_msg_id INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_message_id INTEGER NOT NULL DEFAULT 0;

UPDATE chat_sessions s
SET last_message_id = COALESCE(
  (SELECT MAX(m.id) FROM messages m WHERE m.session_id = s.id),
  0
);

UPDATE chat_sessions s
SET agent_last_read_msg_id = CASE
  WHEN EXISTS (
    SELECT 1 FROM messages m
    WHERE m.session_id = s.id AND m.sender_type = 'visitor' AND m.read_at IS NULL
  ) THEN COALESCE(
    (SELECT MAX(m.id) FROM messages m
     WHERE m.session_id = s.id AND m.sender_type = 'visitor' AND m.read_at IS NOT NULL),
    0
  )
  ELSE s.last_message_id
END;

UPDATE chat_sessions s
SET visitor_last_read_msg_id = CASE
  WHEN EXISTS (
    SELECT 1 FROM messages m
    WHERE m.session_id = s.id AND m.sender_type = 'agent' AND m.read_at IS NULL
  ) THEN COALESCE(
    (SELECT MAX(m.id) FROM messages m
     WHERE m.session_id = s.id AND m.sender_type = 'agent' AND m.read_at IS NOT NULL),
    0
  )
  ELSE s.last_message_id
END;

DROP TABLE IF EXISTS conversation_unread;
