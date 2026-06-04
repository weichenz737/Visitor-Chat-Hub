import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { sessionsTable, messagesTable } from "@workspace/db";
import { eq, sql, and, isNull, desc } from "drizzle-orm";
import {
  CreateSessionBody,
  GetSessionParams,
  GetSessionMessagesParams,
  MarkSessionReadParams,
} from "@workspace/api-zod";
import { getOnlineSessionIds, broadcastReadReceiptToSession } from "../lib/websocket";

const router: IRouter = Router();

const ONE_MINUTE_MS = 60 * 1000;

function isActiveWithinOneMinute(lastSeenAt: Date | null): boolean {
  if (!lastSeenAt) return false;
  return Date.now() - new Date(lastSeenAt).getTime() < ONE_MINUTE_MS;
}

router.post("/sessions", async (req, res): Promise<void> => {
  const parsed = CreateSessionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [session] = await db
    .insert(sessionsTable)
    .values({ visitorNickname: parsed.data.visitorNickname })
    .returning();

  res.status(201).json(session);
});

router.get("/sessions", async (req, res): Promise<void> => {
  const sessions = await db
    .select()
    .from(sessionsTable)
    .orderBy(desc(sessionsTable.createdAt));

  const onlineIds = getOnlineSessionIds();

  const sessionIds = sessions.map((s) => s.id);
  const unreadCounts = sessionIds.length
    ? await db
        .select({
          sessionId: messagesTable.sessionId,
          count: sql<number>`count(*)::int`,
        })
        .from(messagesTable)
        .where(
          and(
            sql`${messagesTable.sessionId} = ANY(ARRAY[${sql.join(sessionIds.map((id) => sql`${id}`), sql`, `)}]::int[])`,
            eq(messagesTable.senderType, "visitor"),
            isNull(messagesTable.readAt)
          )
        )
        .groupBy(messagesTable.sessionId)
    : [];

  const lastMessages = sessionIds.length
    ? await db
        .select({
          sessionId: messagesTable.sessionId,
          content: messagesTable.content,
          createdAt: messagesTable.createdAt,
        })
        .from(messagesTable)
        .where(
          sql`${messagesTable.sessionId} = ANY(ARRAY[${sql.join(sessionIds.map((id) => sql`${id}`), sql`, `)}]::int[])`
        )
        .orderBy(desc(messagesTable.createdAt))
    : [];

  const unreadMap = new Map(unreadCounts.map((u) => [u.sessionId, u.count]));
  const lastMsgMap = new Map<number, { content: string; createdAt: Date }>();
  for (const lm of lastMessages) {
    if (!lastMsgMap.has(lm.sessionId)) {
      lastMsgMap.set(lm.sessionId, { content: lm.content, createdAt: lm.createdAt });
    }
  }

  const result = sessions.map((s) => ({
    id: s.id,
    visitorNickname: s.visitorNickname,
    status: s.status,
    createdAt: s.createdAt,
    lastSeenAt: s.lastSeenAt,
    agentId: s.agentId,
    unreadCount: unreadMap.get(s.id) ?? 0,
    // Online = WS currently connected OR lastSeenAt within 1 minute
    isOnline: onlineIds.has(s.id) || isActiveWithinOneMinute(s.lastSeenAt),
    lastMessage: lastMsgMap.get(s.id)?.content ?? null,
    lastMessageAt: lastMsgMap.get(s.id)?.createdAt ?? null,
  }));

  res.json(result);
});

router.get("/sessions/stats", async (_req, res): Promise<void> => {
  const onlineIds = getOnlineSessionIds();

  const allSessions = await db
    .select({ id: sessionsTable.id, status: sessionsTable.status, lastSeenAt: sessionsTable.lastSeenAt })
    .from(sessionsTable);

  const total = allSessions.length;
  const online = allSessions.filter(
    (s) => onlineIds.has(s.id) || isActiveWithinOneMinute(s.lastSeenAt)
  ).length;
  const waiting = allSessions.filter((s) => s.status === "waiting").length;
  const active = allSessions.filter((s) => s.status === "active").length;

  const [unreadRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(messagesTable)
    .where(and(eq(messagesTable.senderType, "visitor"), isNull(messagesTable.readAt)));

  res.json({
    total,
    online,
    waiting,
    active,
    unreadTotal: unreadRow?.count ?? 0,
  });
});

router.get("/sessions/:id", async (req, res): Promise<void> => {
  const params = GetSessionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [session] = await db
    .select()
    .from(sessionsTable)
    .where(eq(sessionsTable.id, params.data.id));

  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  res.json(session);
});

router.get("/sessions/:id/messages", async (req, res): Promise<void> => {
  const params = GetSessionMessagesParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const messages = await db
    .select()
    .from(messagesTable)
    .where(eq(messagesTable.sessionId, params.data.id))
    .orderBy(messagesTable.createdAt);

  res.json(messages);
});

router.post("/sessions/:id/read", async (req, res): Promise<void> => {
  const params = MarkSessionReadParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const now = new Date();
  const result = await db
    .update(messagesTable)
    .set({ readAt: now })
    .where(
      and(
        eq(messagesTable.sessionId, params.data.id),
        eq(messagesTable.senderType, "visitor"),
        isNull(messagesTable.readAt)
      )
    )
    .returning();

  // Notify visitor their messages were read
  if (result.length > 0) {
    broadcastReadReceiptToSession(params.data.id, now.toISOString());
  }

  res.json({ count: result.length });
});

export default router;
