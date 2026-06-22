import { Copy, Check, QrCode, ExternalLink } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { buildAgentChatUrl } from "@/lib/agent-chat-link";
import { useToast } from "@/hooks/use-toast";
import { AgentChatQrModal } from "@/components/AgentChatQrModal";

interface AgentChatLinkCardProps {
  agentId: number;
  displayName?: string;
}

export function AgentChatLinkCard({ agentId, displayName }: AgentChatLinkCardProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const chatUrl = useMemo(() => buildAgentChatUrl(agentId), [agentId]);
  const canShowQr = chatUrl.length > 0;

  const handleCopy = async () => {
    if (!canShowQr) {
      toast({ title: "链接暂未就绪", variant: "destructive" });
      return;
    }
    try {
      await navigator.clipboard.writeText(chatUrl);
      setCopied(true);
      toast({ title: "已复制专属链接" });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "复制失败", variant: "destructive" });
    }
  };

  const handleOpenQr = () => {
    if (!canShowQr) {
      toast({ title: "无法生成二维码", description: "客服 ID 或链接地址无效", variant: "destructive" });
      return;
    }
    setQrOpen(true);
  };

  return (
    <>
      <div className="rounded-xl border border-border bg-background p-3 space-y-2">
        <p className="text-xs font-medium text-foreground">
          {displayName ? `${displayName} · 专属链接` : "我的专属链接"}
        </p>
        <p className="text-[11px] text-muted-foreground">访客请使用此链接（端口 5173，非客服工作台 5174）</p>
        <div className="flex gap-2">
          <Input readOnly value={chatUrl || "链接生成中…"} className="h-9 font-mono text-xs" />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 flex-shrink-0 px-3"
            onClick={handleCopy}
            disabled={!canShowQr}
            title="复制专属链接"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 flex-shrink-0 px-3"
            onClick={handleOpenQr}
            disabled={!canShowQr}
            title="专属二维码"
          >
            <QrCode className="h-4 w-4" />
          </Button>
          {canShowQr ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 flex-shrink-0 px-3"
              title="打开链接测试"
              asChild
            >
              <a href={chatUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 flex-shrink-0 px-3"
              title="打开链接测试"
              disabled
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <AgentChatQrModal open={qrOpen} chatUrl={chatUrl} onClose={() => setQrOpen(false)} />
    </>
  );
}
