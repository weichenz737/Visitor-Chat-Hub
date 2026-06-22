import { useState, Fragment } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  listSessionsFiltered,
  getSessionsQueryKey,
  getSessionNotes,
} from "@workspace/api-client-react";
import type { SessionNote } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { ChevronDown, ChevronRight, StickyNote } from "lucide-react";

interface SessionRow {
  id: number;
  visitorNickname: string;
  status: string;
  createdAt: string;
  lastSeenAt: string | null;
  unreadCount: number;
  isOnline: boolean;
  lastMessage: string | null;
  agentId?: number | null;
  agentDisplayName?: string | null;
  hasNote?: boolean;
}

const STATUS_LABEL: Record<string, string> = {
  waiting: "等待中",
  active: "进行中",
  closed: "已结束",
};

function SessionNotesDetail({ sessionId }: { sessionId: number }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["/api/sessions", sessionId, "notes"],
    queryFn: () => getSessionNotes(sessionId),
  });

  if (isLoading) return <p className="text-xs text-muted-foreground py-2">加载备注中…</p>;
  if (error) return <p className="text-xs text-destructive py-2">加载失败</p>;

  const notes = (data?.notes ?? []).filter((n: SessionNote) => n.content.trim().length > 0);
  if (notes.length === 0) {
    return <p className="text-xs text-muted-foreground py-2">暂无备注</p>;
  }

  return (
    <div className="py-2 space-y-2">
      {notes.map((note) => (
        <div key={note.id} className="rounded-lg border border-border bg-background p-3">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-xs font-medium">
              {note.agentDisplayName ?? `客服 #${note.agentId}`}
            </span>
            <span className="text-xs text-muted-foreground">
              {format(new Date(note.updatedAt), "yyyy-MM-dd HH:mm", { locale: zhCN })}
            </span>
          </div>
          <p className="text-sm whitespace-pre-wrap break-words">{note.content}</p>
        </div>
      ))}
    </div>
  );
}

export default function SessionsPage() {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: getSessionsQueryKey(undefined),
    queryFn: () => listSessionsFiltered(undefined),
    refetchInterval: 5000,
  });

  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">会话记录</h1>
        <p className="text-sm text-muted-foreground mt-1">查看全部会话与内部备注（只读）</p>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-14 bg-muted/50 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : (sessions as SessionRow[]).length === 0 ? (
        <p className="text-muted-foreground text-center py-16">暂无会话</p>
      ) : (
        <div className="border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="w-8 px-2 py-3" />
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">ID</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">访客</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">所属客服</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">状态</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">备注</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">未读</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">创建时间</th>
              </tr>
            </thead>
            <tbody>
              {(sessions as SessionRow[]).map((s) => {
                const expanded = expandedId === s.id;
                return (
                  <Fragment key={s.id}>
                    <tr
                      className="border-t border-border hover:bg-accent/30 cursor-pointer"
                      onClick={() => setExpandedId(expanded ? null : s.id)}
                    >
                      <td className="px-2 py-3 text-muted-foreground">
                        {expanded ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">{s.id}</td>
                      <td className="px-4 py-3">{s.visitorNickname}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {s.agentDisplayName ?? "—"} {s.agentId != null && `(ID ${s.agentId})`}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="text-xs">
                          {STATUS_LABEL[s.status] ?? s.status}
                        </Badge>
                        {s.isOnline && (
                          <span className="ml-2 text-xs text-green-600">在线</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {s.hasNote ? (
                          <StickyNote className="w-4 h-4 text-amber-600" />
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">{s.unreadCount > 0 ? s.unreadCount : "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {format(new Date(s.createdAt), "yyyy-MM-dd HH:mm", { locale: zhCN })}
                      </td>
                    </tr>
                    {expanded && (
                      <tr key={`${s.id}-notes`} className="border-t border-border bg-muted/20">
                        <td colSpan={8} className="px-6 py-2">
                          <p className="text-xs font-medium text-muted-foreground mb-1">会话备注</p>
                          <SessionNotesDetail sessionId={s.id} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
