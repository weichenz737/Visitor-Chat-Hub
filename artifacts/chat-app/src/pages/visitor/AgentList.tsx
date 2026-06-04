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
import { MessageCircle, ArrowRight, ShieldCheck, User } from "lucide-react";

interface AgentPublic {
  id: number;
  displayName: string;
  avatarUrl?: string | null;
  introduction?: string | null;
}

function AgentAvatar({ agent, size = "lg" }: { agent: AgentPublic; size?: "sm" | "lg" }) {
  const dim = size === "lg" ? "w-16 h-16 text-2xl" : "w-10 h-10 text-base";
  if (agent.avatarUrl) {
    return (
      <img
        src={agent.avatarUrl}
        alt={agent.displayName}
        className={`${dim} rounded-full object-cover flex-shrink-0`}
      />
    );
  }
  return (
    <div
      className={`${dim} rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0`}
    >
      <span className="font-bold text-primary">{agent.displayName.charAt(0)}</span>
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
        <p className="text-sm text-muted-foreground mt-1">請選擇您想聯繫的客服人員</p>
      </div>

      {/* Agent List */}
      <div className="max-w-2xl mx-auto px-4 py-6">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-card border border-border rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : (agents as AgentPublic[]).length === 0 ? (
          <div className="text-center py-20">
            <User className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-base font-medium text-muted-foreground">目前沒有可用的客服人員</p>
            <p className="text-sm text-muted-foreground/70 mt-1">請稍後再試</p>
          </div>
        ) : (
          <div className="space-y-3">
            {(agents as AgentPublic[]).map((agent) => (
              <div
                key={agent.id}
                data-testid={`card-agent-${agent.id}`}
                className="bg-card border border-border rounded-2xl p-5 flex items-center gap-4 hover:border-primary/40 hover:shadow-sm transition-all cursor-pointer group"
                onClick={() => handleSelectAgent(agent)}
              >
                <AgentAvatar agent={agent} size="lg" />
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground text-base">{agent.displayName}</h3>
                  {agent.introduction && (
                    <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
                      {agent.introduction}
                    </p>
                  )}
                  <div className="flex items-center gap-1.5 mt-2">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    <span className="text-xs text-green-600 font-medium">在線服務中</span>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
              </div>
            ))}
          </div>
        )}

        <div className="mt-8 text-center">
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
              <div className="flex items-center gap-3 mb-2">
                <AgentAvatar agent={selectedAgent} size="sm" />
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
