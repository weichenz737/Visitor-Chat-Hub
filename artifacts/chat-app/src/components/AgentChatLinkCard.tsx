import { Copy, Check, QrCode } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { buildAgentChatUrl, buildAgentChatQrUrl } from "@/lib/agent-chat-link";
import { useToast } from "@/hooks/use-toast";

interface AgentChatLinkCardProps {
  agentId: number;
  displayName?: string;
}

export function AgentChatLinkCard({ agentId, displayName }: AgentChatLinkCardProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const chatUrl = buildAgentChatUrl(agentId);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(chatUrl);
      setCopied(true);
      toast({ title: "已复制客服链接" });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "复制失败", variant: "destructive" });
    }
  };

  return (
    <div className="rounded-xl border border-border bg-background p-3 space-y-2">
      <p className="text-xs font-medium text-foreground">
        {displayName ? `${displayName} · 专属客服链接` : "我的专属客服链接"}
      </p>
      <div className="flex gap-2">
        <Input readOnly value={chatUrl} className="text-xs h-9 font-mono" />
        <Button type="button" variant="outline" size="sm" className="h-9 px-3 flex-shrink-0" onClick={handleCopy}>
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
        </Button>
        <Button type="button" variant="outline" size="sm" className="h-9 px-3 flex-shrink-0" onClick={() => setQrOpen(true)}>
          <QrCode className="w-4 h-4" />
        </Button>
      </div>

      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>客服链接二维码</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-3 py-2">
            <img
              src={buildAgentChatQrUrl(agentId)}
              alt="客服链接二维码"
              className="w-48 h-48 rounded-lg border border-border"
            />
            <p className="text-xs text-muted-foreground text-center break-all">{chatUrl}</p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
