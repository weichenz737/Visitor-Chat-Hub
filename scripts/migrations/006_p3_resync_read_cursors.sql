-- P3 fix: resync session message cursors from messages table
UPDATE chat_sessions s
SET last_message_id = COALESCE(
  (SELECT MAX(m.id) FROM messages m WHERE m.session_id = s.id),
  0
);

-- Clamp read cursors to last_message_id (never exceed latest)
UPDATE chat_sessions
SET
  agent_last_read_msg_id = LEAST(agent_last_read_msg_id, last_message_id),
  visitor_last_read_msg_id = LEAST(visitor_last_read_msg_id, last_message_id);
