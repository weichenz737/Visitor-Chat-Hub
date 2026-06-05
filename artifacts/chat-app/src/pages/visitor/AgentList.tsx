import { useState } from "react";
import { useLocation } from "wouter";
import {
  useListPublicAgents,
  useCreateSession,
  getListPublicAgentsQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { MessageCircle, ArrowRight, ShieldCheck } from "lucide-react";

interface AgentPublic {
  id: number;
  displayName: string;
  avatarUrl?: string | null;
  introduction?: string | null;
}

function AgentCard({ agent, onClick }: { agent: AgentPublic; onClick: () => void }) {
  return (
    <div
      data-testid={`card-agent-${agent.id}`}
      onClick={onClick}
      className="group relative flex flex-col rounded-2xl overflow-hidden border border-border bg-card cursor-pointer hover:shadow-lg hover:border-primary/40 transition-all duration-200"
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
      </div>

      {/* Info area — compact footer */}
      <div className="px-4 py-3 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-foreground text-base truncate">{agent.displayName}</p>
          {agent.introduction && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{agent.introduction}</p>
          )}
        </div>
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
          <ArrowRight className="w-4 h-4 text-primary group-hover:text-primary-foreground transition-colors" />
        </div>
      </div>
    </div>
  );
}

export default function VisitorAgentList() {
  const [, setLocation] = useLocation();
  const [selectedAgent, setSelectedAgent] = useState<AgentPublic | null>(null);
  const [nickname, setNickname] = useState("");
  const [open, setOpen] = useState(false);
  const createSession = useCreateSession();

  const { data: agents = [], isLoading } = useListPublicAgents({
    query: { queryKey: getListPublicAgentsQueryKey() },
  });

  const handleSelectAgent = (agent: AgentPublic) => {
    setSelectedAgent(agent);
    setNickname("");
    setOpen(true);
  };

  const handleStart = () => {
    const name = nickname.trim();
    if (!name || !selectedAgent) return;
    createSession.mutate(
      { data: { visitorNickname: name, agentId: selectedAgent.id } },
      {
        onSuccess: (session) => {
          sessionStorage.setItem("sessionId", String(session.id));
          sessionStorage.setItem("visitorNickname", name);
          sessionStorage.setItem("agentId", String(selectedAgent.id));
          sessionStorage.setItem("agentName", selectedAgent.displayName);
          setOpen(false);
          setLocation("/chat");
        },
      }
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleStart();
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
              <AgentCard key={agent.id} agent={agent} onClick={() => handleSelectAgent(agent)} />
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

      {/* Name Entry Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            {selectedAgent && (
              <div className="flex items-center gap-3 mb-1">
                <div className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0 bg-primary/10 flex items-center justify-center">
                  {selectedAgent.avatarUrl ? (
                    <img
                      src={selectedAgent.avatarUrl}
                      alt={selectedAgent.displayName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-lg font-bold text-primary">
                      {selectedAgent.displayName.charAt(0)}
                    </span>
                  )}
                </div>
                <div>
                  <DialogTitle className="text-base">{selectedAgent.displayName}</DialogTitle>
                  <DialogDescription className="text-xs mt-0.5">
                    請輸入您的姓名以開始對話
                  </DialogDescription>
                </div>
              </div>
            )}
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">您的姓名</label>
              <Input
                data-testid="input-nickname-dialog"
                placeholder="請輸入您的姓名..."
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                onKeyDown={handleKeyDown}
                autoFocus
                className="h-11"
              />
            </div>
            <Button
              data-testid="button-start-chat-dialog"
              className="w-full h-11 font-semibold"
              onClick={handleStart}
              disabled={!nickname.trim() || createSession.isPending}
            >
              {createSession.isPending ? "開始中..." : "開始對話"}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
