import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { openAdminApp } from "@/lib/agent-chat-link";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  useGetSessionMessages,
  useMarkSessionRead,
  useAdminListAgents,
  useGetAgentMe,
  getGetSessionMessagesQueryKey,
  getAdminListAgentsQueryKey,
  getGetAgentMeQueryKey,
  listSessionsFiltered,
  getSessionStatsFiltered,
  getSessionsQueryKey,
  getSessionStatsQueryKey,
  getSessionNotes,
  getSessionNotesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useChat, type ChatMessage } from "@/hooks/useChat";
import { useImageUpload } from "@/hooks/useImageUpload";
import { useFileUpload } from "@/hooks/useFileUpload";
import { FileMessageCard } from "@/components/FileMessageCard";
import { FileUploadProgressBar } from "@/components/FileUploadProgressBar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AgentChatLinkCard } from "@/components/AgentChatLinkCard";
import { QuickReplyPicker } from "@/components/QuickReplyPicker";
import { SessionNotePanel } from "@/components/SessionNotePanel";
import { SessionTransferPanel } from "@/components/SessionTransferPanel";
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
  Crown,
  Download,
  ExternalLink,
  User,
  StickyNote,
  ArrowRightLeft,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { zhTW } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";

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
  agentId?: number | null;
  agentDisplayName?: string | null;
  agentAvatarUrl?: string | null;
  agentIsActive?: boolean | null;
  hasNote?: boolean;
  agentAccess?: "owner" | "readonly" | "super_admin";
}

interface AdminAgent {
  id: number;
  username: string;
  role: string;
  displayName: string;
  avatarUrl?: string | null;
  introduction?: string | null;
  isActive: boolean;
  createdAt: string;
}

// ─── Message Bubble ──────────────────────────────────────────────────────────

function MessageBubble({ message }: { message: ChatMessage }) {
  const isAgent = message.senderType === "agent";
  const [showLightbox, setShowLightbox] = useState(false);
  return (
    <>
      <div className={`flex ${isAgent ? "justify-end" : "justify-start"} mb-3`}>
        <div className={`max-w-[70%] flex flex-col ${isAgent ? "items-end" : "items-start"}`}>
          {!isAgent && (
            <span className="text-xs text-muted-foreground mb-1 ml-1 font-medium">訪客</span>
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
                alt="共享圖片"
                className="max-w-full rounded-lg cursor-pointer max-h-40 object-contain"
                onClick={() => setShowLightbox(true)}
                onError={(e) => {
                  const el = e.target as HTMLImageElement;
                  el.style.display = "none";
                  el.parentElement!.innerHTML = '<span style="font-size:12px;opacity:0.6">圖片已失效</span>';
                }}
              />
            ) : message.messageType === "file" && message.fileUrl && message.fileName ? (
              <FileMessageCard
                fileUrl={message.fileUrl}
                fileName={message.fileName}
                fileSize={message.fileSize}
                mimeType={message.mimeType}
                inverted={isAgent}
              />
            ) : (
              <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{message.content}</p>
            )}
          </div>
          <div className="flex items-center mt-1 mx-1">
            <span className="text-xs text-muted-foreground">
              {format(new Date(message.createdAt), "HH:mm")}
            </span>
          </div>
        </div>
      </div>
      {showLightbox && message.imageUrl && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setShowLightbox(false)}
        >
          <img src={message.imageUrl} alt="原始圖片" className="max-w-full max-h-full rounded-lg" />
        </div>
      )}
    </>
  );
}

// ─── Session List Item ────────────────────────────────────────────────────────

function SessionListItem({
  session,
  isActive,
  onClick,
  showAgentInfo,
}: {
  session: SessionSummary;
  isActive: boolean;
  onClick: () => void;
  showAgentInfo?: boolean;
}) {
  const statusLabel: Record<string, string> = {
    waiting: "等待中",
    active: "進行中",
    closed: "已結束",
  };
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
                  {formatDistanceToNow(new Date(session.lastMessageAt), { addSuffix: false, locale: zhTW })}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {session.lastMessage ?? "尚無訊息"}
            </p>
            {showAgentInfo && (
              <p className="text-xs text-primary/80 truncate mt-0.5">
                所属客服：{session.agentDisplayName ?? "—"}（ID {session.agentId ?? "—"}）
                {session.agentIsActive === false ? " · 已停用" : session.isOnline ? "" : " · 離線"}
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          {session.hasNote && (
            <StickyNote className="w-3.5 h-3.5 text-amber-600" title="已有備註" />
          )}
          {session.agentAccess === "readonly" && (
            <Badge variant="outline" className="text-[10px] h-4 px-1 text-muted-foreground">
              只读
            </Badge>
          )}
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
            {statusLabel[session.status] ?? session.status}
          </Badge>
        </div>
      </div>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function AgentDashboard() {
  const [, setLocation] = useLocation();
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [showTransferPanel, setShowTransferPanel] = useState(false);
  const [filterAgentId, setFilterAgentId] = useState<number | "all">("all");
  const [inputText, setInputText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const openingAdminRef = useRef(false);
  const queryClient = useQueryClient();
  const { uploadImage, isUploading: isUploadingImage } = useImageUpload();
  const { uploadFile, isUploading: isUploadingFile, uploadProgress, cancelUpload, clearUploadProgress } =
    useFileUpload();
  const isUploading = isUploadingImage || isUploadingFile;
  const { toast } = useToast();

  const agentToken = localStorage.getItem("agent_token");
  const agentUsername = localStorage.getItem("agent_username") ?? "客服人員";
  const agentRole = localStorage.getItem("agent_role") ?? "agent";
  const agentIdStored = Number(localStorage.getItem("agent_id") ?? "0");
  const isSuperAdmin = agentRole === "super_admin";

  const { data: agentMe } = useGetAgentMe({
    query: { enabled: !!agentToken, queryKey: getGetAgentMeQueryKey() },
  });
  const headerDisplayName = agentMe?.displayName || agentUsername;
  const headerAvatarUrl = agentMe?.avatarUrl ?? null;

  const sessionFilterParams = useMemo(
    () => (isSuperAdmin && filterAgentId !== "all" ? { agentId: filterAgentId } : undefined),
    [isSuperAdmin, filterAgentId],
  );

  const { data: adminAgents = [] } = useAdminListAgents({
    query: { enabled: isSuperAdmin, queryKey: getAdminListAgentsQueryKey() },
  });

  const receptionAgents = useMemo(
    () => (adminAgents as AdminAgent[]).filter((a) => a.role === "agent"),
    [adminAgents],
  );

  useEffect(() => {
    if (!agentToken) setLocation("/agent");
  }, [agentToken, setLocation]);

  const { data: sessions = [], isLoading: sessionsLoading } = useQuery({
    queryKey: getSessionsQueryKey(sessionFilterParams),
    queryFn: () => listSessionsFiltered(sessionFilterParams),
    refetchInterval: 3000,
    enabled: !!agentToken,
  });

  const { data: stats } = useQuery({
    queryKey: getSessionStatsQueryKey(sessionFilterParams),
    queryFn: () => getSessionStatsFiltered(sessionFilterParams),
    refetchInterval: 5000,
    enabled: !!agentToken,
  });

  const { data: history } = useGetSessionMessages(selectedSessionId ?? 0, undefined, {
    query: {
      enabled: !!selectedSessionId,
      queryKey: getGetSessionMessagesQueryKey(selectedSessionId ?? 0),
    },
  });

  const markRead = useMarkSessionRead();

  const onMessage = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: getSessionsQueryKey(sessionFilterParams) });
    queryClient.invalidateQueries({ queryKey: getSessionStatsQueryKey(sessionFilterParams) });
    if (selectedSessionId)
      queryClient.invalidateQueries({ queryKey: getGetSessionMessagesQueryKey(selectedSessionId) });
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }, [queryClient, selectedSessionId, sessionFilterParams]);

  const onSessionUpdate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: getSessionsQueryKey(sessionFilterParams) });
    queryClient.invalidateQueries({ queryKey: getSessionStatsQueryKey(sessionFilterParams) });
  }, [queryClient, sessionFilterParams]);

  const onSessionTransfer = useCallback(
    (data: { sessionId: number; newAgentId: number; fromAgentId: number }) => {
      queryClient.invalidateQueries({ queryKey: getSessionsQueryKey(sessionFilterParams) });
      queryClient.invalidateQueries({ queryKey: getSessionStatsQueryKey(sessionFilterParams) });
      if (data.sessionId === selectedSessionId && data.fromAgentId === agentIdStored) {
        setShowTransferPanel(false);
      }
    },
    [queryClient, sessionFilterParams, selectedSessionId, agentIdStored],
  );

  const onUnreadUpdate = useCallback(
    (data: { sessionId: number; agentUnread: number; visitorUnread: number }) => {
      queryClient.setQueryData(
        getSessionsQueryKey(sessionFilterParams),
        (old: SessionSummary[] | undefined) =>
          old?.map((s) =>
            s.id === data.sessionId ? { ...s, unreadCount: data.agentUnread } : s,
          ),
      );
      queryClient.invalidateQueries({ queryKey: getSessionStatsQueryKey(sessionFilterParams) });
    },
    [queryClient, sessionFilterParams],
  );

  const onChatError = useCallback(
    (error: string) => {
      toast({ title: "消息发送失败", description: error, variant: "destructive" });
    },
    [toast],
  );

  const { messages, isConnected, isReconnecting, sendTextMessage, sendImageMessage, sendFileMessage, addMessages, sendAgentRead } =
    useChat({
      agentToken: agentToken ?? undefined,
      onMessage,
      onSessionUpdate,
      onUnreadUpdate,
      onSessionTransfer,
      onError: onChatError,
    });

  useEffect(() => {
    if (history) addMessages(history as ChatMessage[]);
  }, [history, addMessages]);

  useEffect(() => {
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  }, [selectedSessionId]);

  const handleSelectSession = (sessionId: number) => {
    const session = (sessions as SessionSummary[]).find((s) => s.id === sessionId);
    const isReadonly = session?.agentAccess === "readonly";

    setSelectedSessionId(sessionId);
    setShowTransferPanel(false);
    setInputText("");
    void queryClient.prefetchQuery({
      queryKey: getSessionNotesQueryKey(sessionId),
      queryFn: () => getSessionNotes(sessionId),
      staleTime: Infinity,
    });
    if (!isReadonly) {
      markRead.mutate(
        { id: sessionId },
        {
          onSuccess: (result) => {
            queryClient.setQueryData(
              getSessionsQueryKey(sessionFilterParams),
              (old: SessionSummary[] | undefined) =>
                old?.map((s) =>
                  s.id === sessionId ? { ...s, unreadCount: result.agentUnread ?? 0 } : s,
                ),
            );
            queryClient.invalidateQueries({ queryKey: getSessionStatsQueryKey(sessionFilterParams) });
          },
        },
      );
      sendAgentRead(sessionId);
    }
  };

  const sessionMessages = selectedSessionId
    ? messages.filter((m) => m.sessionId === selectedSessionId)
    : [];

  const handleSend = () => {
    const text = inputText.trim();
    if (!text || !selectedSessionId) return;
    sendTextMessage(text, selectedSessionId);
    setInputText("");
    queryClient.invalidateQueries({ queryKey: getSessionsQueryKey(sessionFilterParams) });
  };

  const handleExportSessions = () => {
    const rows = sessions as SessionSummary[];
    const header = ["会话ID", "访客名称", "所属客服", "客服ID", "状态", "在线", "未读", "最后消息", "创建时间"];
    const lines = rows.map((s) =>
      [s.id, s.visitorNickname, s.agentDisplayName ?? "", s.agentId ?? "", s.status, s.isOnline ? "是" : "否", s.unreadCount, (s.lastMessage ?? "").replace(/"/g, '""'), s.createdAt]
        .map((v) => `"${String(v)}"`)
        .join(","),
    );
    const blob = new Blob(["\uFEFF" + [header.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sessions-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleImagePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !selectedSessionId) return;
    const url = await uploadImage(file);
    if (url) sendImageMessage(url, selectedSessionId);
    queryClient.invalidateQueries({ queryKey: getSessionsQueryKey(sessionFilterParams) });
  };

  const handleFilePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !selectedSessionId) return;
    if (!isConnected) {
      toast({ title: "未连接", description: "请等待连接后再发送文件", variant: "destructive" });
      return;
    }
    try {
      const result = await uploadFile(file);
      if (!result) return;
      const sent = sendFileMessage(result, selectedSessionId);
      if (!sent) {
        toast({ title: "发送失败", description: "连接中断，文件已上传但未能发出，请重试", variant: "destructive" });
        return;
      }
      queryClient.invalidateQueries({ queryKey: getSessionsQueryKey(sessionFilterParams) });
    } finally {
      await new Promise((resolve) => setTimeout(resolve, 500));
      clearUploadProgress();
    }
  };

  const handleOpenAdmin = useCallback(() => {
    if (openingAdminRef.current) return;
    openingAdminRef.current = true;
    window.setTimeout(() => {
      openingAdminRef.current = false;
    }, 1000);

    openAdminApp({
      bridgeToken: isSuperAdmin ? agentToken : null,
      bridgeUsername: isSuperAdmin ? localStorage.getItem("agent_username") : null,
      bridgeRole: isSuperAdmin ? agentRole : null,
      bridgeUserId: isSuperAdmin ? String(agentIdStored) : null,
    });
  }, [agentToken, agentRole, agentIdStored, isSuperAdmin]);

  const handleLogout = () => {
    localStorage.removeItem("agent_token");
    localStorage.removeItem("agent_username");
    localStorage.removeItem("agent_id");
    localStorage.removeItem("agent_role");
    setLocation("/agent");
  };

  const selectedSession = (sessions as SessionSummary[]).find((s) => s.id === selectedSessionId);
  const isReadonlySession = selectedSession?.agentAccess === "readonly";
  const canTransferSession =
    !!selectedSession &&
    !isReadonlySession &&
    (selectedSession.agentAccess === "owner" || isSuperAdmin);

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <div className="w-72 flex-shrink-0 border-r border-border flex flex-col bg-card">
        {/* Header */}
        <div className="px-4 py-4 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <div className="min-w-0 flex-1 flex items-center gap-2.5">
              {headerAvatarUrl ? (
                <img
                  src={headerAvatarUrl}
                  alt={headerDisplayName}
                  className="w-9 h-9 rounded-full object-cover flex-shrink-0 border border-border"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold text-primary">
                    {headerDisplayName.charAt(0) || "客"}
                  </span>
                </div>
              )}
              <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-foreground text-sm truncate">客服工作台</h1>
                {isSuperAdmin && (
                  <Badge className="text-xs bg-amber-100 text-amber-700 border-amber-300 gap-1 flex-shrink-0 px-1.5 py-0">
                    <Crown className="w-3 h-3" />
                    超管
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">{headerDisplayName}</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation("/agent/profile")}
              className="text-muted-foreground hover:text-foreground h-8 w-8 p-0 flex-shrink-0"
              title="个人信息"
            >
              <User className="w-4 h-4" />
            </Button>
            <Button
              data-testid="button-logout"
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-muted-foreground hover:text-foreground h-8 w-8 p-0 flex-shrink-0"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
          {stats && (
            <div className="grid grid-cols-3 gap-1.5">
              <div className="bg-background rounded-lg px-2 py-1.5 text-center">
                <p className="text-base font-bold text-foreground leading-none">{stats.total}</p>
                <p className="text-xs text-muted-foreground mt-0.5">全部</p>
              </div>
              <div className="bg-background rounded-lg px-2 py-1.5 text-center">
                <p className="text-base font-bold text-green-600 leading-none">{stats.online}</p>
                <p className="text-xs text-muted-foreground mt-0.5">在線</p>
              </div>
              <div className="bg-background rounded-lg px-2 py-1.5 text-center">
                <p className="text-base font-bold text-amber-600 leading-none">{stats.unreadTotal}</p>
                <p className="text-xs text-muted-foreground mt-0.5">未讀</p>
              </div>
            </div>
          )}
        </div>

        {!isSuperAdmin && agentIdStored > 0 && (
          <div className="px-4 pb-3 border-b border-border/50">
            <AgentChatLinkCard agentId={agentIdStored} displayName={headerDisplayName} />
          </div>
        )}

        {isSuperAdmin && (
          <div className="px-4 py-2 border-b border-border/50 space-y-2">
            <Select
              value={filterAgentId === "all" ? "all" : String(filterAgentId)}
              onValueChange={(v) => setFilterAgentId(v === "all" ? "all" : Number(v))}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="按客服筛选" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部客服</SelectItem>
                {receptionAgents.map((a) => (
                  <SelectItem key={a.id} value={String(a.id)}>
                    {a.displayName}（ID {a.id}）
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" className="w-full h-8 text-xs gap-1.5" onClick={handleExportSessions}>
              <Download className="w-3.5 h-3.5" />
              导出当前列表 CSV
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full h-8 text-xs gap-1.5"
              onClick={handleOpenAdmin}
            >
              <ExternalLink className="w-3.5 h-3.5" />
              管理后台
            </Button>
          </div>
        )}

        <div className="px-4 py-2 border-b border-border/50 flex items-center gap-2">
          {isReconnecting ? (
            <><RefreshCw className="w-3 h-3 text-amber-500 animate-spin" /><span className="text-xs text-amber-500">重新連線中...</span></>
          ) : isConnected ? (
            <><Wifi className="w-3 h-3 text-green-500" /><span className="text-xs text-green-500">即時連線中</span></>
          ) : (
            <><WifiOff className="w-3 h-3 text-muted-foreground" /><span className="text-xs text-muted-foreground">未連線</span></>
          )}
        </div>

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
              <p className="text-sm font-medium text-muted-foreground">目前沒有訪客</p>
              <p className="text-xs text-muted-foreground/70 mt-1">新對話將會顯示在此</p>
            </div>
          ) : (
            (sessions as SessionSummary[]).map((session) => (
              <SessionListItem
                key={session.id}
                session={session}
                isActive={session.id === selectedSessionId}
                onClick={() => handleSelectSession(session.id)}
                showAgentInfo={isSuperAdmin}
              />
            ))
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {!selectedSessionId ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
              <MessageSquare className="w-8 h-8 text-primary/60" />
            </div>
            <h2 className="text-xl font-semibold text-foreground">選擇一個對話</h2>
            <p className="text-muted-foreground text-sm mt-2 max-w-xs">
              從左側清單選擇訪客，開始回覆對話。
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
                <h2 className="font-semibold text-foreground">{selectedSession?.visitorNickname ?? "訪客"}</h2>
                {isSuperAdmin && selectedSession && (
                  <p className="text-xs text-primary mt-0.5">
                    所属客服：{selectedSession.agentDisplayName ?? "—"}（ID {selectedSession.agentId ?? "—"}）
                  </p>
                )}
                <div className="flex items-center gap-1.5">
                  <Circle
                    className={`w-2 h-2 fill-current ${
                      selectedSession?.isOnline ? "text-green-500" : "text-muted-foreground"
                    }`}
                  />
                  <span className="text-xs text-muted-foreground">
                    {selectedSession?.isOnline
                      ? "在線（1分鐘內活躍）"
                      : selectedSession?.lastSeenAt
                      ? `最後上線 ${formatDistanceToNow(new Date(selectedSession.lastSeenAt), { addSuffix: true, locale: zhTW })}`
                      : "離線"}
                  </span>
                </div>
              </div>
              <div className="ml-auto flex items-center gap-2">
                {canTransferSession && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5"
                    onClick={() => setShowTransferPanel((v) => !v)}
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5" />
                    {isSuperAdmin && selectedSession?.agentId !== agentIdStored ? "接管" : "转接"}
                  </Button>
                )}
                {isReadonlySession && (
                  <Badge variant="secondary" className="text-xs">
                    只读（已转接）
                  </Badge>
                )}
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
                  {selectedSession?.status === "active"
                    ? "進行中"
                    : selectedSession?.status === "waiting"
                    ? "等待中"
                    : "已結束"}
                </Badge>
              </div>
            </div>

            {showTransferPanel && selectedSessionId && selectedSession && (
              <SessionTransferPanel
                sessionId={selectedSessionId}
                currentAgentId={selectedSession.agentId ?? null}
                viewerAgentId={agentIdStored}
                isSuperAdmin={isSuperAdmin}
                onTransferred={() => {
                  queryClient.invalidateQueries({ queryKey: getSessionsQueryKey(sessionFilterParams) });
                  queryClient.invalidateQueries({ queryKey: getSessionStatsQueryKey(sessionFilterParams) });
                }}
                onClose={() => setShowTransferPanel(false)}
              />
            )}

            <SessionNotePanel
              key={selectedSessionId}
              sessionId={selectedSessionId}
              viewerAgentId={agentIdStored}
              sessionAgentId={selectedSession?.agentId ?? null}
              isSuperAdmin={isSuperAdmin}
              sessionFilterParams={sessionFilterParams}
            />

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-6 py-4 bg-background">
              {sessionMessages.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <MessageSquare className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">尚無訊息</p>
                  </div>
                </div>
              ) : (
                sessionMessages.map((msg) => <MessageBubble key={msg.id} message={msg} />)
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="px-6 py-4 bg-card border-t border-border">
              {isReadonlySession ? (
                <p className="text-sm text-muted-foreground text-center py-2">
                  此会话已转接，您只能查看历史记录，无法发送消息或编辑备注。
                </p>
              ) : (
              <>
              {uploadProgress && (
                <FileUploadProgressBar progress={uploadProgress} onCancel={cancelUpload} />
              )}
              <div className="flex items-end gap-3">
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImagePick}
                />
                <input
                  ref={attachmentInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar,.7z,.json,.xml"
                  className="hidden"
                  onChange={handleFilePick}
                />
                <QuickReplyPicker
                  disabled={!isConnected || !selectedSessionId}
                  onSend={(content) => {
                    if (!selectedSessionId) return;
                    sendTextMessage(content, selectedSessionId);
                    queryClient.invalidateQueries({ queryKey: getSessionsQueryKey(sessionFilterParams) });
                  }}
                />
                <button
                  onClick={() => imageInputRef.current?.click()}
                  disabled={isUploading || !isConnected}
                  className="p-2.5 rounded-xl border border-border hover:bg-accent/50 transition-colors text-muted-foreground disabled:opacity-50 shrink-0"
                  title="发送图片"
                  aria-label="发送图片"
                >
                  <Image className="w-5 h-5" />
                </button>
                <button
                  data-testid="button-file-upload"
                  onClick={() => attachmentInputRef.current?.click()}
                  disabled={isUploading || !isConnected}
                  className="p-2.5 rounded-xl border border-border hover:bg-accent/50 transition-colors text-muted-foreground disabled:opacity-50 shrink-0 text-lg leading-none"
                  title="发送文件"
                  aria-label="发送文件"
                >
                  📎
                </button>
                <Textarea
                  data-testid="input-agent-message"
                  placeholder={`回覆 ${selectedSession?.visitorNickname ?? "訪客"}...`}
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
              </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
