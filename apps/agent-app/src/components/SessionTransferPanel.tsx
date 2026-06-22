import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  listPublicAgents,
  transferSession,
  ApiError,
} from "@workspace/api-client-react";
import type { AgentPublic } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowRightLeft, Loader2, X } from "lucide-react";

interface SessionTransferPanelProps {
  sessionId: number;
  currentAgentId: number | null;
  viewerAgentId: number;
  isSuperAdmin: boolean;
  onTransferred: () => void;
  onClose: () => void;
}

function formatError(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    const data = err.data as { error?: string } | null;
    return data?.error ?? err.message;
  }
  if (err instanceof Error) return err.message;
  return fallback;
}

export function SessionTransferPanel({
  sessionId,
  currentAgentId,
  viewerAgentId,
  isSuperAdmin,
  onTransferred,
  onClose,
}: SessionTransferPanelProps) {
  const { toast } = useToast();
  const [targetAgentId, setTargetAgentId] = useState<string>("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { data: agents = [], isLoading } = useQuery({
    queryKey: ["/api/agents"],
    queryFn: () => listPublicAgents(),
  });

  const candidates = (agents as AgentPublic[]).filter((a) => a.id !== currentAgentId);

  const handleSubmit = async () => {
    const id = Number(targetAgentId);
    if (!Number.isInteger(id) || id <= 0) {
      toast({ title: "请选择目标客服", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      await transferSession(sessionId, {
        targetAgentId: id,
        reason: reason.trim() || undefined,
      });
      toast({
        title: isSuperAdmin && currentAgentId !== viewerAgentId ? "已接管会话" : "转接成功",
      });
      onTransferred();
      onClose();
    } catch (err) {
      toast({
        title: "转接失败",
        description: formatError(err, "请稍后重试"),
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="px-6 py-3 bg-card border-b border-border relative z-20">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <ArrowRightLeft className="w-4 h-4" />
          {isSuperAdmin && currentAgentId !== viewerAgentId ? "强制接管" : "转接会话"}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground p-1"
          aria-label="关闭"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="flex flex-col sm:flex-row gap-2 items-start">
        <Select value={targetAgentId} onValueChange={setTargetAgentId} disabled={isLoading || submitting}>
          <SelectTrigger className="w-full sm:w-56 h-9 text-sm bg-background">
            <SelectValue placeholder={isLoading ? "加载客服…" : "选择目标客服"} />
          </SelectTrigger>
          <SelectContent className="bg-card border-border shadow-xl" position="popper" sideOffset={4}>
            {candidates.map((agent) => (
              <SelectItem key={agent.id} value={String(agent.id)}>
                {agent.displayName}
                {agent.isOnline ? " · 在线" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Textarea
          placeholder="转接原因（可选）"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="flex-1 min-h-[36px] max-h-20 text-sm resize-none"
          rows={1}
          disabled={submitting}
        />
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={submitting || !targetAgentId}
          className="flex-shrink-0"
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "确认转接"}
        </Button>
      </div>
    </div>
  );
}
