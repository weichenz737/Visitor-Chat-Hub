import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { messagesTable, sessionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { SendMessageBody } from "@workspace/api-zod";

const router: IRouter = Router();

router.post("/messages", async (req, res): Promise<void> => {
  const parsed = SendMessageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
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
