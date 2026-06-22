import { useState, useEffect, useMemo } from "react";
import { useLocation, useParams } from "wouter";
import {
  useCreateSession,
  visitorResumeSession,
  useGetPublicAgent,
  getGetPublicAgentQueryKey,
  ApiError,
} from "@workspace/api-client-react";
import { parseAgentIdFromLocation } from "@/lib/agent-chat-link";
import {
  clearInvalidSessionFields,
  hasValidStoredSession,
  setStoredAgentProfile,
} from "@/lib/visitor-session";
import {
  getOrCreateVisitorId,
  resolveInitialVisitorNickname,
  setStoredVisitorNickname,
} from "@/lib/visitor-identity";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, ShieldCheck } from "lucide-react";

function resolveRouteAgentId(agentIdParam: string | undefined, location: string, search: string): number | null {
  const fromRoute = agentIdParam ? Number(agentIdParam) : null;
  if (fromRoute && Number.isInteger(fromRoute) && fromRoute > 0) return fromRoute;
  return parseAgentIdFromLocation(location, search);
}

type Phase = "invalid" | "ready" | "connecting";

export default function VisitorEntry() {
  const [location, setLocation] = useLocation();
  const params = useParams<{ agentId?: string }>();
  const routeAgentId = useMemo(
    () => resolveRouteAgentId(params.agentId, location, window.location.search),
    [params.agentId, location],
  );

  const [phase, setPhase] = useState<Phase>(() => (routeAgentId ? "ready" : "invalid"));
  const [agentName, setAgentName] = useState(() => sessionStorage.getItem("agentName") ?? "客服");
  const [agentAvatarUrl, setAgentAvatarUrl] = useState<string | null>(() => sessionStorage.getItem("agentAvatarUrl"));
  const [agentIsOnline, setAgentIsOnline] = useState(false);
  const [nickname, setNickname] = useState(resolveInitialVisitorNickname);
  const createSession = useCreateSession();

  const { data: publicAgent } = useGetPublicAgent(routeAgentId ?? 0, {
    query: {
      enabled: !!routeAgentId,
      queryKey: getGetPublicAgentQueryKey(routeAgentId ?? 0),
      refetchInterval: 30_000,
    },
  });

  useEffect(() => {
    if (!routeAgentId) {
      setPhase("invalid");
      return;
    }

    setPhase("ready");

    const prevAgentId = sessionStorage.getItem("agentId");
    if (prevAgentId && prevAgentId !== String(routeAgentId)) {
      clearInvalidSessionFields();
    }
    sessionStorage.setItem("agentId", String(routeAgentId));

    if (!hasValidStoredSession(routeAgentId)) {
      const hasPartial =
        sessionStorage.getItem("sessionId") ||
        sessionStorage.getItem("visitorNickname") ||
        sessionStorage.getItem("visitorId");
      if (hasPartial) clearInvalidSessionFields();
    }

    setAgentName(sessionStorage.getItem("agentName") ?? "客服");
  }, [routeAgentId]);

  useEffect(() => {
    if (!publicAgent) return;
    setAgentName(publicAgent.displayName);
    setAgentAvatarUrl(publicAgent.avatarUrl ?? null);
    setAgentIsOnline(publicAgent.isOnline);
    setStoredAgentProfile(publicAgent.displayName, publicAgent.avatarUrl);
  }, [publicAgent]);

  const enterChatRoom = (session: { id: number }, name: string, visitorId: string) => {
    setStoredVisitorNickname(name);
    sessionStorage.setItem("sessionId", String(session.id));
    sessionStorage.setItem("agentId", String(routeAgentId));
    sessionStorage.setItem("visitorId", visitorId);
    sessionStorage.setItem("agentName", agentName);
    setLocation("/chat/room", { replace: true });
  };

  const bindSession = async (name: string) => {
    if (!routeAgentId) return;
    const visitorId = getOrCreateVisitorId();
    setStoredVisitorNickname(name);
    setPhase("connecting");

    if (hasValidStoredSession(routeAgentId)) {
      const sessionId = Number(sessionStorage.getItem("sessionId"));
      const storedName = resolveInitialVisitorNickname() || name;
      enterChatRoom({ id: sessionId }, storedName, visitorId);
      return;
    }

    try {
      const session = await visitorResumeSession({ visitorId, agentId: routeAgentId });
      enterChatRoom(session, session.visitorNickname, visitorId);
      return;
    } catch (err: unknown) {
      if (!(err instanceof ApiError && err.status === 404)) {
        setPhase("ready");
        return;
      }
    }

    createSession.mutate(
      { data: { visitorNickname: name, agentId: routeAgentId, visitorId } },
      {
        onSuccess: (session) => {
          enterChatRoom(session, name, visitorId);
        },
        onError: () => setPhase("ready"),
      },
    );
  };

  const handleStart = () => {
    const name = nickname.trim();
    if (!name) return;
    void bindSession(name);
  };

  if (phase === "connecting") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">正在連接客服...</p>
        </div>
      </div>
    );
  }

  if (phase === "invalid" || !routeAgentId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="max-w-sm text-center">
          <h1 className="text-lg font-semibold text-foreground mb-2">链接无效</h1>
          <p className="text-sm text-muted-foreground mb-4">
            请使用客服提供的专属链接进入，或链接中的客服不存在/已停用。
          </p>
          <Button variant="outline" onClick={() => setLocation("/")}>
            返回首页
          </Button>
        </div>
      </div>
    );
  }

  const canResume = hasValidStoredSession(routeAgentId);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-card rounded-2xl shadow-lg border border-border overflow-hidden">
        <div className="bg-primary px-6 py-8 text-center">
          {agentAvatarUrl ? (
            <img
              src={agentAvatarUrl}
              alt={agentName}
              className="w-14 h-14 rounded-2xl object-cover mx-auto mb-4 border-2 border-primary-foreground/30"
            />
          ) : (
            <div className="w-14 h-14 rounded-2xl bg-primary-foreground/20 flex items-center justify-center mx-auto mb-4">
              <span className="text-xl font-bold text-primary-foreground">{agentName.charAt(0) || "客"}</span>
            </div>
          )}
          <h1 className="text-xl font-bold text-primary-foreground">在线咨询</h1>
          <p className="text-primary-foreground/80 text-sm mt-1">客服：{agentName}</p>
          <p className="text-primary-foreground/70 text-xs mt-2 flex items-center justify-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${agentIsOnline ? "bg-green-300" : "bg-primary-foreground/40"}`}
            />
            {agentIsOnline ? "客服在線" : "客服離線，留言後將盡快回覆"}
          </p>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">您的称呼</label>
            <Input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="请输入您的姓名..."
              onKeyDown={(e) => e.key === "Enter" && handleStart()}
            />
          </div>
          <Button className="w-full h-11" onClick={handleStart} disabled={!nickname.trim()}>
            {canResume ? "继续聊天" : "开始聊天"}
          </Button>
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground pt-2">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>对话内容仅您与当前客服可见</span>
          </div>
        </div>
      </div>
    </div>
  );
}
