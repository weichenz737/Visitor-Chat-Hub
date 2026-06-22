import { db } from "@workspace/db";
import { sessionsTable } from "@workspace/db";
import { eq, inArray, sql } from "drizzle-orm";

export type SessionReadState = {
  sessionId: number;
  lastMessageId: number;
  agentLastReadMsgId: number;
  visitorLastReadMsgId: number;
  agentUnread: number;
  visitorUnread: number;
};

export function computeUnreadFromWatermarks(
  lastMessageId: number,
  agentLastReadMsgId: number,
  visitorLastReadMsgId: number,
): { agentUnread: number; visitorUnread: number } {
  return {
    agentUnread: Math.max(0, lastMessageId - agentLastReadMsgId),
    visitorUnread: Math.max(0, lastMessageId - visitorLastReadMsgId),
  };
}

function toReadState(row: {
  id: number;
  lastMessageId: number;
  agentLastReadMsgId: number;
  visitorLastReadMsgId: number;
}): SessionReadState {
  const { agentUnread, visitorUnread } = computeUnreadFromWatermarks(
    row.lastMessageId,
    row.agentLastReadMsgId,
    row.visitorLastReadMsgId,
  );
  return {
    sessionId: row.id,
    lastMessageId: row.lastMessageId,
    agentLastReadMsgId: row.agentLastReadMsgId,
    visitorLastReadMsgId: row.visitorLastReadMsgId,
    agentUnread,
    visitorUnread,
  };
}

export async function getSessionReadState(sessionId: number): Promise<SessionReadState | null> {
  const [row] = await db
    .select({
      id: sessionsTable.id,
      lastMessageId: sessionsTable.lastMessageId,
      agentLastReadMsgId: sessionsTable.agentLastReadMsgId,
      visitorLastReadMsgId: sessionsTable.visitorLastReadMsgId,
    })
    .from(sessionsTable)
    .where(eq(sessionsTable.id, sessionId));

  return row ? toReadState(row) : null;
}

export async function getSessionReadStates(sessionIds: number[]): Promise<Map<number, SessionReadState>> {
  if (sessionIds.length === 0) return new Map();

  const rows = await db
    .select({
      id: sessionsTable.id,
      lastMessageId: sessionsTable.lastMessageId,
      agentLastReadMsgId: sessionsTable.agentLastReadMsgId,
      visitorLastReadMsgId: sessionsTable.visitorLastReadMsgId,
    })
    .from(sessionsTable)
    .where(inArray(sessionsTable.id, sessionIds));

  const map = new Map<number, SessionReadState>();
  for (const row of rows) {
    map.set(row.id, toReadState(row));
  }
  return map;
}

/** New message saved — only advance last_message_id, then advance sender read cursor. */
export async function onMessageCreated(
  sessionId: number,
  messageId: number,
  senderType: "visitor" | "agent",
): Promise<SessionReadState> {
  const [row] = await db
    .update(sessionsTable)
    .set({ lastMessageId: messageId })
    .where(eq(sessionsTable.id, sessionId))
    .returning({
      id: sessionsTable.id,
      lastMessageId: sessionsTable.lastMessageId,
      agentLastReadMsgId: sessionsTable.agentLastReadMsgId,
      visitorLastReadMsgId: sessionsTable.visitorLastReadMsgId,
    });

  if (!row) {
    throw new Error(`Session ${sessionId} not found`);
  }

  if (senderType === "visitor") {
    return markVisitorReadSession(sessionId);
  }
  return markAgentReadSession(sessionId);
}

/** Agent opened session — read up to latest message. */
export async function markAgentReadSession(sessionId: number): Promise<SessionReadState> {
  const current = await getSessionReadState(sessionId);
  if (!current) {
    throw new Error(`Session ${sessionId} not found`);
  }

  const [row] = await db
    .update(sessionsTable)
    .set({ agentLastReadMsgId: current.lastMessageId })
    .where(eq(sessionsTable.id, sessionId))
    .returning({
      id: sessionsTable.id,
      lastMessageId: sessionsTable.lastMessageId,
      agentLastReadMsgId: sessionsTable.agentLastReadMsgId,
      visitorLastReadMsgId: sessionsTable.visitorLastReadMsgId,
    });

  return toReadState(row);
}

/** Visitor opened / focused session — read up to latest message. */
export async function markVisitorReadSession(sessionId: number): Promise<SessionReadState> {
  const current = await getSessionReadState(sessionId);
  if (!current) {
    throw new Error(`Session ${sessionId} not found`);
  }

  const [row] = await db
    .update(sessionsTable)
    .set({ visitorLastReadMsgId: current.lastMessageId })
    .where(eq(sessionsTable.id, sessionId))
    .returning({
      id: sessionsTable.id,
      lastMessageId: sessionsTable.lastMessageId,
      agentLastReadMsgId: sessionsTable.agentLastReadMsgId,
      visitorLastReadMsgId: sessionsTable.visitorLastReadMsgId,
    });

  return toReadState(row);
}

export async function sumAgentUnread(sessionIds: number[]): Promise<number> {
  if (sessionIds.length === 0) return 0;
  const [row] = await db
    .select({
      total: sql<number>`coalesce(sum(greatest(0, ${sessionsTable.lastMessageId} - ${sessionsTable.agentLastReadMsgId})), 0)::int`,
    })
    .from(sessionsTable)
    .where(inArray(sessionsTable.id, sessionIds));
  return row?.total ?? 0;
}
