import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { sessionsTable, messagesTable, agentsTable } from "@workspace/db";
import { eq, sql, and, desc, or, inArray } from "drizzle-orm";
import {
  CreateSessionBody,
  GetSessionParams,
  GetSessionMessagesParams,
  GetSessionMessagesQueryParams,
  MarkSessionReadParams,
  MarkSessionVisitorReadParams,
  GetSessionUnreadParams,
  GetSessionUnreadQueryParams,
  MarkSessionVisitorReadBody,
  VisitorResumeSessionQueryParams,
  GetSessionNotesParams,
  PutSessionNotesParams,
  PutSessionNotesBody,
  TransferSessionParams,
  TransferSessionBody,
  GetSessionTransfersParams,
} from "@workspace/api-zod";
import {
  getSessionReadState,
  getSessionReadStates,
  markAgentReadSession,
  markVisitorReadSession,
  sumAgentUnread,
} from "../lib/session-read";
import { requireAuth } from "../lib/middleware";
import { isSuperAdmin } from "../lib/permissions";
import { findAssignableAgent } from "../lib/agents";
import { broadcastReadState } from "../lib/websocket";
import { getSessionNotesForUser, upsertSessionNote, getHasNoteBySessionIds } from "../lib/session-notes";
import {
  getFormerSessionIdsForAgent,
  resolveAgentSessionAccess,
  getTransferHistoryPolicyMode,
  type AgentSessionAccess,
} from "../lib/session-access";
import { transferSession, listSessionTransfers } from "../lib/session-transfers";
import type { AgentPayload } from "../lib/auth";
import type { Request, Response } from "express";

const router: IRouter = Router();

const ONE_MINUTE_MS = 60 * 1000;

function parseOptionalAgentIdFilter(query: Record<string, unknown>): number | undefined {
  const raw = query.agentId;
  if (raw == null || raw === "") return undefined;
  const id = Number(Array.isArray(raw) ? raw[0] : raw);
  return Number.isInteger(id) && id > 0 ? id : undefined;
}

function isActiveWithinOneMinute(lastSeenAt: Date | null): boolean {
  if (!lastSeenAt) return false;
  return Date.now() - new Date(lastSeenAt).getTime() < ONE_MINUTE_MS;
}

async function validateVisitorSession(
  sessionId: number,
  visitorId: string | undefined,
): Promise<{ ok: true; agentId: number | null } | { ok: false; status: number; error: string }> {
  const [session] = await db
    .select({ visitorId: sessionsTable.visitorId, agentId: sessionsTable.agentId })
    .from(sessionsTable)
    .where(eq(sessionsTable.id, sessionId));

  if (!session) {
    return { ok: false, status: 404, error: "Session not found" };
  }

  if (visitorId && session.visitorId && session.visitorId !== visitorId) {
    return { ok: false, status: 403, error: "Forbidden" };
  }

  return { ok: true, agentId: session.agentId };
}

async function requireSessionRead(
  req: Request,
  res: Response,
  sessionId: number,
): Promise<{ payload: AgentPayload; sessionAgentId: number | null; access: AgentSessionAccess } | null> {
  const payload = requireAuth(req, res);
  if (!payload) return null;

  const [session] = await db
    .select({ agentId: sessionsTable.agentId })
    .from(sessionsTable)
    .where(eq(sessionsTable.id, sessionId));

  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return null;
  }

  const access = await resolveAgentSessionAccess(
    sessionId,
    payload.userId,
    payload.role,
    session.agentId,
  );

  if (!access.canRead) {
    res.status(403).json({ error: "Forbidden" });
    return null;
  }

  return { payload, sessionAgentId: session.agentId, access };
}

function buildAgentSessionVisibility(userId: number, formerSessionIds: number[]) {
  if (formerSessionIds.length === 0) {
    return eq(sessionsTable.agentId, userId);
  }
  return or(eq(sessionsTable.agentId, userId), inArray(sessionsTable.id, formerSessionIds));
}

async function mapSessionSummaries(
  sessions: Array<{
    id: number;
    visitorNickname: string;
    status: string;
    createdAt: Date;
    lastSeenAt: Date | null;
    agentId: number | null;
    agentDisplayName: string | null;
    agentAvatarUrl: string | null;
    agentIsActive: boolean | null;
  }>,
  viewerId: number,
  isAdmin: boolean,
  formerSessionIdSet: Set<number>,
) {
  const sessionIds = sessions.map((s) => s.id);
  const readMap = await getSessionReadStates(sessionIds);
  const sessionAgentById = new Map(sessions.map((s) => [s.id, s.agentId]));
  const hasNoteMap = await getHasNoteBySessionIds(
    sessionIds,
    viewerId,
    isAdmin,
    sessionAgentById,
  );

  const lastMessages = sessionIds.length
    ? await db
        .select({
          sessionId: messagesTable.sessionId,
          content: messagesTable.content,
          createdAt: messagesTable.createdAt,
        })
        .from(messagesTable)
        .where(
          sql`${messagesTable.sessionId} = ANY(ARRAY[${sql.join(sessionIds.map((id) => sql`${id}`), sql`, `)}]::int[])`,
        )
        .orderBy(desc(messagesTable.createdAt))
    : [];

  const lastMsgMap = new Map<number, { content: string; createdAt: Date }>();
  for (const lm of lastMessages) {
    if (!lastMsgMap.has(lm.sessionId)) {
      lastMsgMap.set(lm.sessionId, { content: lm.content, createdAt: lm.createdAt });
    }
  }

  return sessions.map((s) => {
    const read = readMap.get(s.id);
    const isOwner = s.agentId === viewerId;
    const isReadonlyFormer = !isOwner && formerSessionIdSet.has(s.id);
    const agentAccess = isReadonlyFormer ? "readonly" : isOwner ? "owner" : isAdmin ? "super_admin" : "owner";

    return {
      id: s.id,
      visitorNickname: s.visitorNickname,
      status: s.status,
      createdAt: s.createdAt,
      lastSeenAt: s.lastSeenAt,
      agentId: s.agentId,
      agentDisplayName: s.agentDisplayName ?? null,
      agentAvatarUrl: s.agentAvatarUrl ?? null,
      agentIsActive: s.agentIsActive ?? null,
      unreadCount: isReadonlyFormer ? 0 : (read?.agentUnread ?? 0),
      isOnline: isActiveWithinOneMinute(s.lastSeenAt),
      lastMessage: lastMsgMap.get(s.id)?.content ?? null,
      lastMessageAt: lastMsgMap.get(s.id)?.createdAt ?? null,
      lastMessageId: read?.lastMessageId ?? 0,
      visitorLastReadMsgId: read?.visitorLastReadMsgId ?? 0,
      hasNote: hasNoteMap.get(s.id) ?? false,
      agentAccess,
    };
  });
}

// Public: visitor creates a session (must bind to a reception agent)
router.post("/sessions", async (req, res): Promise<void> => {
  const parsed = CreateSessionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  if (parsed.data.agentId == null) {
    res.status(400).json({ error: "agentId is required" });
    return;
  }

  const agent = await findAssignableAgent(parsed.data.agentId);
  if (!agent) {
    res.status(400).json({ error: "Invalid or unavailable agent" });
    return;
  }

  if (parsed.data.visitorId) {
    const [existing] = await db
      .select()
      .from(sessionsTable)
      .where(
        and(
          eq(sessionsTable.visitorId, parsed.data.visitorId),
          eq(sessionsTable.agentId, parsed.data.agentId),
        ),
      )
      .orderBy(desc(sessionsTable.createdAt))
      .limit(1);

    if (existing) {
      res.status(200).json(existing);
      return;
    }
  }

  const [session] = await db
    .insert(sessionsTable)
    .values({
      visitorNickname: parsed.data.visitorNickname,
      agentId: parsed.data.agentId,
      visitorId: parsed.data.visitorId ?? undefined,
      status: "active",
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

  const agent = await findAssignableAgent(agentId);
  if (!agent) {
    res.status(404).json({ error: "No existing session" });
    return;
  }

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

  const filterAgentId = parseOptionalAgentIdFilter(req.query as Record<string, unknown>);

  const conditions = [];
  let formerSessionIds: number[] = [];

  if (!isSuperAdmin(payload.role)) {
    formerSessionIds = await getFormerSessionIdsForAgent(payload.userId);
    if ((await getTransferHistoryPolicyMode()) === "hidden") {
      formerSessionIds = [];
    }
    conditions.push(buildAgentSessionVisibility(payload.userId, formerSessionIds));
  } else if (filterAgentId != null) {
    conditions.push(eq(sessionsTable.agentId, filterAgentId));
  }

  const whereClause = conditions.length ? and(...conditions) : undefined;
  const formerSessionIdSet = new Set(formerSessionIds);

  const sessions = await db
    .select({
      id: sessionsTable.id,
      visitorNickname: sessionsTable.visitorNickname,
      status: sessionsTable.status,
      createdAt: sessionsTable.createdAt,
      lastSeenAt: sessionsTable.lastSeenAt,
      agentId: sessionsTable.agentId,
      agentDisplayName: agentsTable.displayName,
      agentAvatarUrl: agentsTable.avatarUrl,
      agentIsActive: agentsTable.isActive,
    })
    .from(sessionsTable)
    .leftJoin(agentsTable, eq(sessionsTable.agentId, agentsTable.id))
    .where(whereClause)
    .orderBy(desc(sessionsTable.createdAt));

  const result = await mapSessionSummaries(
    sessions,
    payload.userId,
    isSuperAdmin(payload.role),
    formerSessionIdSet,
  );

  res.json(result);
});

// Agent: session stats (filtered by ownership for non-super_admin)
router.get("/sessions/stats", async (req, res): Promise<void> => {
  const payload = requireAuth(req, res);
  if (!payload) return;

  const filterAgentId = parseOptionalAgentIdFilter(req.query as Record<string, unknown>);

  const conditions = [];
  if (!isSuperAdmin(payload.role)) {
    const formerSessionIds = await getFormerSessionIdsForAgent(payload.userId);
    const visibleFormerIds =
      (await getTransferHistoryPolicyMode()) === "hidden" ? [] : formerSessionIds;
    conditions.push(buildAgentSessionVisibility(payload.userId, visibleFormerIds));
  } else if (filterAgentId != null) {
    conditions.push(eq(sessionsTable.agentId, filterAgentId));
  }

  const whereClause = conditions.length ? and(...conditions) : undefined;

  const allSessions = await db
    .select({ id: sessionsTable.id, status: sessionsTable.status, lastSeenAt: sessionsTable.lastSeenAt })
    .from(sessionsTable)
    .where(whereClause);

  const total = allSessions.length;
  const online = allSessions.filter((s) => isActiveWithinOneMinute(s.lastSeenAt)).length;
  const waiting = allSessions.filter((s) => s.status === "waiting").length;
  const active = allSessions.filter((s) => s.status === "active").length;

  const sessionIds = allSessions.map((s) => s.id);
  const formerSet = new Set(
    isSuperAdmin(payload.role)
      ? []
      : (await getTransferHistoryPolicyMode()) === "hidden"
        ? []
        : await getFormerSessionIdsForAgent(payload.userId),
  );
  const unreadSessionIds = isSuperAdmin(payload.role)
    ? sessionIds
    : allSessions.filter((s) => !formerSet.has(s.id)).map((s) => s.id);
  const unreadTotal = await sumAgentUnread(unreadSessionIds);

  res.json({
    total,
    online,
    waiting,
    active,
    unreadTotal,
  });
});

// Public/agent: unread counts for a session
router.get("/sessions/:id/unread", async (req, res): Promise<void> => {
  const params = GetSessionUnreadParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const query = GetSessionUnreadQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const sessionId = params.data.id;
  const visitorId = query.data.visitorId;

  if (visitorId) {
    const check = await validateVisitorSession(sessionId, visitorId);
    if (!check.ok) {
      res.status(check.status).json({ error: check.error });
      return;
    }
  } else {
    const readAccess = await requireSessionRead(req, res, sessionId);
    if (!readAccess) return;
  }

  const unread = await getSessionReadState(sessionId);
  if (!unread) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  res.json(unread);
});

// Agent: get session by ID (read access includes former owner readonly)
router.get("/sessions/:id", async (req, res): Promise<void> => {
  const params = GetSessionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const readAccess = await requireSessionRead(req, res, params.data.id);
  if (!readAccess) return;

  const [session] = await db
    .select()
    .from(sessionsTable)
    .where(eq(sessionsTable.id, params.data.id));

  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  res.json({
    ...session,
    agentAccess: readAccess.access.accessMode === "readonly" ? "readonly" : readAccess.access.accessMode === "super_admin" && session.agentId !== readAccess.payload.userId ? "super_admin" : "owner",
  });
});

// Agent or visitor: get messages for a session (visitor passes ?visitorId=)
router.get("/sessions/:id/messages", async (req, res): Promise<void> => {
  const params = GetSessionMessagesParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const query = GetSessionMessagesQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const sessionId = params.data.id;
  const visitorId = query.data.visitorId;

  if (visitorId) {
    const check = await validateVisitorSession(sessionId, visitorId);
    if (!check.ok) {
      res.status(check.status).json({ error: check.error });
      return;
    }
  } else {
    const readAccess = await requireSessionRead(req, res, sessionId);
    if (!readAccess) return;
  }

  const messages = await db
    .select()
    .from(messagesTable)
    .where(eq(messagesTable.sessionId, sessionId))
    .orderBy(messagesTable.createdAt);

  res.json(messages);
});

// Agent: mark session messages as read (current owner or super_admin only)
router.post("/sessions/:id/read", async (req, res): Promise<void> => {
  const params = MarkSessionReadParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const readAccess = await requireSessionRead(req, res, params.data.id);
  if (!readAccess) return;

  if (!readAccess.access.canReply) {
    res.status(403).json({ error: "Cannot mark read on a read-only session" });
    return;
  }

  const readState = await markAgentReadSession(params.data.id);
  broadcastReadState(params.data.id, readState, readAccess.sessionAgentId ?? 0);

  res.json({
    count: readState.agentUnread === 0 ? 1 : 0,
    agentUnread: readState.agentUnread,
    visitorUnread: readState.visitorUnread,
    lastMessageId: readState.lastMessageId,
    agentLastReadMsgId: readState.agentLastReadMsgId,
    visitorLastReadMsgId: readState.visitorLastReadMsgId,
  });
});

// Public: visitor marks agent messages as read
router.post("/sessions/:id/visitor-read", async (req, res): Promise<void> => {
  const params = MarkSessionVisitorReadParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = MarkSessionVisitorReadBody.safeParse(req.body ?? {});
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const check = await validateVisitorSession(params.data.id, body.data.visitorId);
  if (!check.ok) {
    res.status(check.status).json({ error: check.error });
    return;
  }

  const readState = await markVisitorReadSession(params.data.id);
  broadcastReadState(params.data.id, readState, check.agentId ?? 0);

  res.json({
    count: readState.visitorUnread === 0 ? 1 : 0,
    agentUnread: readState.agentUnread,
    visitorUnread: readState.visitorUnread,
    lastMessageId: readState.lastMessageId,
    agentLastReadMsgId: readState.agentLastReadMsgId,
    visitorLastReadMsgId: readState.visitorLastReadMsgId,
  });
});

// Agent: get private session notes (super_admin sees all notes on session)
router.get("/sessions/:id/notes", async (req, res): Promise<void> => {
  const params = GetSessionNotesParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const readAccess = await requireSessionRead(req, res, params.data.id);
  if (!readAccess) return;

  const notes = await getSessionNotesForUser(
    params.data.id,
    readAccess.payload.userId,
    readAccess.sessionAgentId,
    isSuperAdmin(readAccess.payload.role),
  );

  res.json({ notes });
});

// Agent: upsert own session note (session owner, or super_admin on any accessible session)
router.put("/sessions/:id/notes", async (req, res): Promise<void> => {
  const params = PutSessionNotesParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = PutSessionNotesBody.safeParse(req.body ?? {});
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const readAccess = await requireSessionRead(req, res, params.data.id);
  if (!readAccess) return;

  if (!readAccess.access.canEditNotes && !isSuperAdmin(readAccess.payload.role)) {
    res.status(403).json({ error: "Only the current session owner can edit notes" });
    return;
  }

  if (!isSuperAdmin(readAccess.payload.role) && readAccess.sessionAgentId !== readAccess.payload.userId) {
    res.status(403).json({ error: "Only the current session owner can edit notes" });
    return;
  }

  const note = await upsertSessionNote(params.data.id, readAccess.payload.userId, body.data.content);
  res.json(note);
});

// Agent: transfer session to another reception agent (or super_admin takeover)
router.post("/sessions/:id/transfer", async (req, res): Promise<void> => {
  const payload = requireAuth(req, res);
  if (!payload) return;

  const params = TransferSessionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = TransferSessionBody.safeParse(req.body ?? {});
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const result = await transferSession(
    params.data.id,
    payload,
    body.data.targetAgentId,
    body.data.reason,
  );

  if (!result.ok) {
    res.status(result.status).json({ error: result.error });
    return;
  }

  res.json({
    transfer: result.transfer,
    session: result.session,
  });
});

// Agent: list transfer history for a session
router.get("/sessions/:id/transfers", async (req, res): Promise<void> => {
  const params = GetSessionTransfersParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const readAccess = await requireSessionRead(req, res, params.data.id);
  if (!readAccess) return;

  const transfers = await listSessionTransfers(params.data.id);
  res.json({ transfers });
});

export default router;
