import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  useGetSessionMessages,
  useMarkSessionRead,
  useAdminListAgents,
  useAdminCreateAgent,
  useAdminUpdateAgent,
  useAdminDeleteAgent,
  getGetSessionMessagesQueryKey,
  getAdminListAgentsQueryKey,
  listSessionsFiltered,
  getSessionStatsFiltered,
  getSessionsQueryKey,
  getSessionStatsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useChat, type ChatMessage } from "@/hooks/useChat";
import { useImageUpload } from "@/hooks/useImageUpload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AgentChatLinkCard } from "@/components/AgentChatLinkCard";
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
  Check,
  CheckCheck,
  UserPlus,
  Pencil,
  Trash2,
  ShieldCheck,
  Crown,
  Download,
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

// ─── Read Status ────────────────────────────────────────────────────────────

function ReadStatus({ message }: { message: ChatMessage }) {
  if (message.senderType !== "agent") return null;
  if (message.readAt) {
    return (
      <span className="inline-flex items-center ml-1" title="已讀">
        <CheckCheck className="w-3.5 h-3.5 text-blue-400" />
      </span>
    );
  }
  return (
    <span className="inline-flex items-center ml-1" title="已送出">
      <Check className="w-3.5 h-3.5 text-primary-foreground/60" />
    </span>
  );
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
            ) : (
              <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{message.content}</p>
            )}
          </div>
          <div className="flex items-center mt-1 mx-1">
            <span className="text-xs text-muted-foreground">
              {format(new Date(message.createdAt), "HH:mm")}
            </span>
            {isAgent && <ReadStatus message={message} />}
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

// ─── Agent Avatar ─────────────────────────────────────────────────────────────

function AgentAvatar({ agent }: { agent: AdminAgent }) {
  const [imgFailed, setImgFailed] = useState(false);
  if (agent.avatarUrl && !imgFailed) {
    return (
      <img
        src={agent.avatarUrl}
        alt={agent.displayName}
        className="w-10 h-10 rounded-full object-cover flex-shrink-0"
        onError={() => setImgFailed(true)}
      />
    );
  }
  return (
    <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
      <span className="text-sm font-bold text-primary">{agent.displayName.charAt(0) || agent.username.charAt(0)}</span>
    </div>
  );
}

// ─── Agent Management Panel (super_admin only) ────────────────────────────────

function AgentManagementPanel() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [editAgent, setEditAgent] = useState<AdminAgent | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);
  const { uploadImage } = useImageUpload();

  const [form, setForm] = useState({
    username: "", password: "", displayName: "", introduction: "", avatarUrl: "", role: "agent" as "agent" | "super_admin",
  });
  const [editForm, setEditForm] = useState({
    displayName: "", introduction: "", avatarUrl: "", isActive: true, password: "", role: "agent" as "agent" | "super_admin",
  });

  const { data: agents = [], isLoading } = useAdminListAgents({
    query: { queryKey: getAdminListAgentsQueryKey() },
  });

  const createAgent = useAdminCreateAgent();
  const updateAgent = useAdminUpdateAgent();
  const deleteAgent = useAdminDeleteAgent();

  const handleCreate = () => {
    if (!form.username.trim() || !form.password || !form.displayName.trim()) return;
    createAgent.mutate(
      {
        data: {
          username: form.username.trim(),
          password: form.password,
          displayName: form.displayName.trim(),
          role: form.role,
          introduction: form.introduction || null,
          avatarUrl: form.avatarUrl || null,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getAdminListAgentsQueryKey() });
          setCreateOpen(false);
          setForm({ username: "", password: "", displayName: "", introduction: "", avatarUrl: "", role: "agent" });
          toast({ title: "客服人員已建立" });
        },
        onError: (err: any) => {
          toast({ title: "建立失敗", description: err?.message ?? "帳號可能已存在", variant: "destructive" });
        },
      }
    );
  };

  const handleOpenEdit = (agent: AdminAgent) => {
    setEditAgent(agent);
    setEditForm({
      displayName: agent.displayName,
      introduction: agent.introduction ?? "",
      avatarUrl: agent.avatarUrl ?? "",
      isActive: agent.isActive,
      password: "",
      role: (agent.role as "agent" | "super_admin") ?? "agent",
    });
  };

  const handleUpdate = () => {
    if (!editAgent) return;
    updateAgent.mutate(
      {
        id: editAgent.id,
        data: {
          displayName: editForm.displayName || undefined,
          introduction: editForm.introduction || null,
          avatarUrl: editForm.avatarUrl || null,
          isActive: editForm.isActive,
          role: editForm.role,
          password: editForm.password || null,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getAdminListAgentsQueryKey() });
          setEditAgent(null);
          toast({ title: "資料已更新" });
        },
        onError: () => {
          toast({ title: "更新失敗", variant: "destructive" });
        },
      }
    );
  };

  const handleDelete = (agent: AdminAgent) => {
    if (!confirm(`確定要刪除客服「${agent.displayName}」嗎？`)) return;
    deleteAgent.mutate(
      { id: agent.id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getAdminListAgentsQueryKey() });
          toast({ title: "客服人員已刪除" });
        },
        onError: () => {
          toast({ title: "刪除失敗", variant: "destructive" });
        },
      }
    );
  };

  const handleAvatarUpload = async (
    file: File,
    setter: (url: string) => void
  ) => {
    const url = await uploadImage(file);
    if (url) setter(url);
  };

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-foreground">客服人員管理</h2>
            <p className="text-sm text-muted-foreground mt-1">新增、編輯或停用客服帳號</p>
          </div>
          <Button onClick={() => setCreateOpen(true)} className="gap-2">
            <UserPlus className="w-4 h-4" />
            新增客服
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-card border border-border rounded-xl animate-pulse" />
            ))}
          </div>
        ) : (agents as AdminAgent[]).length === 0 ? (
          <div className="text-center py-16">
            <ShieldCheck className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">尚無客服人員</p>
          </div>
        ) : (
          <div className="space-y-3">
            {(agents as AdminAgent[]).map((agent) => (
              <div
                key={agent.id}
                className="bg-card border border-border rounded-xl p-4 flex items-center gap-4"
              >
                <AgentAvatar agent={agent} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-foreground">{agent.displayName}</p>
                    {agent.role === "super_admin" && (
                      <Badge className="text-xs bg-amber-100 text-amber-700 border-amber-300 gap-1">
                        <Crown className="w-3 h-3" />
                        超管
                      </Badge>
                    )}
                    <Badge
                      variant="outline"
                      className={`text-xs ${agent.isActive ? "text-green-600 border-green-300" : "text-muted-foreground"}`}
                    >
                      {agent.isActive ? "啟用" : "停用"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">@{agent.username}</p>
                  {agent.introduction && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{agent.introduction}</p>
                  )}
                  {agent.role === "agent" && (
                    <div className="mt-2">
                      <AgentChatLinkCard agentId={agent.id} displayName={agent.displayName} />
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => handleOpenEdit(agent)}
                    className="p-2 rounded-lg hover:bg-accent/50 transition-colors text-muted-foreground hover:text-foreground"
                    title="編輯"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(agent)}
                    className="p-2 rounded-lg hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive"
                    title="刪除"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>新增客服人員</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="flex items-center gap-3">
              <div
                className="w-14 h-14 rounded-full bg-primary/15 flex items-center justify-center cursor-pointer border-2 border-dashed border-border hover:border-primary transition-colors flex-shrink-0 overflow-hidden"
                onClick={() => fileInputRef.current?.click()}
                title="點擊上傳頭像"
              >
                {form.avatarUrl ? (
                  <img src={form.avatarUrl} alt="avatar" className="w-full h-full object-cover" />
                ) : (
                  <Image className="w-5 h-5 text-muted-foreground" />
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleAvatarUpload(f, (url) => setForm((prev) => ({ ...prev, avatarUrl: url })));
                  e.target.value = "";
                }}
              />
              <div className="flex-1 space-y-2">
                <Input
                  placeholder="顯示名稱 *"
                  value={form.displayName}
                  onChange={(e) => setForm((p) => ({ ...p, displayName: e.target.value }))}
                />
                <Input
                  placeholder="帳號（英文）*"
                  value={form.username}
                  onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))}
                />
              </div>
            </div>
            <Input
              type="password"
              placeholder="密碼（至少6位）*"
              value={form.password}
              onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
            />
            <Textarea
              placeholder="自我介紹（選填）"
              value={form.introduction}
              onChange={(e) => setForm((p) => ({ ...p, introduction: e.target.value }))}
              className="resize-none min-h-[80px]"
            />
            {/* Role selector */}
            <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
              <label className="text-sm font-medium text-foreground">角色：</label>
              <select
                value={form.role}
                onChange={(e) => setForm((p) => ({ ...p, role: e.target.value as "agent" | "super_admin" }))}
                className="flex-1 bg-transparent text-sm text-foreground border border-border rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="agent">普通客服</option>
                <option value="super_admin">超級管理員</option>
              </select>
            </div>
            <Button
              className="w-full"
              onClick={handleCreate}
              disabled={
                !form.username.trim() || !form.password || !form.displayName.trim() || createAgent.isPending
              }
            >
              {createAgent.isPending ? "建立中..." : "建立客服帳號"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editAgent} onOpenChange={(o) => { if (!o) setEditAgent(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>編輯客服資料</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="flex items-center gap-3">
              <div
                className="w-14 h-14 rounded-full bg-primary/15 flex items-center justify-center cursor-pointer border-2 border-dashed border-border hover:border-primary transition-colors flex-shrink-0 overflow-hidden"
                onClick={() => editFileInputRef.current?.click()}
                title="點擊更換頭像"
              >
                {editForm.avatarUrl ? (
                  <img src={editForm.avatarUrl} alt="avatar" className="w-full h-full object-cover" />
                ) : (
                  <Image className="w-5 h-5 text-muted-foreground" />
                )}
              </div>
              <input
                ref={editFileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleAvatarUpload(f, (url) => setEditForm((prev) => ({ ...prev, avatarUrl: url })));
                  e.target.value = "";
                }}
              />
              <div className="flex-1">
                <Input
                  placeholder="顯示名稱"
                  value={editForm.displayName}
                  onChange={(e) => setEditForm((p) => ({ ...p, displayName: e.target.value }))}
                />
              </div>
            </div>
            <Textarea
              placeholder="自我介紹（選填）"
              value={editForm.introduction}
              onChange={(e) => setEditForm((p) => ({ ...p, introduction: e.target.value }))}
              className="resize-none min-h-[80px]"
            />
            <Input
              type="password"
              placeholder="新密碼（留空則不修改）"
              value={editForm.password}
              onChange={(e) => setEditForm((p) => ({ ...p, password: e.target.value }))}
            />
            {/* Role selector */}
            <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
              <label className="text-sm font-medium text-foreground">角色：</label>
              <select
                value={editForm.role}
                onChange={(e) => setEditForm((p) => ({ ...p, role: e.target.value as "agent" | "super_admin" }))}
                className="flex-1 bg-transparent text-sm text-foreground border border-border rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="agent">普通客服</option>
                <option value="super_admin">超級管理員</option>
              </select>
            </div>
            <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
              <input
                id="isActive"
                type="checkbox"
                checked={editForm.isActive}
                onChange={(e) => setEditForm((p) => ({ ...p, isActive: e.target.checked }))}
                className="w-4 h-4"
              />
              <label htmlFor="isActive" className="text-sm text-foreground cursor-pointer">
                啟用此客服帳號（停用後訪客端不顯示）
              </label>
            </div>
            <Button
              className="w-full"
              onClick={handleUpdate}
              disabled={updateAgent.isPending}
            >
              {updateAgent.isPending ? "更新中..." : "儲存變更"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function AgentDashboard() {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<"chat" | "agents">("chat");
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [filterAgentId, setFilterAgentId] = useState<number | "all">("all");
  const [inputText, setInputText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { uploadImage, isUploading } = useImageUpload();

  const agentToken = localStorage.getItem("agent_token");
  const agentUsername = localStorage.getItem("agent_username") ?? "客服人員";
  const agentRole = localStorage.getItem("agent_role") ?? "agent";
  const agentIdStored = Number(localStorage.getItem("agent_id") ?? "0");
  const isSuperAdmin = agentRole === "super_admin";

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

  // If on agents tab but not super_admin, switch to chat tab
  useEffect(() => {
    if (!isSuperAdmin && activeTab === "agents") {
      setActiveTab("chat");
    }
  }, [isSuperAdmin, activeTab]);

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

  const { data: history } = useGetSessionMessages(selectedSessionId ?? 0, {
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

  const { messages, isConnected, isReconnecting, sendTextMessage, sendImageMessage, addMessages } =
    useChat({ agentToken: agentToken ?? undefined, onMessage, onSessionUpdate });

  useEffect(() => {
    if (history) addMessages(history as ChatMessage[]);
  }, [history, addMessages]);

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
          queryClient.invalidateQueries({ queryKey: getSessionsQueryKey(sessionFilterParams) });
          queryClient.invalidateQueries({ queryKey: getSessionStatsQueryKey(sessionFilterParams) });
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

  const handleLogout = () => {
    localStorage.removeItem("agent_token");
    localStorage.removeItem("agent_username");
    localStorage.removeItem("agent_id");
    localStorage.removeItem("agent_role");
    setLocation("/agent");
  };

  const selectedSession = (sessions as SessionSummary[]).find((s) => s.id === selectedSessionId);

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <div className="w-72 flex-shrink-0 border-r border-border flex flex-col bg-card">
        {/* Header */}
        <div className="px-4 py-4 border-b border-border">
          <div className="flex items-center justify-between mb-3">
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
              <p className="text-xs text-muted-foreground mt-0.5 truncate">{agentUsername}</p>
            </div>
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
            <AgentChatLinkCard agentId={agentIdStored} />
          </div>
        )}

        {isSuperAdmin && activeTab === "chat" && (
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
          </div>
        )}

        {/* WS Status */}
        <div className="flex border-b border-border">
          <button
            onClick={() => setActiveTab("chat")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors ${
              activeTab === "chat"
                ? "text-primary border-b-2 border-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            對話列表
          </button>
          {isSuperAdmin && (
            <button
              onClick={() => setActiveTab("agents")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors ${
                activeTab === "agents"
                  ? "text-primary border-b-2 border-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              客服管理
            </button>
          )}
        </div>

        {/* WS Status */}
        <div className="px-4 py-2 border-b border-border/50 flex items-center gap-2">
          {isReconnecting ? (
            <><RefreshCw className="w-3 h-3 text-amber-500 animate-spin" /><span className="text-xs text-amber-500">重新連線中...</span></>
          ) : isConnected ? (
            <><Wifi className="w-3 h-3 text-green-500" /><span className="text-xs text-green-500">即時連線中</span></>
          ) : (
            <><WifiOff className="w-3 h-3 text-muted-foreground" /><span className="text-xs text-muted-foreground">未連線</span></>
          )}
        </div>

        {/* Session List (chat tab only) */}
        {activeTab === "chat" && (
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
        )}

        {/* Agents tab placeholder in sidebar */}
        {activeTab === "agents" && (
          <div className="flex-1 flex items-center justify-center p-4">
            <p className="text-xs text-muted-foreground text-center">請在右側管理客服資料</p>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {activeTab === "agents" ? (
          <AgentManagementPanel />
        ) : !selectedSessionId ? (
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
                  {selectedSession?.status === "active"
                    ? "進行中"
                    : selectedSession?.status === "waiting"
                    ? "等待中"
                    : "已結束"}
                </Badge>
              </div>
            </div>

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
              <div className="flex items-end gap-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImagePick}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading || !isConnected}
                  className="p-2.5 rounded-xl border border-border hover:bg-accent/50 transition-colors text-muted-foreground disabled:opacity-50"
                >
                  <Image className="w-5 h-5" />
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
            </div>
          </>
        )}
      </div>
    </div>
  );
}
