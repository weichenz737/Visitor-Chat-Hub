import { useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useAdminListAgents,
  useAdminCreateAgent,
  useAdminUpdateAgent,
  useAdminDeleteAgent,
  getAdminListAgentsQueryKey,
  resetAgentPassword,
} from "@workspace/api-client-react";
import { useMutation } from "@tanstack/react-query";
import { useImageUpload } from "@/hooks/useImageUpload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  UserPlus,
  Pencil,
  Trash2,
  Crown,
  ShieldCheck,
  Image,
  KeyRound,
  ArrowLeft,
  AlertCircle,
  Copy,
  RefreshCw,
} from "lucide-react";

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

type PanelView = "list" | "create" | "edit" | "reset";

const emptyForm = {
  id: "",
  username: "",
  password: "",
  displayName: "",
  introduction: "",
  avatarUrl: "",
  role: "agent" as "agent" | "super_admin",
};

function formatCreateAgentError(err: Error): string {
  const msg = err.message;
  if (msg.includes("Agent ID already taken")) return "该客服 ID 已被占用";
  if (msg.includes("Username already taken")) return "该账号已被占用";
  return msg || "账号可能已存在";
}

function parseOptionalAgentId(raw: string): { valid: true; id?: number } | { valid: false } {
  const trimmed = raw.trim();
  if (!trimmed) return { valid: true };
  const id = Number(trimmed);
  if (!Number.isInteger(id) || id < 1) return { valid: false };
  return { valid: true, id };
}

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
      <span className="text-sm font-bold text-primary">
        {agent.displayName.charAt(0) || agent.username.charAt(0)}
      </span>
    </div>
  );
}

function AvatarPicker({
  avatarUrl,
  onPick,
  inputRef,
}: {
  avatarUrl: string;
  onPick: (file: File) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  return (
    <>
      <div
        className="w-14 h-14 rounded-full bg-primary/15 flex items-center justify-center cursor-pointer border-2 border-dashed border-border hover:border-primary transition-colors flex-shrink-0 overflow-hidden"
        onClick={() => inputRef.current?.click()}
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
        ) : (
          <Image className="w-5 h-5 text-muted-foreground" />
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPick(f);
          e.target.value = "";
        }}
      />
    </>
  );
}

export default function AgentsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [view, setView] = useState<PanelView>("list");
  const [editAgent, setEditAgent] = useState<AdminAgent | null>(null);
  const [resetPasswordValue, setResetPasswordValue] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);
  const { uploadImage } = useImageUpload();

  const [form, setForm] = useState(emptyForm);
  const [editForm, setEditForm] = useState({
    displayName: "",
    introduction: "",
    avatarUrl: "",
    isActive: true,
    password: "",
    role: "agent" as "agent" | "super_admin",
  });

  const {
    data: agents = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useAdminListAgents({
    query: { queryKey: getAdminListAgentsQueryKey(), retry: 1 },
  });

  const createAgent = useAdminCreateAgent();
  const updateAgent = useAdminUpdateAgent();
  const deleteAgent = useAdminDeleteAgent();

  const resetPasswordMutation = useMutation({
    mutationFn: ({ id, password }: { id: number; password: string }) => resetAgentPassword(id, password),
    onSuccess: () => {
      toast({ title: "密码已重置" });
      setView("list");
      setEditAgent(null);
      setResetPasswordValue("");
    },
    onError: (err: Error) => toast({ title: "重置失败", description: err.message, variant: "destructive" }),
  });

  const handleAvatarUpload = async (file: File, setter: (url: string) => void) => {
    const url = await uploadImage(file);
    if (url) setter(url);
  };

  const handleCopyVisitorLink = async (agentId: number) => {
    const url = `http://127.0.0.1:5173/chat/${agentId}`;
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "已复制访客链接" });
    } catch {
      toast({ title: "复制失败", variant: "destructive" });
    }
  };

  const handleCreate = () => {
    if (!form.username.trim() || !form.password || !form.displayName.trim()) return;

    const parsedId = parseOptionalAgentId(form.id);
    if (!parsedId.valid) {
      toast({ title: "客服 ID 无效", description: "请输入大于 0 的整数，或留空自动分配", variant: "destructive" });
      return;
    }

    createAgent.mutate(
      {
        data: {
          ...(parsedId.id != null ? { id: parsedId.id } : {}),
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
          setView("list");
          setForm(emptyForm);
          toast({ title: "客服人员已创建" });
        },
        onError: (err: Error) => {
          toast({ title: "创建失败", description: formatCreateAgentError(err), variant: "destructive" });
        },
      },
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
    setView("edit");
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
          setView("list");
          setEditAgent(null);
          toast({ title: "资料已更新" });
        },
        onError: (err: Error) => toast({ title: "更新失败", description: err.message, variant: "destructive" }),
      },
    );
  };

  const handleDelete = (agent: AdminAgent) => {
    if (!confirm(`确定要删除客服「${agent.displayName}」吗？`)) return;
    deleteAgent.mutate(
      { id: agent.id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getAdminListAgentsQueryKey() });
          toast({ title: "客服人员已删除" });
        },
        onError: (err: Error) => toast({ title: "删除失败", description: err.message, variant: "destructive" }),
      },
    );
  };

  const backToList = () => {
    setView("list");
    setEditAgent(null);
    setResetPasswordValue("");
  };

  const errorMessage =
    error instanceof Error ? error.message : isError ? "加载客服列表失败，请确认已用超级管理员登录" : "";

  if (view === "create") {
    return (
      <div className="p-8 max-w-lg">
        <Button variant="ghost" size="sm" className="mb-4 gap-2 -ml-2" onClick={backToList}>
          <ArrowLeft className="w-4 h-4" />
          返回列表
        </Button>
        <Card>
          <CardHeader>
            <CardTitle>新增客服人员</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <AvatarPicker
                avatarUrl={form.avatarUrl}
                inputRef={fileInputRef}
                onPick={(f) => handleAvatarUpload(f, (url) => setForm((p) => ({ ...p, avatarUrl: url })))}
              />
              <div className="flex-1 space-y-2">
                <Input
                  placeholder="显示名称 *"
                  value={form.displayName}
                  onChange={(e) => setForm((p) => ({ ...p, displayName: e.target.value }))}
                />
                <Input
                  placeholder="账号（英文）*"
                  value={form.username}
                  onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))}
                />
              </div>
            </div>
            <Input
              type="password"
              placeholder="密码（至少6位）*"
              value={form.password}
              onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
            />
            <div className="space-y-1">
              <Input
                type="number"
                min={1}
                step={1}
                placeholder="客服 ID（选填，留空自动分配）"
                value={form.id}
                onChange={(e) => setForm((p) => ({ ...p, id: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                自定义 ID 将用于访客聊天链接，例如 ID 为 100 时路径为 /chat/100
              </p>
            </div>
            <Textarea
              placeholder="自我介绍（选填）"
              value={form.introduction}
              onChange={(e) => setForm((p) => ({ ...p, introduction: e.target.value }))}
              className="resize-none min-h-[80px]"
            />
            <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
              <label className="text-sm font-medium text-foreground shrink-0">角色</label>
              <select
                value={form.role}
                onChange={(e) => setForm((p) => ({ ...p, role: e.target.value as "agent" | "super_admin" }))}
                className="flex-1 bg-background text-sm text-foreground border border-border rounded-md px-2 py-1.5"
              >
                <option value="agent">普通客服</option>
                <option value="super_admin">超级管理员</option>
              </select>
            </div>
            <Button
              className="w-full"
              onClick={handleCreate}
              disabled={!form.username.trim() || !form.password || !form.displayName.trim() || createAgent.isPending}
            >
              {createAgent.isPending ? "创建中..." : "创建客服账号"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (view === "edit" && editAgent) {
    return (
      <div className="p-8 max-w-lg">
        <Button variant="ghost" size="sm" className="mb-4 gap-2 -ml-2" onClick={backToList}>
          <ArrowLeft className="w-4 h-4" />
          返回列表
        </Button>
        <Card>
          <CardHeader>
            <CardTitle>编辑 — {editAgent.displayName}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <AvatarPicker
                avatarUrl={editForm.avatarUrl}
                inputRef={editFileInputRef}
                onPick={(f) => handleAvatarUpload(f, (url) => setEditForm((p) => ({ ...p, avatarUrl: url })))}
              />
              <div className="flex-1">
                <Input
                  placeholder="显示名称"
                  value={editForm.displayName}
                  onChange={(e) => setEditForm((p) => ({ ...p, displayName: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground mt-1">@{editAgent.username}</p>
              </div>
            </div>
            <Textarea
              placeholder="自我介绍（选填）"
              value={editForm.introduction}
              onChange={(e) => setEditForm((p) => ({ ...p, introduction: e.target.value }))}
              className="resize-none min-h-[80px]"
            />
            <Input
              type="password"
              placeholder="新密码（留空则不修改）"
              value={editForm.password}
              onChange={(e) => setEditForm((p) => ({ ...p, password: e.target.value }))}
            />
            <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
              <label className="text-sm font-medium text-foreground shrink-0">角色</label>
              <select
                value={editForm.role}
                onChange={(e) => setEditForm((p) => ({ ...p, role: e.target.value as "agent" | "super_admin" }))}
                className="flex-1 bg-background text-sm text-foreground border border-border rounded-md px-2 py-1.5"
              >
                <option value="agent">普通客服</option>
                <option value="super_admin">超级管理员</option>
              </select>
            </div>
            <label className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg cursor-pointer">
              <input
                type="checkbox"
                checked={editForm.isActive}
                onChange={(e) => setEditForm((p) => ({ ...p, isActive: e.target.checked }))}
                className="w-4 h-4"
              />
              <span className="text-sm text-foreground">启用此客服账号</span>
            </label>
            <Button className="w-full" onClick={handleUpdate} disabled={updateAgent.isPending}>
              {updateAgent.isPending ? "更新中..." : "保存变更"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (view === "reset" && editAgent) {
    return (
      <div className="p-8 max-w-lg">
        <Button variant="ghost" size="sm" className="mb-4 gap-2 -ml-2" onClick={backToList}>
          <ArrowLeft className="w-4 h-4" />
          返回列表
        </Button>
        <Card>
          <CardHeader>
            <CardTitle>重置密码 — {editAgent.displayName}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              type="password"
              placeholder="新密码（至少6位）"
              value={resetPasswordValue}
              onChange={(e) => setResetPasswordValue(e.target.value)}
            />
            <Button
              className="w-full"
              disabled={resetPasswordValue.length < 6 || resetPasswordMutation.isPending}
              onClick={() => resetPasswordMutation.mutate({ id: editAgent.id, password: resetPasswordValue })}
            >
              {resetPasswordMutation.isPending ? "重置中..." : "确认重置"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">客服管理</h1>
          <p className="text-sm text-muted-foreground mt-1">新增、编辑、停用客服账号，或重置密码</p>
        </div>
        <Button onClick={() => setView("create")} className="gap-2">
          <UserPlus className="w-4 h-4" />
          新增客服
        </Button>
      </div>

      {isError && (
        <div className="mb-4 p-4 bg-destructive/10 border border-destructive/20 rounded-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-destructive">无法加载客服列表</p>
            <p className="text-xs text-destructive/80 mt-1">{errorMessage}</p>
            <p className="text-xs text-muted-foreground mt-2">
              请确认使用超级管理员账号登录管理后台（http://localhost:5175/login），默认账号 admin123 / 123456
            </p>
          </div>
          <Button variant="outline" size="sm" className="shrink-0 gap-1" onClick={() => refetch()}>
            <RefreshCw className="w-3.5 h-3.5" />
            重试
          </Button>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-card border border-border rounded-xl animate-pulse" />
          ))}
        </div>
      ) : !isError && (agents as AdminAgent[]).length === 0 ? (
        <div className="text-center py-16 border border-dashed border-border rounded-xl">
          <ShieldCheck className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground mb-4">尚无客服人员</p>
          <Button onClick={() => setView("create")} className="gap-2">
            <UserPlus className="w-4 h-4" />
            新增第一位客服
          </Button>
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
                <div className="flex items-center gap-2 flex-wrap">
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
                    {agent.isActive ? "启用" : "停用"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">@{agent.username} · ID {agent.id}</p>
                {agent.role === "agent" && (
                  <p className="text-xs text-muted-foreground mt-1 font-mono truncate">
                    访客链接：http://127.0.0.1:5173/chat/{agent.id}
                  </p>
                )}
                {agent.introduction && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{agent.introduction}</p>
                )}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {agent.role === "agent" && (
                  <button
                    onClick={() => void handleCopyVisitorLink(agent.id)}
                    className="p-2 rounded-lg hover:bg-accent/50 transition-colors text-muted-foreground hover:text-foreground"
                    title="复制访客链接"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => {
                    setEditAgent(agent);
                    setResetPasswordValue("");
                    setView("reset");
                  }}
                  className="p-2 rounded-lg hover:bg-accent/50 transition-colors text-muted-foreground hover:text-foreground"
                  title="重置密码"
                >
                  <KeyRound className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleOpenEdit(agent)}
                  className="p-2 rounded-lg hover:bg-accent/50 transition-colors text-muted-foreground hover:text-foreground"
                  title="编辑"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(agent)}
                  className="p-2 rounded-lg hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive"
                  title="删除"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
