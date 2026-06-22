import { db } from "@workspace/db";
import { systemLogsTable } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { logger } from "./logger";

export const SystemLogAction = {
  AGENT_LOGIN_SUCCESS: "agent.login.success",
  AGENT_LOGIN_FAILED: "agent.login.failed",
  AGENT_PASSWORD_CHANGE: "agent.password.change",
  ADMIN_AGENT_CREATE: "admin.agent.create",
  ADMIN_AGENT_UPDATE: "admin.agent.update",
  ADMIN_AGENT_DELETE: "admin.agent.delete",
  ADMIN_AGENT_RESET_PASSWORD: "admin.agent.reset_password",
  ADMIN_PASSWORD_CHANGE: "admin.password.change",
  SESSION_TRANSFER: "session.transfer",
} as const;

export type SystemLogActionValue = (typeof SystemLogAction)[keyof typeof SystemLogAction];

export interface WriteSystemLogInput {
  actorId?: number | null;
  actorUsername?: string | null;
  actorRole?: string | null;
  action: SystemLogActionValue | string;
  targetType?: string | null;
  targetId?: number | null;
  detail?: Record<string, unknown> | string | null;
  ipAddress?: string | null;
}

function serializeDetail(detail: WriteSystemLogInput["detail"]): string | undefined {
  if (detail == null) return undefined;
  if (typeof detail === "string") return detail;
  try {
    return JSON.stringify(detail);
  } catch {
    return undefined;
  }
}

export async function writeSystemLog(input: WriteSystemLogInput): Promise<void> {
  try {
    await db.insert(systemLogsTable).values({
      actorId: input.actorId ?? undefined,
      actorUsername: input.actorUsername ?? undefined,
      actorRole: input.actorRole ?? undefined,
      action: input.action,
      targetType: input.targetType ?? undefined,
      targetId: input.targetId ?? undefined,
      detail: serializeDetail(input.detail),
      ipAddress: input.ipAddress ?? undefined,
    });
  } catch (err) {
    logger.error({ err, action: input.action }, "Failed to write system log");
  }
}

export interface ListSystemLogsOptions {
  limit?: number;
  action?: string;
}

export async function listSystemLogs(options: ListSystemLogsOptions = {}) {
  const limitRaw = options.limit ?? 100;
  const limit = Number.isInteger(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 500) : 100;
  const action = options.action?.trim();

  const rows = await db
    .select()
    .from(systemLogsTable)
    .where(action ? eq(systemLogsTable.action, action) : undefined)
    .orderBy(desc(systemLogsTable.createdAt))
    .limit(limit);

  return rows;
}
