import { db } from "@workspace/db";
import { sessionTransfersTable, sessionsTable } from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { isSuperAdmin, hasPermission, Permission } from "./permissions";

export type AgentAccessMode = "owner" | "readonly" | "super_admin";

export type AgentSessionAccess = {
  canRead: boolean;
  canReply: boolean;
  canTransfer: boolean;
  canEditNotes: boolean;
  accessMode: AgentAccessMode;
};

type TransferHistoryPolicyMode = "readonly_for_original_agent" | "hidden";

const DEFAULT_POLICY: TransferHistoryPolicyMode = "readonly_for_original_agent";

let cachedPolicy: TransferHistoryPolicyMode | null = null;
let policyFetchedAt = 0;
const POLICY_TTL_MS = 60_000;

export async function getTransferHistoryPolicyMode(): Promise<TransferHistoryPolicyMode> {
  if (cachedPolicy && Date.now() - policyFetchedAt < POLICY_TTL_MS) {
    return cachedPolicy;
  }

  try {
    const result = await db.execute(
      sql`SELECT value FROM app_settings WHERE key = 'transfer.history_policy' LIMIT 1`,
    );
    const rows = Array.isArray(result) ? result : (result as { rows?: unknown[] }).rows ?? [];
    const row = rows[0] as { value?: { mode?: string } } | undefined;
    const mode = row?.value?.mode;
    if (mode === "hidden") {
      cachedPolicy = "hidden";
    } else {
      cachedPolicy = "readonly_for_original_agent";
    }
  } catch {
    cachedPolicy = DEFAULT_POLICY;
  }

  policyFetchedAt = Date.now();
  return cachedPolicy ?? DEFAULT_POLICY;
}

export async function getFormerSessionIdsForAgent(agentId: number): Promise<number[]> {
  const rows = await db
    .selectDistinct({ sessionId: sessionTransfersTable.sessionId })
    .from(sessionTransfersTable)
    .where(eq(sessionTransfersTable.fromAgentId, agentId));
  return rows.map((r) => r.sessionId);
}

export async function wasFormerAgent(sessionId: number, agentId: number): Promise<boolean> {
  const [row] = await db
    .select({ id: sessionTransfersTable.id })
    .from(sessionTransfersTable)
    .where(
      and(
        eq(sessionTransfersTable.sessionId, sessionId),
        eq(sessionTransfersTable.fromAgentId, agentId),
      ),
    )
    .limit(1);
  return !!row;
}

export async function resolveAgentSessionAccess(
  sessionId: number,
  userId: number,
  role: string,
  sessionAgentId: number | null,
): Promise<AgentSessionAccess> {
  if (isSuperAdmin(role)) {
    const isOwner = sessionAgentId === userId;
    return {
      canRead: true,
      canReply: hasPermission(role, Permission.SESSIONS_REPLY),
      canTransfer: hasPermission(role, Permission.SESSIONS_TAKEOVER),
      canEditNotes: isOwner,
      accessMode: "super_admin",
    };
  }

  if (sessionAgentId === userId) {
    return {
      canRead: true,
      canReply: true,
      canTransfer: true,
      canEditNotes: true,
      accessMode: "owner",
    };
  }

  const isFormer = await wasFormerAgent(sessionId, userId);
  if (isFormer) {
    const policy = await getTransferHistoryPolicyMode();
    if (policy === "hidden") {
      return {
        canRead: false,
        canReply: false,
        canTransfer: false,
        canEditNotes: false,
        accessMode: "readonly",
      };
    }
    return {
      canRead: true,
      canReply: false,
      canTransfer: false,
      canEditNotes: false,
      accessMode: "readonly",
    };
  }

  return {
    canRead: false,
    canReply: false,
    canTransfer: false,
    canEditNotes: false,
    accessMode: "readonly",
  };
}

export function canInitiateTransfer(
  role: string,
  userId: number,
  sessionAgentId: number | null,
): boolean {
  if (sessionAgentId === userId) return true;
  return isSuperAdmin(role) && hasPermission(role, Permission.SESSIONS_TAKEOVER);
}

export async function filterReadableFormerSessionIds(
  agentId: number,
  sessionIds: number[],
): Promise<number[]> {
  if (sessionIds.length === 0) return [];
  const policy = await getTransferHistoryPolicyMode();
  if (policy === "hidden") return [];

  const rows = await db
    .selectDistinct({ sessionId: sessionTransfersTable.sessionId })
    .from(sessionTransfersTable)
    .where(
      and(
        eq(sessionTransfersTable.fromAgentId, agentId),
        inArray(sessionTransfersTable.sessionId, sessionIds),
      ),
    );
  return rows.map((r) => r.sessionId);
}

export async function assertAgentCanReply(
  sessionId: number,
  agentId: number,
  role: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const [session] = await db
    .select({ agentId: sessionsTable.agentId })
    .from(sessionsTable)
    .where(eq(sessionsTable.id, sessionId));

  if (!session) {
    return { ok: false, error: "Session not found" };
  }

  const access = await resolveAgentSessionAccess(sessionId, agentId, role, session.agentId);
  if (!access.canReply) {
    return { ok: false, error: "Cannot send messages on this session" };
  }

  return { ok: true };
}
