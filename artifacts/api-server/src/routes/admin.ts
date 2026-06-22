import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { agentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { requireSuperAdmin } from "../lib/middleware";
import { AdminCreateAgentBody, AdminUpdateAgentParams, AdminUpdateAgentBody, AdminDeleteAgentParams } from "@workspace/api-zod";
import { listAllTransfers } from "../lib/session-transfers";
import { syncAgentsIdSequence } from "../lib/agents";
import { getClientIp } from "../lib/request-meta";
import { listSystemLogs, SystemLogAction, writeSystemLog } from "../lib/system-logs";

const router: IRouter = Router();

router.get("/admin/agents", async (req, res): Promise<void> => {
  if (requireSuperAdmin(req, res) === null) return;

  const agents = await db
    .select({
      id: agentsTable.id,
      username: agentsTable.username,
      role: agentsTable.role,
      displayName: agentsTable.displayName,
      avatarUrl: agentsTable.avatarUrl,
      introduction: agentsTable.introduction,
      isActive: agentsTable.isActive,
      createdAt: agentsTable.createdAt,
    })
    .from(agentsTable)
    .orderBy(agentsTable.createdAt);

  res.json(agents);
});

router.post("/admin/agents", async (req, res): Promise<void> => {
  const payload = requireSuperAdmin(req, res);
  if (!payload) return;

  const parsed = AdminCreateAgentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { id: customId, username, password, displayName, introduction, avatarUrl, role } = parsed.data;

  const existing = await db
    .select({ id: agentsTable.id })
    .from(agentsTable)
    .where(eq(agentsTable.username, username));

  if (existing.length > 0) {
    res.status(409).json({ error: "Username already taken" });
    return;
  }

  if (customId != null) {
    const existingId = await db
      .select({ id: agentsTable.id })
      .from(agentsTable)
      .where(eq(agentsTable.id, customId));

    if (existingId.length > 0) {
      res.status(409).json({ error: "Agent ID already taken" });
      return;
    }
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const [agent] = await db
    .insert(agentsTable)
    .values({
      ...(customId != null ? { id: customId } : {}),
      username,
      passwordHash,
      role: (role as "agent" | "super_admin") ?? "agent",
      displayName: displayName ?? "",
      introduction: introduction ?? undefined,
      avatarUrl: avatarUrl ?? undefined,
      isActive: true,
    })
    .returning({
      id: agentsTable.id,
      username: agentsTable.username,
      role: agentsTable.role,
      displayName: agentsTable.displayName,
      avatarUrl: agentsTable.avatarUrl,
      introduction: agentsTable.introduction,
      isActive: agentsTable.isActive,
      createdAt: agentsTable.createdAt,
    });

  if (customId != null) {
    await syncAgentsIdSequence();
  }

  void writeSystemLog({
    actorId: payload.userId,
    actorUsername: payload.username,
    actorRole: payload.role,
    action: SystemLogAction.ADMIN_AGENT_CREATE,
    targetType: "agent",
    targetId: agent.id,
    detail: { username: agent.username, role: agent.role, displayName: agent.displayName },
    ipAddress: getClientIp(req),
  });

  res.status(201).json(agent);
});

router.patch("/admin/agents/:id", async (req, res): Promise<void> => {
  const payload = requireSuperAdmin(req, res);
  if (!payload) return;

  const params = AdminUpdateAgentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = AdminUpdateAgentBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const existing = await db
    .select({ id: agentsTable.id })
    .from(agentsTable)
    .where(eq(agentsTable.id, params.data.id));

  if (existing.length === 0) {
    res.status(404).json({ error: "Agent not found" });
    return;
  }

  const updates: Record<string, unknown> = {};
  if (body.data.displayName !== undefined) updates.displayName = body.data.displayName;
  if (body.data.introduction !== undefined) updates.introduction = body.data.introduction;
  if (body.data.avatarUrl !== undefined) updates.avatarUrl = body.data.avatarUrl;
  if (body.data.isActive !== undefined) updates.isActive = body.data.isActive;
  if (body.data.role !== undefined) updates.role = body.data.role;
  if (body.data.password) {
    updates.passwordHash = await bcrypt.hash(body.data.password, 10);
  }

  const [updated] = await db
    .update(agentsTable)
    .set(updates)
    .where(eq(agentsTable.id, params.data.id))
    .returning({
      id: agentsTable.id,
      username: agentsTable.username,
      role: agentsTable.role,
      displayName: agentsTable.displayName,
      avatarUrl: agentsTable.avatarUrl,
      introduction: agentsTable.introduction,
      isActive: agentsTable.isActive,
      createdAt: agentsTable.createdAt,
    });

  void writeSystemLog({
    actorId: payload.userId,
    actorUsername: payload.username,
    actorRole: payload.role,
    action: SystemLogAction.ADMIN_AGENT_UPDATE,
    targetType: "agent",
    targetId: updated.id,
    detail: {
      username: updated.username,
      changed: Object.keys(updates).filter((k) => k !== "passwordHash"),
    },
    ipAddress: getClientIp(req),
  });

  res.json(updated);
});

router.delete("/admin/agents/:id", async (req, res): Promise<void> => {
  const payload = requireSuperAdmin(req, res);
  if (!payload) return;

  const params = AdminDeleteAgentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [removed] = await db
    .select({ id: agentsTable.id, username: agentsTable.username })
    .from(agentsTable)
    .where(eq(agentsTable.id, params.data.id));

  if (!removed) {
    res.status(404).json({ error: "Agent not found" });
    return;
  }

  await db.delete(agentsTable).where(eq(agentsTable.id, params.data.id));

  void writeSystemLog({
    actorId: payload.userId,
    actorUsername: payload.username,
    actorRole: payload.role,
    action: SystemLogAction.ADMIN_AGENT_DELETE,
    targetType: "agent",
    targetId: removed.id,
    detail: { username: removed.username },
    ipAddress: getClientIp(req),
  });

  res.json({ success: true });
});

router.post("/admin/agents/:id/reset-password", async (req, res): Promise<void> => {
  const payload = requireSuperAdmin(req, res);
  if (!payload) return;

  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid agent id" });
    return;
  }

  const password = typeof req.body?.password === "string" ? req.body.password : "";
  if (password.length < 6) {
    res.status(400).json({ error: "Password must be at least 6 characters" });
    return;
  }

  const [target] = await db
    .select({ id: agentsTable.id, username: agentsTable.username })
    .from(agentsTable)
    .where(eq(agentsTable.id, id));

  if (!target) {
    res.status(404).json({ error: "Agent not found" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await db
    .update(agentsTable)
    .set({ passwordHash })
    .where(eq(agentsTable.id, id));

  void writeSystemLog({
    actorId: payload.userId,
    actorUsername: payload.username,
    actorRole: payload.role,
    action: SystemLogAction.ADMIN_AGENT_RESET_PASSWORD,
    targetType: "agent",
    targetId: target.id,
    detail: { username: target.username },
    ipAddress: getClientIp(req),
  });

  res.json({ success: true });
});

router.get("/admin/me", async (req, res): Promise<void> => {
  const payload = requireSuperAdmin(req, res);
  if (!payload) return;

  res.json({
    userId: payload.userId,
    username: payload.username,
    role: payload.role,
  });
});

router.patch("/admin/me/password", async (req, res): Promise<void> => {
  const payload = requireSuperAdmin(req, res);
  if (!payload) return;

  const currentPassword =
    typeof req.body?.currentPassword === "string" ? req.body.currentPassword : "";
  const newPassword = typeof req.body?.newPassword === "string" ? req.body.newPassword : "";

  if (!currentPassword) {
    res.status(400).json({ error: "Current password is required" });
    return;
  }

  if (newPassword.length < 6) {
    res.status(400).json({ error: "Password must be at least 6 characters" });
    return;
  }

  const [agent] = await db
    .select({ id: agentsTable.id, passwordHash: agentsTable.passwordHash })
    .from(agentsTable)
    .where(eq(agentsTable.id, payload.userId));

  if (!agent) {
    res.status(404).json({ error: "Account not found" });
    return;
  }

  const valid = await bcrypt.compare(currentPassword, agent.passwordHash);
  if (!valid) {
    res.status(400).json({ error: "Current password is incorrect" });
    return;
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await db.update(agentsTable).set({ passwordHash }).where(eq(agentsTable.id, payload.userId));

  void writeSystemLog({
    actorId: payload.userId,
    actorUsername: payload.username,
    actorRole: payload.role,
    action: SystemLogAction.ADMIN_PASSWORD_CHANGE,
    targetType: "agent",
    targetId: payload.userId,
    ipAddress: getClientIp(req),
  });

  res.json({ success: true });
});

router.get("/admin/transfers", async (req, res): Promise<void> => {
  if (requireSuperAdmin(req, res) === null) return;

  const limitRaw = Number(req.query.limit ?? 100);
  const limit = Number.isInteger(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 500) : 100;
  const transfers = await listAllTransfers(limit);
  res.json({ transfers });
});

router.get("/admin/logs", async (req, res): Promise<void> => {
  if (requireSuperAdmin(req, res) === null) return;

  const limitRaw = Number(req.query.limit ?? 100);
  const limit = Number.isInteger(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 500) : 100;
  const action = typeof req.query.action === "string" ? req.query.action : undefined;
  const logs = await listSystemLogs({ limit, action });
  res.json({ logs });
});

export default router;
