import { useEffect, useState } from "react";
import { Redirect, useLocation } from "wouter";
import { getAdminMe } from "@workspace/api-client-react";
import { applyAdminSessionBridgeFromUrl } from "@/lib/admin-session-bridge";

export function AdminRequireAuth({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [status, setStatus] = useState<"loading" | "authed" | "guest">("loading");

  useEffect(() => {
    let cancelled = false;

    async function verify() {
      applyAdminSessionBridgeFromUrl();

      const token = localStorage.getItem("admin_token");
      const role = localStorage.getItem("admin_role");
      if (!token || role !== "super_admin") {
        if (!cancelled) setStatus("guest");
        return;
      }

      try {
        const me = await getAdminMe();
        if (me.role !== "super_admin") {
          throw new Error("not super admin");
        }
        localStorage.setItem("admin_username", me.username);
        localStorage.setItem("admin_role", me.role);
        localStorage.setItem("admin_id", String(me.userId));
        if (!cancelled) setStatus("authed");
      } catch {
        localStorage.removeItem("admin_token");
        localStorage.removeItem("admin_username");
        localStorage.removeItem("admin_role");
        localStorage.removeItem("admin_id");
        if (!cancelled) setStatus("guest");
      }
    }

    verify();
    return () => {
      cancelled = true;
    };
  }, [location]);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">正在验证登录状态...</p>
      </div>
    );
  }

  if (status === "guest") {
    return <Redirect to="/login" />;
  }

  return <>{children}</>;
}
