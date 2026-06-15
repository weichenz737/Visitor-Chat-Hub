import { WebSocketServer, WebSocket } from "ws";
import { IncomingMessage } from "http";
import { db } from "@workspace/db";
import { messagesTable, sessionsTable } from "@workspace/db";
import { eq, and, isNull } from "drizzle-orm";
import { verifyToken } from "./auth";
import { logger } from "./logger";

interface ClientInfo {
  type: "visitor" | "agent" | "unknown";
  sessionId?: number;
  agentId?: number;
  role?: string;
  visitorNickname?: string;
}

const clients = new Map<WebSocket, ClientInfo>();

export function createWebSocketServer(): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true });

  wss.on("connection", (ws: WebSocket, _req: IncomingMessage) => {
    clients.set(ws, { type: "unknown" });
    logger.info("WebSocket client connected");

    const heartbeatInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      }
    }, 30000);

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
      const info = clients.get(ws);
      if (info?.type === "visitor" && info.sessionId) {
        await db
          .update(sessionsTable)
          .set({ lastSeenAt: new Date() })
          .where(eq(sessionsTable.id, info.sessionId));

        // Notify only the session owner (and super_admins)
        const [session] = await db
          .select({ agentId: sessionsTable.agentId })
          .from(sessionsTable)
          .where(eq(sessionsTable.id, info.sessionId));

        if (session) {
          broadcastToSessionOwner(session.agentId ?? 0, {
            type: "session_update",
            sessionId: info.sessionId,
            isOnline: false,
          });
        }
      }
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

async function handleMessage(ws: WebSocket, msg: Record<string, unknown>): Promise<void> {
  const type = msg.type as string;

  if (type === "ping") {
    const info = clients.get(ws);
    if (info?.type === "visitor" && info.sessionId) {
      await db
        .update(sessionsTable)
        .set({ lastSeenAt: new Date() })
        .where(eq(sessionsTable.id, info.sessionId));
    }
    safeSend(ws, { type: "pong" });
    return;
  }

  if (type === "visitor_connect") {
    const sessionId = Number(msg.sessionId);
    const visitorNickname = String(msg.visitorNickname ?? "");
    clients.set(ws, { type: "visitor", sessionId, visitorNickname });

    await db
      .update(sessionsTable)
      .set({ lastSeenAt: new Date() })
      .where(eq(sessionsTable.id, sessionId));

    // Notify only the session owner (and super_admins)
    const [session] = await db
      .select({ agentId: sessionsTable.agentId })
      .from(sessionsTable)
      .where(eq(sessionsTable.id, sessionId));

    if (session) {
      broadcastToSessionOwner(session.agentId ?? 0, {
        type: "session_update",
        sessionId,
        isOnline: true,
      });
    }

    logger.info({ sessionId, visitorNickname }, "Visitor connected");
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
    logger.info({ agentId: payload.userId, role: payload.role }, "Agent connected via WS");
    return;
  }

  if (type === "message") {
    const info = clients.get(ws);
    const sessionId = Number(msg.sessionId);
    const senderType = String(msg.senderType ?? "");
    const messageType = String(msg.messageType ?? "text");
    const content = String(msg.content ?? "");
    const imageUrl = msg.imageUrl ? String(msg.imageUrl) : null;

    if (!sessionId || !senderType || content == null) {
      safeSend(ws, { type: "error", error: "Missing required fields" });
      return;
    }

    // Resolve ownerId from the session for data isolation
    const [session] = await db
      .select({ agentId: sessionsTable.agentId })
      .from(sessionsTable)
      .where(eq(sessionsTable.id, sessionId));

    const ownerId = session?.agentId ?? undefined;

    const [savedMessage] = await db
      .insert(messagesTable)
      .values({ sessionId, ownerId, senderType, messageType, content, imageUrl: imageUrl ?? undefined })
      .returning();

    if (senderType === "visitor") {
      await db
        .update(sessionsTable)
        .set({ status: "waiting", lastSeenAt: new Date() })
        .where(and(eq(sessionsTable.id, sessionId), eq(sessionsTable.status, "closed")));
    } else if (senderType === "agent") {
      await db
        .update(sessionsTable)
        .set({ status: "active" })
        .where(eq(sessionsTable.id, sessionId));
    }

    // Send to the visitor side of this session
    broadcastToSessionVisitor(sessionId, { type: "message", message: savedMessage });

    // Echo back to the sender
    safeSend(ws, { type: "message", message: savedMessage });

    // Notify only the session owner agent(s) (and super_admins)
    if (info?.type !== "agent") {
      // Visitor sent a message — notify the owning agent
      broadcastToSessionOwner(ownerId ?? 0, { type: "message", message: savedMessage });
    }

    broadcastToSessionOwner(ownerId ?? 0, {
      type: "session_update",
      sessionId,
      lastMessage: messageType === "image" ? "📷 圖片" : content,
      lastMessageAt: new Date().toISOString(),
    });
    return;
  }

  if (type === "read") {
    const sessionId = Number(msg.sessionId);
    const now = new Date();
    await db
      .update(messagesTable)
      .set({ readAt: now })
      .where(and(eq(messagesTable.sessionId, sessionId), isNull(messagesTable.readAt)));
    broadcastToSessionVisitor(sessionId, { type: "read_receipt", sessionId, readAt: now.toISOString() });
    return;
  }

  safeSend(ws, { type: "error", error: `Unknown message type: ${type}` });
}

function safeSend(ws: WebSocket, data: unknown): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

/**
 * Broadcast to agents who own the session (agentId match) OR are super_admin.
 * ownerId=0 means no owner — super_admins still receive it.
 */
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

export function broadcastReadReceiptToSession(sessionId: number, readAt: string): void {
  broadcastToSessionVisitor(sessionId, { type: "read_receipt", sessionId, readAt });
}

export function getOnlineSessionIds(): Set<number> {
  const online = new Set<number>();
  for (const info of clients.values()) {
    if (info.type === "visitor" && info.sessionId) {
      online.add(info.sessionId);
    }
  }
  return online;
}
