import { useState, useEffect, useRef, useCallback } from "react";

export interface ChatMessage {
  id: number;
  sessionId: number;
  senderType: "visitor" | "agent";
  messageType: "text" | "image";
  content: string;
  imageUrl?: string | null;
  createdAt: string;
  readAt?: string | null;
}

interface UseChatOptions {
  sessionId?: number;
  visitorNickname?: string;
  agentToken?: string;
  onMessage?: (msg: ChatMessage) => void;
  onSessionUpdate?: (data: unknown) => void;
  onReadReceipt?: (sessionId: number, readAt: string) => void;
}

function buildWsUrl(): string {
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}/ws`;
}

export function useChat(options: UseChatOptions) {
  const { sessionId, visitorNickname, agentToken, onMessage, onSessionUpdate, onReadReceipt } = options;
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
      if (!mountedRef.current) { ws.close(); return; }
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
      }, 30000);
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

        } else if (data.type === "read_receipt") {
          // Update all unread messages in this session as read
          const receiptSessionId = data.sessionId as number;
          const readAt = data.readAt as string;
          setMessages((prev) =>
            prev.map((m) =>
              m.sessionId === receiptSessionId && !m.readAt
                ? { ...m, readAt }
                : m
            )
          );
          onReadReceipt?.(receiptSessionId, readAt);

        } else if (data.type === "session_update") {
          onSessionUpdate?.(data);
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
  }, [sessionId, visitorNickname, agentToken, onMessage, onSessionUpdate, onReadReceipt]);

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
        JSON.stringify({ type: "message", sessionId: sid, senderType, messageType: "text", content })
      );
    },
    [sessionId, agentToken]
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
        })
      );
    },
    [sessionId, agentToken]
  );

  const addMessages = useCallback((msgs: ChatMessage[]) => {
    setMessages(msgs);
  }, []);

  return { messages, isConnected, isReconnecting, sendTextMessage, sendImageMessage, addMessages };
}
