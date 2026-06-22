import { db } from "@workspace/db";
import { sessionNotesTable, agentsTable } from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";

export type SessionNoteDto = {
  id: number;
  sessionId: number;
  agentId: number;
  agentDisplayName: string | null;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  canEdit: boolean;
};

function noteHasContent(content: string): boolean {
  return content.trim().length > 0;
}

export async function getSessionNotesForUser(
  sessionId: number,
  userId: number,
  sessionAgentId: number | null,
  isAdmin: boolean,
): Promise<SessionNoteDto[]> {
  const rows = await db
    .select({
      id: sessionNotesTable.id,
      sessionId: sessionNotesTable.sessionId,
      agentId: sessionNotesTable.agentId,
      content: sessionNotesTable.content,
      createdAt: sessionNotesTable.createdAt,
      updatedAt: sessionNotesTable.updatedAt,
      agentDisplayName: agentsTable.displayName,
    })
    .from(sessionNotesTable)
    .leftJoin(agentsTable, eq(sessionNotesTable.agentId, agentsTable.id))
    .where(
      isAdmin
        ? eq(sessionNotesTable.sessionId, sessionId)
        : and(eq(sessionNotesTable.sessionId, sessionId), eq(sessionNotesTable.agentId, userId)),
    );

  return rows.map((row) => ({
    id: row.id,
    sessionId: row.sessionId,
    agentId: row.agentId,
    agentDisplayName: row.agentDisplayName ?? null,
    content: row.content,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    canEdit:
      row.agentId === userId &&
      (isAdmin || sessionAgentId === userId),
  }));
}

export async function upsertSessionNote(
  sessionId: number,
  agentId: number,
  content: string,
): Promise<SessionNoteDto> {
  const now = new Date();
  const [row] = await db
    .insert(sessionNotesTable)
    .values({
      sessionId,
      agentId,
      content,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [sessionNotesTable.sessionId, sessionNotesTable.agentId],
      set: {
        content,
        updatedAt: now,
      },
    })
    .returning();

  const [agent] = await db
    .select({ displayName: agentsTable.displayName })
    .from(agentsTable)
    .where(eq(agentsTable.id, agentId));

  return {
    id: row.id,
    sessionId: row.sessionId,
    agentId: row.agentId,
    agentDisplayName: agent?.displayName ?? null,
    content: row.content,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    canEdit: true,
  };
}

export async function getHasNoteBySessionIds(
  sessionIds: number[],
  viewerId: number,
  isAdmin: boolean,
  sessionAgentById: Map<number, number | null>,
): Promise<Map<number, boolean>> {
  const result = new Map<number, boolean>();
  if (sessionIds.length === 0) return result;

  const rows = await db
    .select({
      sessionId: sessionNotesTable.sessionId,
      agentId: sessionNotesTable.agentId,
      content: sessionNotesTable.content,
    })
    .from(sessionNotesTable)
    .where(inArray(sessionNotesTable.sessionId, sessionIds));

  for (const sessionId of sessionIds) {
    result.set(sessionId, false);
  }

  for (const row of rows) {
    if (!noteHasContent(row.content)) continue;

    if (isAdmin) {
      const ownerId = sessionAgentById.get(row.sessionId);
      if (ownerId != null && row.agentId === ownerId) {
        result.set(row.sessionId, true);
      }
    } else if (row.agentId === viewerId) {
      result.set(row.sessionId, true);
    }
  }

  return result;
}
