import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import {
  useListSessions,
  useGetSessionMessages,
  useGetSessionStats,
  useMarkSessionRead,
  getListSessionsQueryKey,
  getGetSessionStatsQueryKey,
  getGetSessionMessagesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useChat, type ChatMessage } from "@/hooks/useChat";
import { useImageUpload } from "@/hooks/useImageUpload";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Send,
  Image,
  LogOut,
  Users,
  MessageSquare,
  Wifi,
  WifiOff,
  Circle,
  RefreshCw,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

interface SessionSummary {
  id: number;
  visitorNickname: string;
  status: string;
  createdAt: string;
  lastSeenAt: string | null;
  unreadCount: number;
  isOnline: boolean;
  lastMessage: string | null;
  lastMessageAt: string | null;
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isAgent = message.senderType === "agent";
  const [showLightbox, setShowLightbox] = useState(false);

  return (
    <>
      <div className={`flex ${isAgent ? "justify-end" : "justify-start"} mb-3`}>
        <div className={`max-w-[70%] flex flex-col ${isAgent ? "items-end" : "items-start"}`}>
          {!isAgent && (
            <span className="text-xs text-muted-foreground mb-1 ml-1 font-medium">Visitor</span>
          )}
          <div
            className={`rounded-2xl px-4 py-2.5 shadow-sm ${
              isAgent
                ? "bg-primary text-primary-foreground rounded-br-sm"
                : "bg-card border border-border text-foreground rounded-bl-sm"
            }`}
          >
            {message.messageType === "image" && message.imageUrl ? (
              <img
                src={message.imageUrl}
                alt="Shared image"
                className="max-w-full rounded-lg cursor-pointer max-h-40 object-contain"
                onClick={() => setShowLightbox(true)}
                data-testid={`img-agent-message-${message.id}`}
              />
            ) : (
              <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{message.content}</p>
            )}
          </div>
          <span className="text-xs text-muted-foreground mt-1 mx-1">
            {format(new Date(message.createdAt), "HH:mm")}
            {message.readAt && isAgent && (
              <span className="ml-1 text-primary/70">Read</span>
            )}
          </span>
        </div>
      </div>

      {showLightbox && message.imageUrl && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setShowLightbox(false)}
        >
          <img src={message.imageUrl} alt="Full size" className="max-w-full max-h-full rounded-lg" />
        </div>
      )}
    </>
  );
}

function SessionListItem({
  session,
  isActive,
  onClick,
}: {
  session: SessionSummary;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <div
      data-testid={`card-session-${session.id}`}
      onClick={onClick}
      className={`px-4 py-3 cursor-pointer transition-colors border-b border-border/50 ${
        isActive ? "bg-primary/10 border-l-2 border-l-primary" : "hover:bg-accent/40"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="relative flex-shrink-0">
            <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center">
              <span className="text-sm font-semibold text-primary">
                {session.visitorNickname.charAt(0).toUpperCase()}
              </span>
            </div>
            {session.isOnline && (
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-500 border-2 border-background" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground truncate">{session.visitorNickname}</p>
              {session.lastMessageAt && (
                <span className="text-xs text-muted-foreground flex-shrink-0 ml-1">
                  {formatDistanceToNow(new Date(session.lastMessageAt), { addSuffix: false })}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {session.lastMessage ?? "No messages yet"}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          {session.unreadCount > 0 && (
            <Badge
              data-testid={`badge-unread-${session.id}`}
              className="h-5 min-w-5 text-xs px-1.5 bg-primary text-primary-foreground rounded-full"
            >
              {session.unreadCount}
            </Badge>
          )}
          <Badge
            variant="outline"
            className={`text-xs h-5 ${
              session.status === "active"
                ? "text-green-600 border-green-300"
                : session.status === "waiting"
                ? "text-amber-600 border-amber-300"
                : "text-muted-foreground"
            }`}
          >
            {session.status}
          </Badge>
        </div>
      </div>
    </div>
  );
}

export default function AgentDashboard() {
  const [, setLocation] = useLocation();
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [inputText, setInputText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { uploadImage, isUploading } = useImageUpload();

  const agentToken = localStorage.getItem("agent_token");
  const agentUsername = localStorage.getItem("agent_username") ?? "Agent";

  useEffect(() => {
    if (!agentToken) {
      setLocation("/agent");
    }
  }, [agentToken, setLocation]);

  const { data: sessions = [], isLoading: sessionsLoading } = useListSessions({
    query: { refetchInterval: 3000, queryKey: getListSessionsQueryKey() },
  });

  const { data: stats } = useGetSessionStats({
    query: { refetchInterval: 5000, queryKey: getGetSessionStatsQueryKey() },
  });

  const { data: history } = useGetSessionMessages(selectedSessionId ?? 0, {
    query: {
      enabled: !!selectedSessionId,
      queryKey: getGetSessionMessagesQueryKey(selectedSessionId ?? 0),
    },
  });

  const markRead = useMarkSessionRead();

  const onMessage = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: getListSessionsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetSessionStatsQueryKey() });
    if (selectedSessionId) {
      queryClient.invalidateQueries({ queryKey: getGetSessionMessagesQueryKey(selectedSessionId) });
    }
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }, [queryClient, selectedSessionId]);

  const onSessionUpdate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: getListSessionsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetSessionStatsQueryKey() });
  }, [queryClient]);

  const { messages, isConnected, isReconnecting, sendTextMessage, sendImageMessage, addMessages } =
    useChat({ agentToken: agentToken ?? undefined, onMessage, onSessionUpdate });

  // Load history when session selected
  useEffect(() => {
    if (history) {
      addMessages(history as ChatMessage[]);
    }
  }, [history, addMessages]);

  // Scroll to bottom on session change
  useEffect(() => {
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  }, [selectedSessionId]);

  const handleSelectSession = (sessionId: number) => {
    setSelectedSessionId(sessionId);
    setInputText("");
    markRead.mutate(
      { id: sessionId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListSessionsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetSessionStatsQueryKey() });
        },
      }
    );
  };

  const sessionMessages = selectedSessionId
    ? messages.filter((m) => m.sessionId === selectedSessionId)
    : [];

  const handleSend = () => {
    const text = inputText.trim();
    if (!text || !selectedSessionId) return;
    sendTextMessage(text, selectedSessionId);
    setInputText("");
    queryClient.invalidateQueries({ queryKey: getListSessionsQueryKey() });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleImagePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedSessionId) return;
    const url = await uploadImage(file);
    if (url) sendImageMessage(url, selectedSessionId);
    e.target.value = "";
    queryClient.invalidateQueries({ queryKey: getListSessionsQueryKey() });
  };

  const handleLogout = () => {
    localStorage.removeItem("agent_token");
    localStorage.removeItem("agent_username");
    localStorage.removeItem("agent_id");
    setLocation("/agent");
  };

  const selectedSession = (sessions as SessionSummary[]).find((s) => s.id === selectedSessionId);

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <div className="w-80 flex-shrink-0 border-r border-border flex flex-col bg-card">
        {/* Sidebar Header */}
        <div className="px-4 py-4 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="font-bold text-foreground">Support Dashboard</h1>
              <p className="text-xs text-muted-foreground mt-0.5">{agentUsername}</p>
            </div>
            <Button
              data-testid="button-logout"
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-muted-foreground hover:text-foreground"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>

          {/* Stats row */}
          {stats && (
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-background rounded-lg px-2 py-1.5 text-center">
                <p className="text-lg font-bold text-foreground leading-none">{stats.total}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Total</p>
              </div>
              <div className="bg-background rounded-lg px-2 py-1.5 text-center">
                <p className="text-lg font-bold text-green-600 leading-none">{stats.online}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Online</p>
              </div>
              <div className="bg-background rounded-lg px-2 py-1.5 text-center">
                <p className="text-lg font-bold text-amber-600 leading-none">{stats.unreadTotal}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Unread</p>
              </div>
            </div>
          )}
        </div>

        {/* WS Status */}
        <div className="px-4 py-2 border-b border-border/50 flex items-center gap-2">
          {isReconnecting ? (
            <>
              <RefreshCw className="w-3 h-3 text-amber-500 animate-spin" />
              <span className="text-xs text-amber-500">Reconnecting...</span>
            </>
          ) : isConnected ? (
            <>
              <Wifi className="w-3 h-3 text-green-500" />
              <span className="text-xs text-green-500">Live</span>
            </>
          ) : (
            <>
              <WifiOff className="w-3 h-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Offline</span>
            </>
          )}
        </div>

        {/* Session List */}
        <div className="flex-1 overflow-y-auto">
          {sessionsLoading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-14 bg-muted/50 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : (sessions as SessionSummary[]).length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full p-6 text-center">
              <Users className="w-8 h-8 text-muted-foreground/50 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">No visitors yet</p>
              <p className="text-xs text-muted-foreground/70 mt-1">Sessions will appear here</p>
            </div>
          ) : (
            (sessions as SessionSummary[]).map((session) => (
              <SessionListItem
                key={session.id}
                session={session}
                isActive={session.id === selectedSessionId}
                onClick={() => handleSelectSession(session.id)}
              />
            ))
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {!selectedSessionId ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
              <MessageSquare className="w-8 h-8 text-primary/60" />
            </div>
            <h2 className="text-xl font-semibold text-foreground">Select a conversation</h2>
            <p className="text-muted-foreground text-sm mt-2 max-w-xs">
              Choose a visitor from the list to start responding to their messages.
            </p>
          </div>
        ) : (
          <>
            {/* Chat Header */}
            <div className="flex items-center gap-3 px-6 py-4 bg-card border-b border-border">
              <div className="relative">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <span className="text-sm font-semibold text-primary">
                    {selectedSession?.visitorNickname.charAt(0).toUpperCase() ?? "?"}
                  </span>
                </div>
                {selectedSession?.isOnline && (
                  <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-500 border-2 border-background" />
                )}
              </div>
              <div>
                <h2 className="font-semibold text-foreground">
                  {selectedSession?.visitorNickname ?? "Visitor"}
                </h2>
                <div className="flex items-center gap-1.5">
                  <Circle
                    className={`w-2 h-2 fill-current ${
                      selectedSession?.isOnline ? "text-green-500" : "text-muted-foreground"
                    }`}
                  />
                  <span className="text-xs text-muted-foreground">
                    {selectedSession?.isOnline
                      ? "Online"
                      : selectedSession?.lastSeenAt
                      ? `Last seen ${formatDistanceToNow(new Date(selectedSession.lastSeenAt), { addSuffix: true })}`
                      : "Offline"}
                  </span>
                </div>
              </div>
              <div className="ml-auto">
                <Badge
                  variant="outline"
                  className={`${
                    selectedSession?.status === "active"
                      ? "text-green-600 border-green-300"
                      : selectedSession?.status === "waiting"
                      ? "text-amber-600 border-amber-300"
                      : "text-muted-foreground"
                  }`}
                >
                  {selectedSession?.status}
                </Badge>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-6 py-4 bg-background">
              {sessionMessages.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <MessageSquare className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">No messages yet</p>
                  </div>
                </div>
              ) : (
                sessionMessages.map((msg) => (
                  <MessageBubble key={msg.id} message={msg} />
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="px-6 py-4 bg-card border-t border-border">
              <div className="flex items-end gap-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImagePick}
                  data-testid="input-agent-image-file"
                />
                <button
                  data-testid="button-agent-image-upload"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading || !isConnected}
                  className="p-2.5 rounded-xl border border-border hover:bg-accent/50 transition-colors text-muted-foreground disabled:opacity-50"
                >
                  <Image className="w-5 h-5" />
                </button>
                <Textarea
                  data-testid="input-agent-message"
                  placeholder={`Reply to ${selectedSession?.visitorNickname ?? "visitor"}...`}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="flex-1 min-h-[44px] max-h-32 resize-none rounded-xl text-sm"
                  rows={1}
                />
                <Button
                  data-testid="button-agent-send"
                  onClick={handleSend}
                  disabled={!inputText.trim() || !isConnected}
                  className="p-2.5 h-auto rounded-xl"
                >
                  <Send className="w-5 h-5" />
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
