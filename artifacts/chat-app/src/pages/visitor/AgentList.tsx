import { useState } from "react";
import { useLocation } from "wouter";
import {
  useListPublicAgents,
  useCreateSession,
  getListPublicAgentsQueryKey,
} from "@workspace/api-client-react";
import { MessageCircle, ArrowRight, ShieldCheck, Loader2 } from "lucide-react";

const ADJECTIVES = ["快樂", "友善", "活潑", "溫柔", "聰明", "勇敢", "開朗", "細心", "熱情", "耐心"];
const NOUNS = ["小貓", "小狗", "兔子", "熊貓", "企鵝", "海豚", "獅子", "老虎", "狐狸", "鸚鵡"];

function generateNickname(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const num = Math.floor(Math.random() * 900) + 100;
  return `${adj}${noun}${num}`;
}

interface AgentPublic {
  id: number;
  displayName: string;
  avatarUrl?: string | null;
  introduction?: string | null;
}

function AgentCard({ agent, onClick, loading }: { agent: AgentPublic; onClick: () => void; loading?: boolean }) {
  return (
    <div
      data-testid={`card-agent-${agent.id}`}
      onClick={loading ? undefined : onClick}
      className={`group relative flex flex-col rounded-2xl overflow-hidden border border-border bg-card transition-all duration-200 ${loading ? "opacity-70 cursor-wait" : "cursor-pointer hover:shadow-lg hover:border-primary/40"}`}
    >
      {/* Photo area — tall, fills most of the card */}
      <div className="relative w-full aspect-[3/4] bg-muted overflow-hidden">
        {agent.avatarUrl ? (
          <img
            src={agent.avatarUrl}
            alt={agent.displayName}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
            <span className="text-6xl font-bold text-primary/40 select-none">
              {agent.displayName.charAt(0)}
            </span>
          </div>
        )}

        {/* Online badge */}
        <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-white/90 backdrop-blur-sm rounded-full px-2.5 py-1 shadow-sm">
          <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
          <span className="text-xs font-medium text-green-700">在線</span>
        </div>

        {/* Loading overlay */}
        {loading && (
          <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-white animate-spin" />
          </div>
        )}
      </div>

      {/* Info area — compact footer */}
      <div className="px-4 py-3 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-foreground text-base truncate">{agent.displayName}</p>
          {agent.introduction && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{agent.introduction}</p>
          )}
        </div>
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary transition-colors">
          <ArrowRight className="w-4 h-4 text-primary group-hover:text-primary-foreground transition-colors" />
        </div>
      </div>
    </div>
  );
}

export default function VisitorAgentList() {
  const [, setLocation] = useLocation();
  const [loadingAgentId, setLoadingAgentId] = useState<number | null>(null);
  const createSession = useCreateSession();

  const { data: agents = [], isLoading } = useListPublicAgents({
    query: { queryKey: getListPublicAgentsQueryKey() },
  });

  const handleSelectAgent = (agent: AgentPublic) => {
    if (loadingAgentId !== null) return;
    const nickname = generateNickname();
    setLoadingAgentId(agent.id);
    createSession.mutate(
      { data: { visitorNickname: nickname, agentId: agent.id } },
      {
        onSuccess: (session) => {
          sessionStorage.setItem("sessionId", String(session.id));
          sessionStorage.setItem("visitorNickname", nickname);
          sessionStorage.setItem("agentId", String(agent.id));
          sessionStorage.setItem("agentName", agent.displayName);
          setLocation("/chat");
        },
        onError: () => {
          setLoadingAgentId(null);
        },
      }
    );
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border px-4 py-5 text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary mb-3">
          <MessageCircle className="w-6 h-6 text-primary-foreground" />
        </div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">線上客服中心</h1>
        <p className="text-sm text-muted-foreground mt-1">選擇您想聯繫的客服人員，立即開始對話</p>
      </div>

      {/* Card Grid */}
      <div className="max-w-3xl mx-auto px-4 py-8">
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-2xl overflow-hidden border border-border bg-card animate-pulse">
                <div className="aspect-[3/4] bg-muted" />
                <div className="px-4 py-3 space-y-2">
                  <div className="h-4 bg-muted rounded w-2/3" />
                  <div className="h-3 bg-muted rounded w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : (agents as AgentPublic[]).length === 0 ? (
          <div className="text-center py-24">
            <p className="text-base font-medium text-muted-foreground">目前沒有可用的客服人員</p>
            <p className="text-sm text-muted-foreground/70 mt-1">請稍後再試</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {(agents as AgentPublic[]).map((agent) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                onClick={() => handleSelectAgent(agent)}
                loading={loadingAgentId === agent.id}
              />
            ))}
          </div>
        )}

        <div className="mt-10 text-center">
          <button
            onClick={() => setLocation("/agent")}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors group"
            data-testid="link-agent-portal"
          >
            <ShieldCheck className="w-3.5 h-3.5 group-hover:text-primary transition-colors" />
            客服人員登入
          </button>
        </div>
      </div>
    </div>
  );
}
