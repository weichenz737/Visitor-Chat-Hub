import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetAgentMe,
  updateAgentMe,
  changeAgentPassword,
  getGetAgentMeQueryKey,
  ApiError,
} from "@workspace/api-client-react";
import { useImageUpload } from "@/hooks/useImageUpload";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Eye, EyeOff, Image, Loader2 } from "lucide-react";

function formatPasswordError(err: unknown): string {
  if (err instanceof ApiError) {
    const data = err.data as { error?: string } | null;
    if (data?.error === "Current password is incorrect") return "当前密码不正确";
    if (data?.error === "Password must be at least 6 characters") return "新密码至少需要 6 位字符";
    if (data?.error === "Current password is required") return "请输入当前密码";
  }
  return err instanceof Error ? err.message : "修改失败";
}

export default function AgentProfile() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { uploadImage, isUploading } = useImageUpload();
  const [saving, setSaving] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  const token = localStorage.getItem("agent_token");
  const { data: me, isLoading } = useGetAgentMe({
    query: { enabled: !!token, queryKey: getGetAgentMeQueryKey() },
  });

  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

  useEffect(() => {
    if (!token) setLocation("/agent");
  }, [token, setLocation]);

  useEffect(() => {
    if (me) {
      setDisplayName(me.displayName || me.username);
      setAvatarUrl(me.avatarUrl ?? "");
    }
  }, [me]);

  const handleSave = async () => {
    const name = displayName.trim();
    if (!name || saving) return;

    setSaving(true);
    try {
      const updated = await updateAgentMe({
        displayName: name,
        avatarUrl: avatarUrl || null,
      });
      queryClient.setQueryData(getGetAgentMeQueryKey(), updated);
      localStorage.setItem("agent_display_name", updated.displayName);
      toast({ title: "资料已保存" });
      setLocation("/agent/dashboard");
    } catch (err) {
      const message = err instanceof Error ? err.message : "保存失败";
      toast({ title: "保存失败", description: message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (changingPassword) return;

    if (!currentPassword || newPassword.length < 6) {
      toast({
        title: "密码不符合要求",
        description: "新密码至少需要 6 位字符",
        variant: "destructive",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({ title: "两次输入的新密码不一致", variant: "destructive" });
      return;
    }

    setChangingPassword(true);
    try {
      await changeAgentPassword({ currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast({ title: "密码已更新" });
    } catch (err) {
      toast({ title: "修改失败", description: formatPasswordError(err), variant: "destructive" });
    } finally {
      setChangingPassword(false);
    }
  };

  const handleAvatarPick = async (file: File) => {
    const url = await uploadImage(file);
    if (url) setAvatarUrl(url);
  };

  if (isLoading || !me) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" className="h-9 w-9 p-0" onClick={() => setLocation("/agent/dashboard")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-lg font-semibold">个人信息</h1>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 space-y-5">
          <div className="flex items-center gap-4">
            <div
              className="w-16 h-16 rounded-full bg-primary/15 flex items-center justify-center cursor-pointer border-2 border-dashed border-border hover:border-primary transition-colors overflow-hidden flex-shrink-0"
              onClick={() => fileInputRef.current?.click()}
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
              ) : (
                <Image className="w-6 h-6 text-muted-foreground" />
              )}
            </div>
            <div className="text-sm text-muted-foreground">
              <p>点击上传头像</p>
              <p className="text-xs mt-1">保存后访客端即时生效</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleAvatarPick(f);
                e.target.value = "";
              }}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">昵称</label>
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="对外显示的客服昵称"
              maxLength={32}
            />
          </div>

          <div className="space-y-1 text-xs text-muted-foreground">
            <p>登录账号：{me.username}</p>
            <p>客服 ID：{me.agentId}</p>
          </div>

          <Button
            className="w-full"
            onClick={() => void handleSave()}
            disabled={saving || isUploading || !displayName.trim()}
          >
            {saving ? "保存中…" : "保存资料"}
          </Button>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground">修改密码</h2>
            <p className="text-xs text-muted-foreground mt-1">修改后请使用新密码登录客服工作台</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">当前密码</label>
            <div className="relative">
              <Input
                type={showCurrentPassword ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="请输入当前密码"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">新密码</label>
            <div className="relative">
              <Input
                type={showNewPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="至少 6 位字符"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">确认新密码</label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="再次输入新密码"
            />
          </div>

          <Button
            variant="secondary"
            className="w-full"
            onClick={() => void handleChangePassword()}
            disabled={
              changingPassword ||
              !currentPassword ||
              newPassword.length < 6 ||
              !confirmPassword
            }
          >
            {changingPassword ? "更新中…" : "更新密码"}
          </Button>
        </div>
      </div>
    </div>
  );
}
