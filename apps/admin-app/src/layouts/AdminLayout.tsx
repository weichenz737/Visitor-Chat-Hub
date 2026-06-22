import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Users,
  MessageSquare,
  ArrowLeftRight,
  Zap,
  ScrollText,
  UserCircle,
  LogOut,
  Shield,
  KeyRound,
  Crown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const NAV_ITEMS: Array<{
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  phase?: string;
}> = [
  { href: "/", label: "概览", icon: LayoutDashboard },
  { href: "/agents", label: "客服管理", icon: Users },
  { href: "/permissions", label: "角色权限", icon: KeyRound },
  { href: "/sessions", label: "会话记录", icon: MessageSquare },
  { href: "/transfers", label: "转接记录", icon: ArrowLeftRight },
  { href: "/quick-replies", label: "快捷回复", icon: Zap },
  { href: "/logs", label: "系统日志", icon: ScrollText },
  { href: "/profile", label: "个人中心", icon: UserCircle },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const username = localStorage.getItem("admin_username") ?? "管理员";
  const role = localStorage.getItem("admin_role");

  const handleLogout = () => {
    localStorage.removeItem("admin_token");
    localStorage.removeItem("admin_username");
    localStorage.removeItem("admin_role");
    localStorage.removeItem("admin_id");
    window.location.href = "/login";
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <aside className="w-60 flex-shrink-0 border-r border-border bg-card flex flex-col">
        <div className="px-4 py-5 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
              <Shield className="w-5 h-5 text-primary-foreground" />
            </div>
            <div className="min-w-0">
              <h1 className="font-bold text-sm text-foreground truncate">管理后台</h1>
              <p className="text-xs text-muted-foreground truncate">{username}</p>
              {role === "super_admin" && (
                <Badge variant="outline" className="mt-1 text-[10px] h-4 px-1 gap-0.5 text-amber-700 border-amber-300">
                  <Crown className="w-2.5 h-2.5" />
                  超级管理员
                </Badge>
              )}
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {NAV_ITEMS.map(({ href, label, icon: Icon, phase }) => {
            const active = href === "/" ? location === "/" : location.startsWith(href);
            return (
              <Link key={href} href={href}>
                <a
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                    active
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                  }`}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span className="flex-1">{label}</span>
                  {phase && (
                    <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                      {phase}
                    </Badge>
                  )}
                </a>
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-border space-y-2">
          <a
            href={import.meta.env.VITE_AGENT_APP_URL ?? "http://localhost:5174/agent/dashboard"}
            className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:text-foreground rounded-lg hover:bg-accent/50 transition-colors"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            进入客服工作台
          </a>
          <Button variant="ghost" size="sm" className="w-full justify-start gap-2" onClick={handleLogout}>
            <LogOut className="w-4 h-4" />
            退出登录
          </Button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto overflow-x-visible">{children}</main>
    </div>
  );
}
