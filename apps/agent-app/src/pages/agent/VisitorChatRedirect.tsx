import { useEffect } from "react";
import { useParams } from "wouter";
import { Loader2 } from "lucide-react";
import { redirectToVisitorChat } from "@/lib/agent-chat-link";

/** Safety net: /chat/:id on agent port → visitor app (5173). */
export default function AgentVisitorChatRedirect() {
  const params = useParams<{ agentId?: string }>();
  const agentId = Number(params.agentId);

  useEffect(() => {
    if (Number.isInteger(agentId) && agentId > 0) {
      redirectToVisitorChat(agentId);
    }
  }, [agentId]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
        <p className="text-sm text-muted-foreground">正在打开访客聊天页…</p>
        <p className="text-xs text-muted-foreground">若未跳转，请访问 http://127.0.0.1:5173/chat/{params.agentId}</p>
      </div>
    </div>
  );
}
