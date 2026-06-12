import { useState } from "react";
import { useLocation } from "wouter";
import { useAgentLogin } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ShieldCheck, Eye, EyeOff } from "lucide-react";

export default function AgentLogin() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [, setLocation] = useLocation();
  const agentLogin = useAgentLogin();

  const handleLogin = async () => {
    if (!username.trim() || !password) return;
    setError("");
    agentLogin.mutate(
      { data: { username: username.trim(), password } },
      {
        onSuccess: (data) => {
          localStorage.setItem("agent_token", data.token);
          localStorage.setItem("agent_username", data.username);
          localStorage.setItem("agent_id", String(data.userId ?? data.agentId));
          localStorage.setItem("agent_role", data.role ?? "agent");
          setLocation("/agent/dashboard");
        },
        onError: () => {
          setError("帳號或密碼錯誤，請重試。");
        },
      }
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
            <ShieldCheck className="w-7 h-7 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">客服人員登入</h1>
          <p className="text-muted-foreground text-sm mt-2">請登入以管理顧客對話</p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
          {error && (
            <div
              data-testid="text-login-error"
              className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive"
            >
              {error}
            </div>
          )}
          <div className="space-y-4">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-foreground mb-2">
                帳號
              </label>
              <Input
                id="username"
                data-testid="input-username"
                placeholder="請輸入帳號"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyDown={handleKeyDown}
                autoFocus
                className="h-11"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-foreground mb-2">
                密碼
              </label>
              <div className="relative">
                <Input
                  id="password"
                  data-testid="input-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="請輸入密碼"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="h-11 pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <Button
              data-testid="button-login"
              className="w-full h-11 font-semibold"
              onClick={handleLogin}
              disabled={!username.trim() || !password || agentLogin.isPending}
            >
              {agentLogin.isPending ? "登入中..." : "登入"}
            </Button>
          </div>

          <div className="mt-5 pt-5 border-t border-border">
            <p className="text-xs text-muted-foreground text-center">
              超管帳號：<span className="font-mono font-medium text-foreground">admin123</span>
              　密碼：<span className="font-mono font-medium text-foreground">123456</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
