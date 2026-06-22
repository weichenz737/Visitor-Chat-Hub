import { MessageCircle, Link2 } from "lucide-react";

export default function VisitorHome() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-card rounded-2xl shadow-lg border border-border p-8 text-center">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <MessageCircle className="w-7 h-7 text-primary" />
        </div>
        <h1 className="text-xl font-bold text-foreground mb-2">客服聊天系统</h1>
        <p className="text-sm text-muted-foreground leading-relaxed mb-6">
          请通过客服提供的专属链接进入咨询，系统不再提供客服选择页面。
        </p>
        <div className="flex items-start gap-3 rounded-xl bg-muted/50 p-4 text-left">
          <Link2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
          <div className="text-xs text-muted-foreground space-y-1">
            <p className="font-medium text-foreground">链接示例</p>
            <p className="font-mono break-all">/chat/1001</p>
            <p className="font-mono break-all text-muted-foreground/80">/chat?agentId=1001（兼容旧链接）</p>
          </div>
        </div>
      </div>
    </div>
  );
}
