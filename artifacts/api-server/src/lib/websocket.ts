import { WebSocketServer, WebSocket } from "ws";
import { IncomingMessage } from "http";
import { db } from "@workspace/db";
import { messagesTable, sessionsTable } from "@workspace/db";
import { touchAgentLastSeen } from "./agents";
import { eq, and } from "drizzle-orm";
import { verifyToken } from "./auth";
import { logger } from "./logger";
import {
  onMessageCreated,
  markAgentReadSession,
  markVisitorReadSession,
  type SessionReadState,
} from "./session-read";
import { assertAgentCanReply } from "./session-access";
import { formatMessagePreview } from "./message-preview";

interface ClientInfo {
  type: "visitor" | "agent" | "unknown";
  sessionId?: number;
  agentId?: number;
  role?: string;
  visitorNickname?: string;
}

const clients = new Map<WebSocket, ClientInfo>();

const VISITOR_HEARTBEAT_MS = 12_000;

export function createWebSocketServer(): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true });

  wss.on("connection", (ws: WebSocket, _req: IncomingMessage) => {
    clients.set(ws, { type: "unknown" });
    logger.info("WebSocket client connected");

    const heartbeatInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      }
    }, VISITOR_HEARTBEAT_MS);

    ws.on("message", async (data) => {
      try {
        const msg = JSON.parse(data.toString());
        await handleMessage(ws, msg);
      } catch (err) {
        logger.error({ err }, "Failed to process WS message");
        safeSend(ws, { type: "error", error: "Invalid message format" });
      }
    });

    ws.on("close", async () => {
      clearInterval(heartbeatInterval);
      clients.delete(ws);
      logger.info("WebSocket client disconnected");
    });

    ws.on("pong", () => {
      // client alive
    });

    safeSend(ws, { type: "connected", message: "WebSocket connected" });
  });

  return wss;
}

async function touchVisitorLastSeen(sessionId: number): Promise<void> {
  await db
    .update(sessionsTable)
    .set({ lastSeenAt: new Date() })
    .where(eq(sessionsTable.id, sessionId));
}

async function handleMessage(ws: WebSocket, msg: Record<string, unknown>): Promise<void> {
  const type = msg.type as string;

  if (type === "ping") {
    const info = clients.get(ws);
    if (info?.type === "visitor" && info.sessionId) {
      await touchVisitorLastSeen(info.sessionId);
    } else if (info?.type === "agent" && info.agentId) {
      await touchAgentLastSeen(info.agentId);
      broadcastAgentPresence(info.agentId, true);
    }
    safeSend(ws, { type: "pong" });
    return;
  }

  if (type === "visitor_connect") {
    const sessionId = Number(msg.sessionId);
    const visitorNickname = String(msg.visitorNickname ?? "");
    const [session] = await db
      .select({ agentId: sessionsTable.agentId })
      .from(sessionsTable)
      .where(eq(sessionsTable.id, sessionId));

    clients.set(ws, {
      type: "visitor",
      sessionId,
      visitorNickname,
      agentId: session?.agentId ?? undefined,
    });

    await touchVisitorLastSeen(sessionId);

    logger.info({ sessionId, visitorNickname, agentId: session?.agentId }, "Visitor connected");
    return;
  }

  if (type === "agent_connect") {
    const token = String(msg.token ?? "");
    const payload = verifyToken(token);
    if (!payload) {
      safeSend(ws, { type: "error", error: "Invalid token" });
      return;
    }
    clients.set(ws, { type: "agent", agentId: payload.userId, role: payload.role });
    await touchAgentLastSeen(payload.userId);
    broadcastAgentPresence(payload.userId, true);
    logger.info({ agentId: payload.userId, role: payload.role }, "Agent connected via WS");
    return;
  }

  if (type === "message") {
    const info = clients.get(ws);
    const sessionId = Number(msg.sessionId);
    const senderTypeRaw = String(msg.senderType ?? "");
    if (senderTypeRaw !== "visitor" && senderTypeRaw !== "agent") {
      safeSend(ws, { type: "error", error: "Missing required fields" });
      return;
    }
    const senderType = senderTypeRaw as "visitor" | "agent";
    const messageType = String(msg.messageType ?? "text");
    const content = String(msg.content ?? "");
    const imageUrl = msg.imageUrl ? String(msg.imageUrl) : null;
    const fileUrl = msg.fileUrl ? String(msg.fileUrl) : null;
    const fileName = msg.fileName ? String(msg.fileName) : null;
    const fileSizeRaw = msg.fileSize != null ? Number(msg.fileSize) : null;
    const fileSize = fileSizeRaw != null && Number.isFinite(fileSizeRaw) ? fileSizeRaw : null;
    const mimeType = msg.mimeType ? String(msg.mimeType) : null;

    if (!sessionId || !senderType) {
      safeSend(ws, { type: "error", error: "Missing required fields" });
      return;
    }

    if (messageType === "file" && (!fileUrl || !fileName)) {
      safeSend(ws, { type: "error", error: "Missing file fields" });
      return;
    }

    if (messageType !== "file" && content == null) {
      safeSend(ws, { type: "error", error: "Missing required fields" });
      return;
    }

    const [session] = await db
      .select({ agentId: sessionsTable.agentId })
      .from(sessionsTable)
      .where(eq(sessionsTable.id, sessionId));

    const ownerId = session?.agentId ?? undefined;

    if (senderType === "agent") {
      const info = clients.get(ws);
      if (info?.type !== "agent" || info.agentId == null) {
        safeSend(ws, { type: "error", error: "Unauthorized" });
        return;
      }
      const replyCheck = await assertAgentCanReply(sessionId, info.agentId, info.role ?? "agent");
      if (!replyCheck.ok) {
        safeSend(ws, { type: "error", error: replyCheck.error });
        return;
      }
    }

    const [savedMessage] = await db
      .insert(messagesTable)
      .values({
        sessionId,
        ownerId,
        senderType,
        messageType,
        content: messageType === "file" ? fileName ?? "[file]" : content,
        imageUrl: imageUrl ?? undefined,
        fileUrl: fileUrl ?? undefined,
        fileName: fileName ?? undefined,
        fileSize: fileSize ?? undefined,
        mimeType: mimeType ?? undefined,
      })
      .returning();

    // Chat-first: push message to clients before unread / status side effects
    broadcastToSessionVisitor(sessionId, { type: "message", message: savedMessage });
    safeSend(ws, { type: "message", message: savedMessage });
    if (info?.type !== "agent") {
      broadcastToSessionOwner(ownerId ?? 0, { type: "message", message: savedMessage });
    }

    void (async () => {
      try {
        if (senderType === "visitor") {
          await touchVisitorLastSeen(sessionId);
          await db
            .update(sessionsTable)
            .set({ status: "waiting" })
            .where(and(eq(sessionsTable.id, sessionId), eq(sessionsTable.status, "closed")));
        } else {
          await db
            .update(sessionsTable)
            .set({ status: "active" })
            .where(eq(sessionsTable.id, sessionId));
        }

        const readState = await onMessageCreated(sessionId, savedMessage.id, senderType);
        broadcastReadState(sessionId, readState, ownerId ?? 0);

        broadcastToSessionOwner(ownerId ?? 0, {
          type: "session_update",
          sessionId,
          lastMessage: formatMessagePreview(messageType, content, { fileName, imageUrl }),
          lastMessageAt: new Date().toISOString(),
        });
      } catch (err) {
        logger.error({ err, sessionId }, "Post-message side effects failed");
      }
    })();
    return;
  }

  if (type === "agent_read") {
    const info = clients.get(ws);
    if (info?.type !== "agent" || info.agentId == null) {
      safeSend(ws, { type: "error", error: "Unauthorized" });
      return;
    }
    const sessionId = Number(msg.sessionId);
    const [session] = await db
      .select({ agentId: sessionsTable.agentId })
      .from(sessionsTable)
      .where(eq(sessionsTable.id, sessionId));
    if (!session) return;

    if (session.agentId !== info.agentId && info.role !== "super_admin") {
      safeSend(ws, { type: "error", error: "Unauthorized" });
      return;
    }

    const readState = await markAgentReadSession(sessionId);
    broadcastReadState(sessionId, readState, session.agentId ?? 0);
    return;
  }

  if (type === "visitor_read") {
    const info = clients.get(ws);
    if (info?.type !== "visitor" || info.sessionId !== Number(msg.sessionId)) {
      safeSend(ws, { type: "error", error: "Unauthorized" });
      return;
    }
    const sessionId = Number(msg.sessionId);
    const [session] = await db
      .select({ agentId: sessionsTable.agentId })
      .from(sessionsTable)
      .where(eq(sessionsTable.id, sessionId));

    const readState = await markVisitorReadSession(sessionId);
    broadcastReadState(sessionId, readState, session?.agentId ?? 0);
    return;
  }

  if (type === "read") {
    const sessionId = Number(msg.sessionId);
    const [session] = await db
      .select({ agentId: sessionsTable.agentId })
      .from(sessionsTable)
      .where(eq(sessionsTable.id, sessionId));

    const readState = await markAgentReadSession(sessionId);
    if (session) {
      broadcastReadState(sessionId, readState, session.agentId ?? 0);
    }
    return;
  }

  safeSend(ws, { type: "error", error: `Unknown message type: ${type}` });
}

function safeSend(ws: WebSocket, data: unknown): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

function broadcastToSessionOwner(ownerId: number, data: unknown): void {
  for (const [ws, info] of clients) {
    if (info.type === "agent") {
      if (info.role === "super_admin" || info.agentId === ownerId) {
        safeSend(ws, data);
      }
    }
  }
}

function broadcastToSessionVisitor(sessionId: number, data: unknown): void {
  for (const [ws, info] of clients) {
    if (info.type === "visitor" && info.sessionId === sessionId) {
      safeSend(ws, data);
    }
  }
}

function broadcastAgentPresence(agentId: number, isOnline: boolean): void {
  const payload = { type: "agent_presence", agentId, isOnline };
  for (const [ws, info] of clients) {
    if (info.type === "visitor" && info.agentId === agentId) {
      safeSend(ws, payload);
    }
  }
}

export function broadcastReadState(
  sessionId: number,
  readState: SessionReadState,
  ownerId: number,
): void {
  const payload = {
    type: "read_state",
    sessionId,
    lastMessageId: readState.lastMessageId,
    agentLastReadMsgId: readState.agentLastReadMsgId,
    visitorLastReadMsgId: readState.visitorLastReadMsgId,
    agentUnread: readState.agentUnread,
    visitorUnread: readState.visitorUnread,
  };
  broadcastToSessionVisitor(sessionId, payload);
  broadcastToSessionOwner(ownerId, payload);

  const legacyPayload = {
    type: "unread_update" as const,
    sessionId,
    agentUnread: readState.agentUnread,
    visitorUnread: readState.visitorUnread,
  };
  broadcastToSessionVisitor(sessionId, legacyPayload);
  broadcastToSessionOwner(ownerId, legacyPayload);
}

/** Legacy stub — visitor online uses sessions.last_seen_at; agent uses agents.last_seen_at */
export function getOnlineSessionIds(): Set<number> {
  return new Set<number>();
}

export function broadcastSessionTransfer(
  sessionId: number,
  newAgentId: number,
  fromAgentId: number,
): void {
  for (const [, info] of clients) {
    if (info.type === "visitor" && info.sessionId === sessionId) {
      info.agentId = newAgentId;
    }
  }

  const payload = {
    type: "session_transfer",
    sessionId,
    newAgentId,
    fromAgentId,
  };

  for (const [ws, info] of clients) {
    if (info.type === "agent") {
      if (info.role === "super_admin" || info.agentId === newAgentId || info.agentId === fromAgentId) {
        safeSend(ws, payload);
      }
    }
    if (info.type === "visitor" && info.sessionId === sessionId) {
      safeSend(ws, payload);
    }
  }
}
