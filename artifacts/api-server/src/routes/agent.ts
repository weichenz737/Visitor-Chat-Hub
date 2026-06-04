import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { agentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { signToken, verifyToken } from "../lib/auth";
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

  if (!agent) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const valid = await bcrypt.compare(parsed.data.password, agent.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const token = signToken({ agentId: agent.id, username: agent.username });
  res.json({ token, agentId: agent.id, username: agent.username });
});

router.get("/agent/me", async (req, res): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const token = authHeader.slice(7);
  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: "Invalid token" });
    return;
  }

  res.json({ agentId: payload.agentId, username: payload.username });
});

export default router;
