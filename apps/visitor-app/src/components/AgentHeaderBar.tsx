import { ArrowLeft } from "lucide-react";

interface AgentHeaderBarProps {
  displayName: string;
  avatarUrl?: string | null;
  isOnline: boolean;
  visitorNickname: string;
  visitorUnread?: number;
  onBack: () => void;
}

function AgentAvatar({ name, avatarUrl }: { name: string; avatarUrl?: string | null }) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className="w-10 h-10 rounded-full object-cover flex-shrink-0 bg-muted"
      />
    );
  }
  return (
    <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
      <span className="text-sm font-bold text-primary">{name.charAt(0) || "客"}</span>
    </div>
  );
}

export function AgentHeaderBar({
  displayName,
  avatarUrl,
  isOnline,
  visitorNickname,
  visitorUnread = 0,
  onBack,
}: AgentHeaderBarProps) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-card border-b border-border shadow-sm">
      <button
        data-testid="button-back"
        onClick={onBack}
        className="p-2 rounded-lg hover:bg-accent/50 transition-colors text-muted-foreground"
      >
        <ArrowLeft className="w-5 h-5" />
      </button>

      <AgentAvatar name={displayName} avatarUrl={avatarUrl} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h1 className="font-semibold text-foreground text-sm truncate">{displayName}</h1>
          {visitorUnread > 0 && (
            <span className="h-5 min-w-5 px-1.5 text-[10px] rounded-full bg-amber-500 text-white inline-flex items-center justify-center">
              {visitorUnread > 99 ? "99+" : visitorUnread}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span
            className={`w-2 h-2 rounded-full flex-shrink-0 ${isOnline ? "bg-green-500" : "bg-muted-foreground/40"}`}
          />
          <span className={`text-xs ${isOnline ? "text-green-600" : "text-muted-foreground"}`}>
            {isOnline ? "客服在線" : "客服離線"}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 px-3 py-1 bg-primary/10 rounded-full max-w-[40%]">
        <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
        <span className="text-xs font-medium text-primary truncate">{visitorNickname}</span>
      </div>
    </div>
  );
}
