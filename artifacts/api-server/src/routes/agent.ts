import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { agentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { signToken } from "../lib/auth";
import { requireAuth } from "../lib/middleware";
import { AgentLoginBody } from "@workspace/api-zod";

const router: IRouter = Router();

// Public: list active agents for visitor selection
router.get("/agents", async (_req, res): Promise<void> => {
  const agents = await db
    .select({
      id: agentsTable.id,
      displayName: agentsTable.displayName,
      avatarUrl: agentsTable.avatarUrl,
      introduction: agentsTable.introduction,
    })
    .from(agentsTable)
    .where(eq(agentsTable.isActive, true))
    .orderBy(agentsTable.createdAt);

  res.json(agents);
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
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const valid = await bcrypt.compare(parsed.data.password, agent.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const role = (agent.role as "agent" | "super_admin") ?? "agent";
  const token = signToken({ userId: agent.id, role, username: agent.username });
  res.json({ token, agentId: agent.id, userId: agent.id, username: agent.username, role });
});

router.get("/agent/me", async (req, res): Promise<void> => {
  const payload = requireAuth(req, res);
  if (!payload) return;

  res.json({ agentId: payload.userId, userId: payload.userId, username: payload.username, role: payload.role });
});

export default router;
