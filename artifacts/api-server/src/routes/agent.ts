import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { agentsTable } from "@workspace/db";
import { and, eq, ne } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { signToken } from "../lib/auth";
import { requireAuth } from "../lib/middleware";
import { AgentLoginBody, UpdateAgentMeBody } from "@workspace/api-zod";
import {
  findAssignableAgent,
  publicAgentColumns,
  toAgentPublic,
} from "../lib/agents";
import { getClientIp } from "../lib/request-meta";
import { SystemLogAction, writeSystemLog } from "../lib/system-logs";

const router: IRouter = Router();

// Public: list active reception agents (excludes super_admin)
router.get("/agents", async (_req, res): Promise<void> => {
  const agents = await db
    .select(publicAgentColumns)
    .from(agentsTable)
    .where(
      and(eq(agentsTable.isActive, true), ne(agentsTable.role, "super_admin")),
    )
    .orderBy(agentsTable.createdAt);

  res.json(agents.map(toAgentPublic));
});

// Public: resolve agent from dedicated chat link
router.get("/agents/:id", async (req, res): Promise<void> => {
  const agentId = Number(req.params.id);
  if (!Number.isInteger(agentId) || agentId <= 0) {
    res.status(400).json({ error: "Invalid agent id" });
    return;
  }

  const agent = await findAssignableAgent(agentId);
  if (!agent) {
    res.status(404).json({ error: "Agent not found" });
    return;
  }

  res.json(toAgentPublic(agent));
});

router.post("/agent/login", async (req, res): Promise<void> => {
  const parsed = AgentLoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [agent] = await db
    .select()
    .from(agentsTable)
    .where(eq(agentsTable.username, parsed.data.username));

  if (!agent || !agent.isActive) {
    void writeSystemLog({
      actorUsername: parsed.data.username,
      action: SystemLogAction.AGENT_LOGIN_FAILED,
      targetType: "agent",
      detail: { reason: "invalid_credentials" },
      ipAddress: getClientIp(req),
    });
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const valid = await bcrypt.compare(parsed.data.password, agent.passwordHash);
  if (!valid) {
    void writeSystemLog({
      actorId: agent.id,
      actorUsername: agent.username,
      actorRole: agent.role,
      action: SystemLogAction.AGENT_LOGIN_FAILED,
      targetType: "agent",
      targetId: agent.id,
      detail: { reason: "invalid_password" },
      ipAddress: getClientIp(req),
    });
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const role = (agent.role as "agent" | "super_admin") ?? "agent";
  const token = signToken({ userId: agent.id, role, username: agent.username });

  void writeSystemLog({
    actorId: agent.id,
    actorUsername: agent.username,
    actorRole: role,
    action: SystemLogAction.AGENT_LOGIN_SUCCESS,
    targetType: "agent",
    targetId: agent.id,
    ipAddress: getClientIp(req),
  });

  res.json({ token, agentId: agent.id, userId: agent.id, username: agent.username, role });
});

router.get("/agent/me", async (req, res): Promise<void> => {
  const payload = requireAuth(req, res);
  if (!payload) return;

  const [agent] = await db
    .select({
      id: agentsTable.id,
      username: agentsTable.username,
      role: agentsTable.role,
      displayName: agentsTable.displayName,
      avatarUrl: agentsTable.avatarUrl,
    })
    .from(agentsTable)
    .where(eq(agentsTable.id, payload.userId));

  if (!agent) {
    res.status(404).json({ error: "Agent not found" });
    return;
  }

  res.json({
    agentId: payload.userId,
    userId: payload.userId,
    username: payload.username,
    role: payload.role,
    displayName: agent.displayName || agent.username,
    avatarUrl: agent.avatarUrl,
  });
});

router.patch("/agent/me", async (req, res): Promise<void> => {
  const payload = requireAuth(req, res);
  if (!payload) return;

  const parsed = UpdateAgentMeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updates: Record<string, unknown> = {};
  if (parsed.data.displayName !== undefined) updates.displayName = parsed.data.displayName;
  if (parsed.data.avatarUrl !== undefined) updates.avatarUrl = parsed.data.avatarUrl;

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "No fields to update" });
    return;
  }

  const [updated] = await db
    .update(agentsTable)
    .set(updates)
    .where(eq(agentsTable.id, payload.userId))
    .returning({
      id: agentsTable.id,
      username: agentsTable.username,
      role: agentsTable.role,
      displayName: agentsTable.displayName,
      avatarUrl: agentsTable.avatarUrl,
    });

  if (!updated) {
    res.status(404).json({ error: "Agent not found" });
    return;
  }

  res.json({
    agentId: updated.id,
    userId: updated.id,
    username: updated.username,
    role: updated.role,
    displayName: updated.displayName || updated.username,
    avatarUrl: updated.avatarUrl,
  });
});

router.patch("/agent/me/password", async (req, res): Promise<void> => {
  const payload = requireAuth(req, res);
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
    action: SystemLogAction.AGENT_PASSWORD_CHANGE,
    targetType: "agent",
    targetId: payload.userId,
    ipAddress: getClientIp(req),
  });

  res.json({ success: true });
});

export default router;
