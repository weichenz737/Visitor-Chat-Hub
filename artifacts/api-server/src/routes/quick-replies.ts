import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { quickRepliesTable, agentsTable } from "@workspace/db";
import { eq, and, or, ilike, desc } from "drizzle-orm";
import {
  AgentCreateQuickReplyBody,
  AgentUpdateQuickReplyParams,
  AgentUpdateQuickReplyBody,
  AgentDeleteQuickReplyParams,
  AdminCreateQuickReplyBody,
  AdminUpdateQuickReplyParams,
  AdminUpdateQuickReplyBody,
  AdminDeleteQuickReplyParams,
} from "@workspace/api-zod";
import { requireAuth, requireSuperAdmin } from "../lib/middleware";

const router: IRouter = Router();

function parseQueryString(value: unknown): string | undefined {
  if (value == null || value === "") return undefined;
  const raw = Array.isArray(value) ? value[0] : value;
  return typeof raw === "string" ? raw : undefined;
}

function parseOptionalInt(value: unknown): number | undefined {
  if (value == null || value === "") return undefined;
  const raw = Array.isArray(value) ? value[0] : value;
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : undefined;
}

function buildSearchFilter(q: string | undefined) {
  if (!q?.trim()) return undefined;
  const pattern = `%${q.trim()}%`;
  return or(
    ilike(quickRepliesTable.title, pattern),
    ilike(quickRepliesTable.content, pattern),
  )!;
}

function toQuickReply(row: typeof quickRepliesTable.$inferSelect) {
  return {
    id: row.id,
    agentId: row.agentId,
    title: row.title,
    content: row.content,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

router.get("/agent/quick-replies", async (req, res): Promise<void> => {
  const payload = requireAuth(req, res);
  if (!payload) return;

  const q = parseQueryString(req.query.q);
  const searchFilter = buildSearchFilter(q);

  const whereClause = searchFilter
    ? and(eq(quickRepliesTable.agentId, payload.userId), searchFilter)
    : eq(quickRepliesTable.agentId, payload.userId);

  const rows = await db
    .select()
    .from(quickRepliesTable)
    .where(whereClause)
    .orderBy(desc(quickRepliesTable.updatedAt));

  res.json(rows.map(toQuickReply));
});

router.post("/agent/quick-replies", async (req, res): Promise<void> => {
  const payload = requireAuth(req, res);
  if (!payload) return;

  const parsed = AgentCreateQuickReplyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const now = new Date();
  const [row] = await db
    .insert(quickRepliesTable)
    .values({
      agentId: payload.userId,
      title: parsed.data.title.trim(),
      content: parsed.data.content,
      updatedAt: now,
    })
    .returning();

  res.status(201).json(toQuickReply(row));
});

router.patch("/agent/quick-replies/:id", async (req, res): Promise<void> => {
  const payload = requireAuth(req, res);
  if (!payload) return;

  const params = AgentUpdateQuickReplyParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = AgentUpdateQuickReplyBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [existing] = await db
    .select()
    .from(quickRepliesTable)
    .where(eq(quickRepliesTable.id, params.data.id));

  if (!existing) {
    res.status(404).json({ error: "Quick reply not found" });
    return;
  }

  if (existing.agentId !== payload.userId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const updates: Partial<typeof quickRepliesTable.$inferInsert> = { updatedAt: new Date() };
  if (body.data.title !== undefined) updates.title = body.data.title.trim();
  if (body.data.content !== undefined) updates.content = body.data.content;

  const [updated] = await db
    .update(quickRepliesTable)
    .set(updates)
    .where(eq(quickRepliesTable.id, params.data.id))
    .returning();

  res.json(toQuickReply(updated));
});

router.delete("/agent/quick-replies/:id", async (req, res): Promise<void> => {
  const payload = requireAuth(req, res);
  if (!payload) return;

  const params = AgentDeleteQuickReplyParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [existing] = await db
    .select({ agentId: quickRepliesTable.agentId })
    .from(quickRepliesTable)
    .where(eq(quickRepliesTable.id, params.data.id));

  if (!existing) {
    res.status(404).json({ error: "Quick reply not found" });
    return;
  }

  if (existing.agentId !== payload.userId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  await db.delete(quickRepliesTable).where(eq(quickRepliesTable.id, params.data.id));
  res.json({ success: true });
});

async function listQuickRepliesWithAgent(agentId: number | undefined, q: string | undefined) {
  const searchFilter = buildSearchFilter(q);
  const conditions = [];
  if (agentId != null) conditions.push(eq(quickRepliesTable.agentId, agentId));
  if (searchFilter) conditions.push(searchFilter);

  const whereClause = conditions.length ? and(...conditions) : undefined;

  const rows = await db
    .select({
      id: quickRepliesTable.id,
      agentId: quickRepliesTable.agentId,
      title: quickRepliesTable.title,
      content: quickRepliesTable.content,
      createdAt: quickRepliesTable.createdAt,
      updatedAt: quickRepliesTable.updatedAt,
      agentDisplayName: agentsTable.displayName,
      agentUsername: agentsTable.username,
    })
    .from(quickRepliesTable)
    .leftJoin(agentsTable, eq(quickRepliesTable.agentId, agentsTable.id))
    .where(whereClause)
    .orderBy(desc(quickRepliesTable.updatedAt));

  return rows.map((row) => ({
    ...toQuickReply(row),
    agentDisplayName: row.agentDisplayName ?? null,
    agentUsername: row.agentUsername ?? null,
  }));
}

router.get("/admin/quick-replies", async (req, res): Promise<void> => {
  if (requireSuperAdmin(req, res) === null) return;

  const agentId = parseOptionalInt(req.query.agentId);
  const q = parseQueryString(req.query.q);

  const rows = await listQuickRepliesWithAgent(agentId, q);
  res.json(rows);
});

router.post("/admin/quick-replies", async (req, res): Promise<void> => {
  if (requireSuperAdmin(req, res) === null) return;

  const parsed = AdminCreateQuickReplyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [agent] = await db
    .select({ id: agentsTable.id })
    .from(agentsTable)
    .where(eq(agentsTable.id, parsed.data.agentId));

  if (!agent) {
    res.status(400).json({ error: "Agent not found" });
    return;
  }

  const now = new Date();
  const [row] = await db
    .insert(quickRepliesTable)
    .values({
      agentId: parsed.data.agentId,
      title: parsed.data.title.trim(),
      content: parsed.data.content,
      updatedAt: now,
    })
    .returning();

  const created = (await listQuickRepliesWithAgent(parsed.data.agentId, undefined)).find(
    (r) => r.id === row.id,
  );

  res.status(201).json(created ?? { ...toQuickReply(row), agentDisplayName: null, agentUsername: null });
});

router.patch("/admin/quick-replies/:id", async (req, res): Promise<void> => {
  if (requireSuperAdmin(req, res) === null) return;

  const params = AdminUpdateQuickReplyParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = AdminUpdateQuickReplyBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [existing] = await db
    .select({ id: quickRepliesTable.id })
    .from(quickRepliesTable)
    .where(eq(quickRepliesTable.id, params.data.id));

  if (!existing) {
    res.status(404).json({ error: "Quick reply not found" });
    return;
  }

  const updates: Partial<typeof quickRepliesTable.$inferInsert> = { updatedAt: new Date() };
  if (body.data.title !== undefined) updates.title = body.data.title.trim();
  if (body.data.content !== undefined) updates.content = body.data.content;

  await db
    .update(quickRepliesTable)
    .set(updates)
    .where(eq(quickRepliesTable.id, params.data.id));

  const all = await listQuickRepliesWithAgent(undefined, undefined);
  const updated = all.find((r) => r.id === params.data.id);
  if (!updated) {
    res.status(404).json({ error: "Quick reply not found" });
    return;
  }

  res.json(updated);
});

router.delete("/admin/quick-replies/:id", async (req, res): Promise<void> => {
  if (requireSuperAdmin(req, res) === null) return;

  const params = AdminDeleteQuickReplyParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [existing] = await db
    .select({ id: quickRepliesTable.id })
    .from(quickRepliesTable)
    .where(eq(quickRepliesTable.id, params.data.id));

  if (!existing) {
    res.status(404).json({ error: "Quick reply not found" });
    return;
  }

  await db.delete(quickRepliesTable).where(eq(quickRepliesTable.id, params.data.id));
  res.json({ success: true });
});

export default router;
