import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { sessionsTable, messagesTable } from "@workspace/db";
import { eq, sql, and, isNull, desc } from "drizzle-orm";
import {
  CreateSessionBody,
  GetSessionParams,
  GetSessionMessagesParams,
  MarkSessionReadParams,
  VisitorResumeSessionQueryParams,
} from "@workspace/api-zod";
import { getOnlineSessionIds, broadcastReadReceiptToSession } from "../lib/websocket";
import { requireAuth } from "../lib/middleware";

const router: IRouter = Router();

const ONE_MINUTE_MS = 60 * 1000;

function isActiveWithinOneMinute(lastSeenAt: Date | null): boolean {
  if (!lastSeenAt) return false;
  return Date.now() - new Date(lastSeenAt).getTime() < ONE_MINUTE_MS;
}

// Public: visitor creates a session
router.post("/sessions", async (req, res): Promise<void> => {
  const parsed = CreateSessionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [session] = await db
    .insert(sessionsTable)
    .values({
      visitorNickname: parsed.data.visitorNickname,
      agentId: parsed.data.agentId ?? undefined,
      visitorId: parsed.data.visitorId ?? undefined,
    })
    .returning();

  res.status(201).json(session);
});

// Public: visitor resumes an existing session
// Must be before /sessions/:id to avoid route conflict
router.get("/sessions/visitor-resume", async (req, res): Promise<void> => {
  const parsed = VisitorResumeSessionQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { visitorId, agentId } = parsed.data;

  const [session] = await db
    .select()
    .from(sessionsTable)
    .where(
      and(
        eq(sessionsTable.visitorId, visitorId),
        eq(sessionsTable.agentId, agentId)
      )
    )
    .orderBy(desc(sessionsTable.createdAt))
    .limit(1);

  if (!session) {
    res.status(404).json({ error: "No existing session" });
    return;
  }

  res.json(session);
});

// Agent: list sessions (filtered by ownership for non-super_admin)
router.get("/sessions", async (req, res): Promise<void> => {
  const payload = requireAuth(req, res);
  if (!payload) return;

  const ownerFilter =
    payload.role !== "super_admin"
      ? eq(sessionsTable.agentId, payload.userId)
      : undefined;

  const sessions = await db
    .select()
    .from(sessionsTable)
    .where(ownerFilter)
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
    isOnline: onlineIds.has(s.id) || isActiveWithinOneMinute(s.lastSeenAt),
    lastMessage: lastMsgMap.get(s.id)?.content ?? null,
    lastMessageAt: lastMsgMap.get(s.id)?.createdAt ?? null,
  }));

  res.json(result);
});

// Agent: session stats (filtered by ownership for non-super_admin)
router.get("/sessions/stats", async (req, res): Promise<void> => {
  const payload = requireAuth(req, res);
  if (!payload) return;

  const ownerFilter =
    payload.role !== "super_admin"
      ? eq(sessionsTable.agentId, payload.userId)
      : undefined;

  const onlineIds = getOnlineSessionIds();

  const allSessions = await db
    .select({ id: sessionsTable.id, status: sessionsTable.status, lastSeenAt: sessionsTable.lastSeenAt })
    .from(sessionsTable)
    .where(ownerFilter);

  const total = allSessions.length;
  const online = allSessions.filter(
    (s) => onlineIds.has(s.id) || isActiveWithinOneMinute(s.lastSeenAt)
  ).length;
  const waiting = allSessions.filter((s) => s.status === "waiting").length;
  const active = allSessions.filter((s) => s.status === "active").length;

  const sessionIds = allSessions.map((s) => s.id);
  const [unreadRow] = sessionIds.length
    ? await db
        .select({ count: sql<number>`count(*)::int` })
        .from(messagesTable)
        .where(
          and(
            sql`${messagesTable.sessionId} = ANY(ARRAY[${sql.join(sessionIds.map((id) => sql`${id}`), sql`, `)}]::int[])`,
            eq(messagesTable.senderType, "visitor"),
            isNull(messagesTable.readAt)
          )
        )
    : [{ count: 0 }];

  res.json({
    total,
    online,
    waiting,
    active,
    unreadTotal: unreadRow?.count ?? 0,
  });
});

// Agent: get session by ID (ownership check)
router.get("/sessions/:id", async (req, res): Promise<void> => {
  const payload = requireAuth(req, res);
  if (!payload) return;

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

  if (payload.role !== "super_admin" && session.agentId !== payload.userId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  res.json(session);
});

// Agent: get messages for a session (ownership check)
router.get("/sessions/:id/messages", async (req, res): Promise<void> => {
  const payload = requireAuth(req, res);
  if (!payload) return;

  const params = GetSessionMessagesParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  // Verify session ownership
  const [session] = await db
    .select({ agentId: sessionsTable.agentId })
    .from(sessionsTable)
    .where(eq(sessionsTable.id, params.data.id));

  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  if (payload.role !== "super_admin" && session.agentId !== payload.userId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const messages = await db
    .select()
    .from(messagesTable)
    .where(eq(messagesTable.sessionId, params.data.id))
    .orderBy(messagesTable.createdAt);

  res.json(messages);
});

// Agent: mark session messages as read (ownership check)
router.post("/sessions/:id/read", async (req, res): Promise<void> => {
  const payload = requireAuth(req, res);
  if (!payload) return;

  const params = MarkSessionReadParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  // Verify session ownership
  const [session] = await db
    .select({ agentId: sessionsTable.agentId })
    .from(sessionsTable)
    .where(eq(sessionsTable.id, params.data.id));

  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  if (payload.role !== "super_admin" && session.agentId !== payload.userId) {
    res.status(403).json({ error: "Forbidden" });
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

  if (result.length > 0) {
    broadcastReadReceiptToSession(params.data.id, now.toISOString());
  }

  res.json({ count: result.length });
});

export default router;
