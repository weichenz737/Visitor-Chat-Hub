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
        broadcastToAgents({ type: "session_update", sessionId: info.sessionId, isOnline: false });
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
    // Update lastSeenAt for visitors on each ping to track activity
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

    broadcastToAgents({ type: "session_update", sessionId, isOnline: true });
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
    clients.set(ws, { type: "agent", agentId: payload.agentId });
    logger.info({ agentId: payload.agentId }, "Agent connected via WS");
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

    const [savedMessage] = await db
      .insert(messagesTable)
      .values({ sessionId, senderType, messageType, content, imageUrl: imageUrl ?? undefined })
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

    broadcastToSession(sessionId, { type: "message", message: savedMessage }, info?.type === "visitor" ? "agent" : "visitor");
    safeSend(ws, { type: "message", message: savedMessage });

    broadcastToAgents({ type: "session_update", sessionId, lastMessage: content, lastMessageAt: new Date().toISOString() });
    return;
  }

  if (type === "read") {
    const sessionId = Number(msg.sessionId);
    const now = new Date();
    await db
      .update(messagesTable)
      .set({ readAt: now })
      .where(and(eq(messagesTable.sessionId, sessionId), isNull(messagesTable.readAt)));
    // Notify visitor their messages were read
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

function broadcastToAgents(data: unknown): void {
  for (const [ws, info] of clients) {
    if (info.type === "agent") {
      safeSend(ws, data);
    }
  }
}

function broadcastToSession(sessionId: number, data: unknown, targetType: "visitor" | "agent"): void {
  for (const [ws, info] of clients) {
    if (targetType === "visitor" && info.type === "visitor" && info.sessionId === sessionId) {
      safeSend(ws, data);
    } else if (targetType === "agent" && info.type === "agent") {
      safeSend(ws, data);
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
