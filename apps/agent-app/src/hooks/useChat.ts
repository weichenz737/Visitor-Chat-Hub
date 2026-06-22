import { useState, useEffect, useRef, useCallback } from "react";

export interface ChatMessage {
  id: number;
  sessionId: number;
  senderType: "visitor" | "agent";
  messageType: "text" | "image" | "file";
  content: string;
  imageUrl?: string | null;
  fileUrl?: string | null;
  fileName?: string | null;
  fileSize?: number | null;
  mimeType?: string | null;
  createdAt: string;
}

export interface SessionReadStatePayload {
  sessionId: number;
  lastMessageId: number;
  agentLastReadMsgId: number;
  visitorLastReadMsgId: number;
  agentUnread: number;
  visitorUnread: number;
}

interface UseChatOptions {
  sessionId?: number;
  visitorNickname?: string;
  agentToken?: string;
  onMessage?: (msg: ChatMessage) => void;
  onError?: (error: string) => void;
  onSessionUpdate?: (data: unknown) => void;
  onUnreadUpdate?: (data: Pick<SessionReadStatePayload, "sessionId" | "agentUnread" | "visitorUnread">) => void;
  onSessionTransfer?: (data: { sessionId: number; newAgentId: number; fromAgentId: number }) => void;
}

const HEARTBEAT_MS = 12_000;

function buildWsUrl(): string {
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}/ws`;
}

function parseReadState(data: Record<string, unknown>): SessionReadStatePayload | null {
  const sessionId = Number(data.sessionId);
  if (!Number.isInteger(sessionId) || sessionId <= 0) return null;
  return {
    sessionId,
    lastMessageId: Number(data.lastMessageId ?? 0),
    agentLastReadMsgId: Number(data.agentLastReadMsgId ?? 0),
    visitorLastReadMsgId: Number(data.visitorLastReadMsgId ?? 0),
    agentUnread: Number(data.agentUnread ?? 0),
    visitorUnread: Number(data.visitorUnread ?? 0),
  };
}

export function useChat(options: UseChatOptions) {
  const {
    sessionId,
    visitorNickname,
    agentToken,
    onMessage,
    onError,
    onSessionUpdate,
    onUnreadUpdate,
    onSessionTransfer,
  } = options;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectDelayRef = useRef(1000);
  const mountedRef = useRef(true);

  const connect = useCallback(() => {
    if (!mountedRef.current) return;
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(buildWsUrl());
    wsRef.current = ws;

    ws.onopen = () => {
      if (!mountedRef.current) {
        ws.close();
        return;
      }
      setIsConnected(true);
      setIsReconnecting(false);
      reconnectDelayRef.current = 1000;

      if (sessionId && visitorNickname) {
        ws.send(JSON.stringify({ type: "visitor_connect", sessionId, visitorNickname }));
      } else if (agentToken) {
        ws.send(JSON.stringify({ type: "agent_connect", token: agentToken }));
      }

      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      heartbeatRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "ping" }));
        }
      }, HEARTBEAT_MS);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === "message" && data.message) {
          const msg = data.message as ChatMessage;
          setMessages((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
          onMessage?.(msg);
        } else if (data.type === "error") {
          onError?.(String(data.error ?? "消息发送失败"));
        } else if (data.type === "read_state") {
          const state = parseReadState(data as Record<string, unknown>);
          if (state) {
            onUnreadUpdate?.({
              sessionId: state.sessionId,
              agentUnread: state.agentUnread,
              visitorUnread: state.visitorUnread,
            });
          }
        } else if (data.type === "unread_update") {
          const state = parseReadState(data as Record<string, unknown>);
          if (state) {
            onUnreadUpdate?.({
              sessionId: state.sessionId,
              agentUnread: state.agentUnread,
              visitorUnread: state.visitorUnread,
            });
          }
        } else if (data.type === "session_update") {
          onSessionUpdate?.(data);
        } else if (data.type === "session_transfer") {
          const sessionId = Number(data.sessionId);
          const newAgentId = Number(data.newAgentId);
          const fromAgentId = Number(data.fromAgentId);
          if (sessionId && newAgentId) {
            onSessionTransfer?.({ sessionId, newAgentId, fromAgentId });
          }
        }
      } catch {
        // ignore parse errors
      }
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;
      setIsConnected(false);
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);

      const delay = Math.min(reconnectDelayRef.current, 30000);
      reconnectDelayRef.current = Math.min(delay * 2, 30000);
      setIsReconnecting(true);
      reconnectTimeoutRef.current = setTimeout(() => {
        if (mountedRef.current) connect();
      }, delay);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [sessionId, visitorNickname, agentToken, onMessage, onError, onSessionUpdate, onUnreadUpdate, onSessionTransfer]);

  useEffect(() => {
    mountedRef.current = true;
    connect();

    return () => {
      mountedRef.current = false;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const sendTextMessage = useCallback(
    (content: string, targetSessionId?: number) => {
      const sid = targetSessionId ?? sessionId;
      if (!sid || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
      const senderType = agentToken ? "agent" : "visitor";
      wsRef.current.send(
        JSON.stringify({ type: "message", sessionId: sid, senderType, messageType: "text", content }),
      );
    },
    [sessionId, agentToken],
  );

  const sendImageMessage = useCallback(
    (imageUrl: string, targetSessionId?: number) => {
      const sid = targetSessionId ?? sessionId;
      if (!sid || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
      const senderType = agentToken ? "agent" : "visitor";
      wsRef.current.send(
        JSON.stringify({
          type: "message",
          sessionId: sid,
          senderType,
          messageType: "image",
          content: "[image]",
          imageUrl,
        }),
      );
    },
    [sessionId, agentToken],
  );

  const sendFileMessage = useCallback(
    (
      payload: { fileUrl: string; fileName: string; fileSize: number; mimeType: string },
      targetSessionId?: number,
    ) => {
      const sid = targetSessionId ?? sessionId;
      if (!sid || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return false;
      const senderType = agentToken ? "agent" : "visitor";
      wsRef.current.send(
        JSON.stringify({
          type: "message",
          sessionId: sid,
          senderType,
          messageType: "file",
          content: payload.fileName,
          fileUrl: payload.fileUrl,
          fileName: payload.fileName,
          fileSize: payload.fileSize,
          mimeType: payload.mimeType,
        }),
      );
      return true;
    },
    [sessionId, agentToken],
  );

  const sendVisitorRead = useCallback(() => {
    if (!sessionId || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ type: "visitor_read", sessionId }));
  }, [sessionId]);

  const sendAgentRead = useCallback(
    (targetSessionId: number) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
      wsRef.current.send(JSON.stringify({ type: "agent_read", sessionId: targetSessionId }));
    },
    [],
  );

  const addMessages = useCallback((msgs: ChatMessage[]) => {
    setMessages(msgs);
  }, []);

  return {
    messages,
    isConnected,
    isReconnecting,
    sendTextMessage,
    sendImageMessage,
    sendFileMessage,
    sendVisitorRead,
    sendAgentRead,
    addMessages,
  };
}

export type { SessionReadStatePayload as UnreadUpdatePayload };
