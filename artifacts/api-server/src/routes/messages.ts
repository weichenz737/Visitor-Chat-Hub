import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { messagesTable, sessionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { SendMessageBody } from "@workspace/api-zod";
import { extractAuth } from "../lib/middleware";
import { assertAgentCanReply } from "../lib/session-access";

const router: IRouter = Router();

router.post("/messages", async (req, res): Promise<void> => {
  const parsed = SendMessageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  if (parsed.data.senderType === "agent") {
    const payload = extractAuth(req);
    if (!payload) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    const replyCheck = await assertAgentCanReply(
      parsed.data.sessionId,
      payload.userId,
      payload.role,
    );
    if (!replyCheck.ok) {
      res.status(403).json({ error: replyCheck.error });
      return;
    }
  }

  // Resolve ownerId from the session
  const [session] = await db
    .select({ agentId: sessionsTable.agentId })
    .from(sessionsTable)
    .where(eq(sessionsTable.id, parsed.data.sessionId));

  const ownerId = session?.agentId ?? undefined;

  const [message] = await db
    .insert(messagesTable)
    .values({
      sessionId: parsed.data.sessionId,
      ownerId,
      senderType: parsed.data.senderType,
      messageType: parsed.data.messageType,
      content: parsed.data.content,
      imageUrl: parsed.data.imageUrl ?? undefined,
      fileUrl: parsed.data.fileUrl ?? undefined,
      fileName: parsed.data.fileName ?? undefined,
      fileSize: parsed.data.fileSize ?? undefined,
      mimeType: parsed.data.mimeType ?? undefined,
    })
    .returning();

  if (parsed.data.senderType === "agent") {
    await db
      .update(sessionsTable)
      .set({ status: "active" })
      .where(eq(sessionsTable.id, parsed.data.sessionId));
  }

  res.status(201).json(message);
});

export default router;
