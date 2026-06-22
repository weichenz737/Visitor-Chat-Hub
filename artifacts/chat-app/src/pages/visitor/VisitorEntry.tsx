import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import {
  useCreateSession,
  visitorResumeSession,
  getPublicAgent,
  ApiError,
} from "@workspace/api-client-react";
import { generateVisitorId } from "@/lib/utils";
import { parseAgentIdFromLocation } from "@/lib/agent-chat-link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageCircle, Loader2, ShieldCheck } from "lucide-react";

const ADJECTIVES = ["快樂", "友善", "活潑", "溫柔", "聰明", "勇敢", "開朗", "細心", "熱情", "耐心"];
const NOUNS = ["小貓", "小狗", "兔子", "熊貓", "企鵝", "海豚", "獅子", "老虎", "狐狸", "鸚鵡"];

function generateNickname(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const num = Math.floor(Math.random() * 900) + 100;
  return `${adj}${noun}${num}`;
}

function getOrCreateVisitorId(): string {
  const key = "visitor_id";
  let id = localStorage.getItem(key);
  if (!id) {
    id = generateVisitorId();
    localStorage.setItem(key, id);
  }
  return id;
}

type Phase = "loading" | "invalid" | "nickname" | "connecting";

export default function VisitorEntry() {
  const [location, setLocation] = useLocation();
  const params = useParams<{ agentId?: string }>();
  const [phase, setPhase] = useState<Phase>("loading");
  const [agentId, setAgentId] = useState<number | null>(null);
  const [agentName, setAgentName] = useState("");
  const [nickname, setNickname] = useState("");
  const createSession = useCreateSession();

  useEffect(() => {
    const fromRoute = params.agentId ? Number(params.agentId) : null;
    const id =
      fromRoute && Number.isInteger(fromRoute) && fromRoute > 0
        ? fromRoute
        : parseAgentIdFromLocation(location, window.location.search);
    if (!id) {
      setPhase("invalid");
      return;
    }
    setAgentId(id);

    const storedAgentId = sessionStorage.getItem("agentId");
    const storedSessionId = sessionStorage.getItem("sessionId");
    const storedNickname = sessionStorage.getItem("visitorNickname");
    if (storedAgentId === String(id) && storedSessionId && storedNickname) {
      setLocation("/chat/room");
      return;
    }

    getPublicAgent(id)
      .then((agent) => {
        setAgentName(agent.displayName);
        setNickname(generateNickname());
        setPhase("nickname");
      })
      .catch(() => setPhase("invalid"));
  }, [location, setLocation, params.agentId]);

  const bindSession = async (name: string) => {
    if (!agentId) return;
    const visitorId = getOrCreateVisitorId();
    setPhase("connecting");

    try {
      const session = await visitorResumeSession({ visitorId, agentId });
      sessionStorage.setItem("sessionId", String(session.id));
      sessionStorage.setItem("visitorNickname", session.visitorNickname);
      sessionStorage.setItem("agentId", String(agentId));
      sessionStorage.setItem("agentName", agentName);
      setLocation("/chat/room");
      return;
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 404) {
        // no existing session — create below
      } else {
        setPhase("nickname");
        return;
      }
    }

    createSession.mutate(
      { data: { visitorNickname: name, agentId, visitorId } },
      {
        onSuccess: (session) => {
          sessionStorage.setItem("sessionId", String(session.id));
          sessionStorage.setItem("visitorNickname", name);
          sessionStorage.setItem("agentId", String(agentId));
          sessionStorage.setItem("agentName", agentName);
          setLocation("/chat/room");
        },
        onError: () => setPhase("nickname"),
      },
    );
  };

  const handleStart = () => {
    const name = nickname.trim();
    if (!name) return;
    void bindSession(name);
  };

  if (phase === "loading" || phase === "connecting") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            {phase === "connecting" ? "正在連接客服..." : "載入中..."}
          </p>
        </div>
      </div>
    );
  }

  if (phase === "invalid") {
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-card rounded-2xl shadow-lg border border-border overflow-hidden">
        <div className="bg-primary px-6 py-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-primary-foreground/20 flex items-center justify-center mx-auto mb-4">
            <MessageCircle className="w-7 h-7 text-primary-foreground" />
          </div>
          <h1 className="text-xl font-bold text-primary-foreground">在线咨询</h1>
          <p className="text-primary-foreground/80 text-sm mt-1">客服：{agentName}</p>
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
            开始聊天
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
