import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useAgentLogin } from "@workspace/api-client-react";
import { applyAdminSessionBridgeFromUrl } from "@/lib/admin-session-bridge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Shield, Eye, EyeOff } from "lucide-react";

export default function AdminLogin() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const agentLogin = useAgentLogin();

  useEffect(() => {
    if (applyAdminSessionBridgeFromUrl()) {
      queryClient.clear();
      setLocation("/");
    }
  }, [queryClient, setLocation]);

  const handleLogin = () => {
    if (!username.trim() || !password) return;
    setError("");
    agentLogin.mutate(
      { data: { username: username.trim(), password } },
      {
        onSuccess: (data) => {
          if (data.role !== "super_admin") {
            setError("仅超级管理员可登录管理后台。");
            return;
          }
          localStorage.setItem("admin_token", data.token);
          localStorage.setItem("admin_username", data.username);
          localStorage.setItem("admin_role", data.role ?? "super_admin");
          localStorage.setItem("admin_id", String(data.userId ?? data.agentId));
          queryClient.clear();
          setLocation("/");
        },
        onError: () => setError("账号或密码错误，请重试。"),
      },
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleLogin();
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary mb-5">
            <Shield className="w-7 h-7 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">管理后台登录</h1>
          <p className="text-muted-foreground text-sm mt-2">超级管理员专用</p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
          {error && (
            <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
              {error}
            </div>
          )}
          <div className="space-y-4">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-foreground mb-2">
                账号
              </label>
              <Input
                id="username"
                placeholder="请输入账号"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyDown={handleKeyDown}
                autoFocus
                className="h-11"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-foreground mb-2">
                密码
              </label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="请输入密码"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="h-11 pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <Button
              className="w-full h-11 font-semibold"
              onClick={handleLogin}
              disabled={!username.trim() || !password || agentLogin.isPending}
            >
              {agentLogin.isPending ? "登录中..." : "登录"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
