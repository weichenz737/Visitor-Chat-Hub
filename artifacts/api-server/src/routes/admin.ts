import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { agentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { requireSuperAdmin } from "../lib/middleware";
import { AdminCreateAgentBody, AdminUpdateAgentParams, AdminUpdateAgentBody, AdminDeleteAgentParams } from "@workspace/api-zod";

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
  if (requireSuperAdmin(req, res) === null) return;

  const parsed = AdminCreateAgentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { username, password, displayName, introduction, avatarUrl, role } = parsed.data;

  const existing = await db
    .select({ id: agentsTable.id })
    .from(agentsTable)
    .where(eq(agentsTable.username, username));

  if (existing.length > 0) {
    res.status(409).json({ error: "Username already taken" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const [agent] = await db
    .insert(agentsTable)
    .values({
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

  res.status(201).json(agent);
});

router.patch("/admin/agents/:id", async (req, res): Promise<void> => {
  if (requireSuperAdmin(req, res) === null) return;

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

  res.json(updated);
});

router.delete("/admin/agents/:id", async (req, res): Promise<void> => {
  if (requireSuperAdmin(req, res) === null) return;

  const params = AdminDeleteAgentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
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

  await db.delete(agentsTable).where(eq(agentsTable.id, params.data.id));
  res.json({ success: true });
});

export default router;
