import { db, agentsTable } from "@workspace/db";
import { and, eq, ne, sql } from "drizzle-orm";

export const AGENT_ONLINE_WINDOW_MS = 60_000;

/** Active reception agents only — excludes super_admin. */
export async function findAssignableAgent(agentId: number) {
  const [agent] = await db
    .select()
    .from(agentsTable)
    .where(
      and(
        eq(agentsTable.id, agentId),
        eq(agentsTable.isActive, true),
        ne(agentsTable.role, "super_admin"),
      ),
    );
  return agent ?? null;
}

export function isAgentOnline(lastSeenAt: Date | null | undefined): boolean {
  if (!lastSeenAt) return false;
  return Date.now() - lastSeenAt.getTime() < AGENT_ONLINE_WINDOW_MS;
}

export const publicAgentColumns = {
  id: agentsTable.id,
  displayName: agentsTable.displayName,
  avatarUrl: agentsTable.avatarUrl,
  introduction: agentsTable.introduction,
  lastSeenAt: agentsTable.lastSeenAt,
} as const;

export function toAgentPublic(agent: {
  id: number;
  displayName: string;
  avatarUrl: string | null;
  introduction: string | null;
  lastSeenAt?: Date | null;
}) {
  return {
    id: agent.id,
    displayName: agent.displayName,
    avatarUrl: agent.avatarUrl,
    introduction: agent.introduction,
    isOnline: isAgentOnline(agent.lastSeenAt ?? null),
  };
}

export async function touchAgentLastSeen(agentId: number): Promise<void> {
  await db
    .update(agentsTable)
    .set({ lastSeenAt: new Date() })
    .where(eq(agentsTable.id, agentId));
}

/** Keep serial sequence ahead of manually assigned agent IDs. */
export async function syncAgentsIdSequence(): Promise<void> {
  await db.execute(
    sql`SELECT setval(pg_get_serial_sequence('agents', 'id'), COALESCE((SELECT MAX(id) FROM agents), 1), true)`,
  );
}
