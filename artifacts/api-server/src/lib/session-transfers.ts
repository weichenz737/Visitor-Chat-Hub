import { db } from "@workspace/db";
import { sessionsTable, sessionTransfersTable, agentsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import type { AgentPayload } from "./auth";
import { findAssignableAgent } from "./agents";
import { canInitiateTransfer } from "./session-access";
import { broadcastSessionTransfer } from "./websocket";
import { SystemLogAction, writeSystemLog } from "./system-logs";

export type SessionTransferDto = {
  id: number;
  sessionId: number;
  fromAgentId: number;
  toAgentId: number;
  initiatedBy: number;
  reason: string | null;
  createdAt: Date;
  fromAgentDisplayName: string | null;
  toAgentDisplayName: string | null;
  initiatedByDisplayName: string | null;
  visitorNickname: string | null;
};

function toTransferDto(row: {
  id: number;
  sessionId: number;
  fromAgentId: number;
  toAgentId: number;
  initiatedBy: number;
  reason: string | null;
  createdAt: Date;
  fromAgentDisplayName?: string | null;
  toAgentDisplayName?: string | null;
  initiatedByDisplayName?: string | null;
  visitorNickname?: string | null;
}): SessionTransferDto {
  return {
    id: row.id,
    sessionId: row.sessionId,
    fromAgentId: row.fromAgentId,
    toAgentId: row.toAgentId,
    initiatedBy: row.initiatedBy,
    reason: row.reason,
    createdAt: row.createdAt,
    fromAgentDisplayName: row.fromAgentDisplayName ?? null,
    toAgentDisplayName: row.toAgentDisplayName ?? null,
    initiatedByDisplayName: row.initiatedByDisplayName ?? null,
    visitorNickname: row.visitorNickname ?? null,
  };
}

export async function transferSession(
  sessionId: number,
  actor: AgentPayload,
  targetAgentId: number,
  reason?: string,
): Promise<
  | { ok: true; transfer: SessionTransferDto; session: typeof sessionsTable.$inferSelect }
  | { ok: false; status: number; error: string }
> {
  if (!Number.isInteger(targetAgentId) || targetAgentId <= 0) {
    return { ok: false, status: 400, error: "Invalid target agent" };
  }

  const targetAgent = await findAssignableAgent(targetAgentId);
  if (!targetAgent) {
    return { ok: false, status: 400, error: "Target agent is not available for reception" };
  }

  const [session] = await db
    .select()
    .from(sessionsTable)
    .where(eq(sessionsTable.id, sessionId));

  if (!session) {
    return { ok: false, status: 404, error: "Session not found" };
  }

  if (!canInitiateTransfer(actor.role, actor.userId, session.agentId)) {
    return { ok: false, status: 403, error: "Forbidden" };
  }

  if (session.agentId === targetAgentId) {
    return { ok: false, status: 400, error: "Session is already assigned to this agent" };
  }

  const fromAgentId = session.agentId;
  if (fromAgentId == null) {
    return { ok: false, status: 400, error: "Session has no current owner" };
  }

  const [transfer] = await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(sessionsTable)
      .set({ agentId: targetAgentId })
      .where(eq(sessionsTable.id, sessionId))
      .returning();

    const [record] = await tx
      .insert(sessionTransfersTable)
      .values({
        sessionId,
        fromAgentId,
        toAgentId: targetAgentId,
        initiatedBy: actor.userId,
        reason: reason?.trim() || null,
      })
      .returning();

    return [record, updated] as const;
  });

  const names = await loadTransferDisplayNames([transfer]);
  const dto = toTransferDto({ ...transfer, ...names.get(transfer.id) });

  broadcastSessionTransfer(sessionId, targetAgentId, fromAgentId);

  void writeSystemLog({
    actorId: actor.userId,
    actorUsername: actor.username,
    actorRole: actor.role,
    action: SystemLogAction.SESSION_TRANSFER,
    targetType: "session",
    targetId: sessionId,
    detail: {
      fromAgentId,
      toAgentId: targetAgentId,
      reason: reason?.trim() || null,
      visitorNickname: session.visitorNickname,
    },
  });

  const [updatedSession] = await db
    .select()
    .from(sessionsTable)
    .where(eq(sessionsTable.id, sessionId));

  return { ok: true, transfer: dto, session: updatedSession };
}

async function loadTransferDisplayNames(
  transfers: Array<{ id: number; fromAgentId: number; toAgentId: number; initiatedBy: number; sessionId: number }>,
): Promise<Map<number, Partial<SessionTransferDto>>> {
  const map = new Map<number, Partial<SessionTransferDto>>();
  if (transfers.length === 0) return map;

  const agentIds = new Set<number>();
  const sessionIds = new Set<number>();
  for (const t of transfers) {
    agentIds.add(t.fromAgentId);
    agentIds.add(t.toAgentId);
    agentIds.add(t.initiatedBy);
    sessionIds.add(t.sessionId);
  }

  const agents = await db
    .select({ id: agentsTable.id, displayName: agentsTable.displayName })
    .from(agentsTable);

  const agentNameById = new Map(agents.map((a) => [a.id, a.displayName]));

  const sessions = await db
    .select({ id: sessionsTable.id, visitorNickname: sessionsTable.visitorNickname })
    .from(sessionsTable);

  const visitorBySession = new Map(sessions.map((s) => [s.id, s.visitorNickname]));

  for (const t of transfers) {
    map.set(t.id, {
      fromAgentDisplayName: agentNameById.get(t.fromAgentId) ?? null,
      toAgentDisplayName: agentNameById.get(t.toAgentId) ?? null,
      initiatedByDisplayName: agentNameById.get(t.initiatedBy) ?? null,
      visitorNickname: visitorBySession.get(t.sessionId) ?? null,
    });
  }

  return map;
}

export async function listSessionTransfers(sessionId: number): Promise<SessionTransferDto[]> {
  const rows = await db
    .select()
    .from(sessionTransfersTable)
    .where(eq(sessionTransfersTable.sessionId, sessionId))
    .orderBy(desc(sessionTransfersTable.createdAt));

  const names = await loadTransferDisplayNames(rows);
  return rows.map((row) => toTransferDto({ ...row, ...names.get(row.id) }));
}

export async function listAllTransfers(limit = 100): Promise<SessionTransferDto[]> {
  const rows = await db
    .select()
    .from(sessionTransfersTable)
    .orderBy(desc(sessionTransfersTable.createdAt))
    .limit(limit);

  const names = await loadTransferDisplayNames(rows);
  return rows.map((row) => toTransferDto({ ...row, ...names.get(row.id) }));
}
