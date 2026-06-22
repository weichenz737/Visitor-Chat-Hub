import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  changeAdminPassword,
  getAdminMe,
  getGetAgentMeQueryKey,
  updateAgentMe,
  useGetAgentMe,
  ApiError,
} from "@workspace/api-client-react";
import { ROLE_LABELS, Role } from "@workspace/permissions";
import { useImageUpload } from "@/hooks/useImageUpload";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Crown, Eye, EyeOff, Image, Loader2 } from "lucide-react";

function formatPasswordError(err: unknown): string {
  if (err instanceof ApiError) {
    const data = err.data as { error?: string } | null;
    if (data?.error === "Current password is incorrect") return "当前密码不正确";
    if (data?.error === "Password must be at least 6 characters") return "新密码至少需要 6 位字符";
    if (data?.error === "Current password is required") return "请输入当前密码";
  }
  return err instanceof Error ? err.message : "修改失败";
}

export default function ProfilePage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { uploadImage, isUploading } = useImageUpload();

  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  const { data: me, isLoading: meLoading } = useGetAgentMe({
    query: { queryKey: getGetAgentMeQueryKey() },
  });

  const { data: adminMe } = useQuery({
    queryKey: ["admin", "me"],
    queryFn: getAdminMe,
  });

  useEffect(() => {
    if (me) {
      setDisplayName(me.displayName || me.username);
      setAvatarUrl(me.avatarUrl ?? "");
    }
  }, [me]);

  const handleSaveProfile = async () => {
    const name = displayName.trim();
    if (!name || savingProfile) return;

    setSavingProfile(true);
    try {
      const updated = await updateAgentMe({
        displayName: name,
        avatarUrl: avatarUrl || null,
      });
      queryClient.setQueryData(getGetAgentMeQueryKey(), updated);
      localStorage.setItem("admin_username", updated.displayName || updated.username);
      toast({ title: "资料已保存" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "保存失败";
      toast({ title: "保存失败", description: message, variant: "destructive" });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleAvatarPick = async (file: File) => {
    const url = await uploadImage(file);
    if (url) setAvatarUrl(url);
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
      await changeAdminPassword({ currentPassword, newPassword });
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

  if (meLoading || !me) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[320px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const roleLabel =
    me.role === Role.SUPER_ADMIN
      ? ROLE_LABELS[Role.SUPER_ADMIN]
      : ROLE_LABELS[Role.AGENT];

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">个人中心</h1>
        <p className="text-sm text-muted-foreground mt-1">管理账号资料与登录密码</p>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">账号信息</CardTitle>
            <CardDescription>当前登录的超级管理员账号</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">登录账号</span>
              <span className="font-medium">{adminMe?.username ?? me.username}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">用户 ID</span>
              <span className="font-medium">{adminMe?.userId ?? me.userId}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">角色</span>
              <Badge variant="outline" className="gap-1 text-amber-700 border-amber-300">
                {me.role === Role.SUPER_ADMIN ? <Crown className="w-3 h-3" /> : null}
                {roleLabel}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">对外资料</CardTitle>
            <CardDescription>昵称与头像在客服工作台和访客端同步显示</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
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
                <p className="text-xs mt-1">支持 JPG、PNG 等常见图片格式</p>
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
                placeholder="对外显示的昵称"
                maxLength={32}
              />
            </div>

            <Button
              onClick={() => void handleSaveProfile()}
              disabled={savingProfile || isUploading || !displayName.trim()}
            >
              {savingProfile ? "保存中…" : "保存资料"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">修改密码</CardTitle>
            <CardDescription>修改后请使用新密码登录管理后台与客服工作台</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
