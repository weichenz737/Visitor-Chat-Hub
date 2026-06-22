import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getSessionNotes,
  putSessionNotes,
  getSessionNotesQueryKey,
  getSessionsQueryKey,
  ApiError,
  type SessionFilterParams,
} from "@workspace/api-client-react";
import type { SessionNote } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, StickyNote } from "lucide-react";
import { format } from "date-fns";
import { zhTW } from "date-fns/locale";

interface SessionNotePanelProps {
  sessionId: number;
  viewerAgentId: number;
  sessionAgentId: number | null;
  isSuperAdmin: boolean;
  sessionFilterParams?: SessionFilterParams;
}

function formatError(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    const data = err.data as { error?: string } | null;
    return data?.error ?? err.message;
  }
  if (err instanceof Error) {
    if (err.message === "Failed to fetch") {
      return "无法连接服务器，请使用 http://127.0.0.1:5174 打开客服工作台";
    }
    return err.message;
  }
  return fallback;
}

export function SessionNotePanel({
  sessionId,
  viewerAgentId,
  sessionAgentId,
  isSuperAdmin,
  sessionFilterParams,
}: SessionNotePanelProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const canEditNotes = isSuperAdmin || (sessionAgentId != null && sessionAgentId === viewerAgentId);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: getSessionNotesQueryKey(sessionId),
    queryFn: () => getSessionNotes(sessionId),
    enabled: sessionId > 0,
    staleTime: Infinity,
    gcTime: 30 * 60 * 1000,
  });

  const notes = data?.notes ?? [];
  const loadError = isError ? formatError(error, "加载备注失败") : null;
  const showLoading = isLoading && !data;

  const myNote = useMemo(
    () => notes.find((n) => n.agentId === viewerAgentId),
    [notes, viewerAgentId],
  );

  const ownerNote = useMemo(() => {
    if (sessionAgentId == null || sessionAgentId === viewerAgentId) return null;
    const note = notes.find((n) => n.agentId === sessionAgentId);
    return note?.content.trim() ? note : null;
  }, [notes, sessionAgentId, viewerAgentId]);

  const myContent = myNote?.content ?? "";
  const hasMyContent = myContent.trim().length > 0;
  const lastSavedAt = myNote?.updatedAt ? new Date(myNote.updatedAt) : null;

  useEffect(() => {
    setIsEditing(false);
    setSaveError(null);
    setDraft(myNote?.content ?? "");
  }, [sessionId, myNote?.content]);

  useEffect(() => {
    if (isEditing) textareaRef.current?.focus();
  }, [isEditing]);

  const startEditing = () => {
    if (!canEditNotes || saving) return;
    setDraft(myNote?.content ?? "");
    setSaveError(null);
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setDraft(myNote?.content ?? "");
    setSaveError(null);
    setIsEditing(false);
  };

  const handleSave = async () => {
    if (!canEditNotes || saving) return;

    if (!localStorage.getItem("agent_token")) {
      setSaveError("尚未登录，请重新登录后再试");
      return;
    }

    setSaving(true);
    setSaveError(null);
    try {
      const saved = await putSessionNotes(sessionId, { content: draft });
      const savedAt = new Date(saved.updatedAt);
      queryClient.setQueryData(getSessionNotesQueryKey(sessionId), (old) => {
        const prev = (old as { notes: SessionNote[] } | undefined)?.notes ?? [];
        const rest = prev.filter((n) => n.agentId !== saved.agentId);
        return { notes: [...rest, { ...saved, canEdit: true }] };
      });
      queryClient.invalidateQueries({ queryKey: getSessionsQueryKey(sessionFilterParams) });
      setIsEditing(false);
      toast({
        title: "备注已保存",
        description: `已更新于 ${format(savedAt, "HH:mm:ss")}`,
      });
    } catch (err) {
      const message = formatError(err, "保存失败");
      setSaveError(message);
      toast({ title: "保存失败", description: message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="border-b border-border bg-muted/30 px-6 py-3 shrink-0">
      <div className="flex items-center gap-2 mb-2">
        <StickyNote
          className={`w-4 h-4 shrink-0 ${hasMyContent || ownerNote ? "text-amber-600" : "text-muted-foreground"}`}
        />
        <span className="text-sm font-medium text-foreground">会话备注</span>
        <span className="text-xs text-muted-foreground">（仅客服可见）</span>
        {lastSavedAt && !isEditing && (
          <span className="text-xs text-muted-foreground ml-auto">
            上次保存 {format(lastSavedAt, "HH:mm", { locale: zhTW })}
          </span>
        )}
      </div>

      {showLoading ? (
        <p className="text-xs text-muted-foreground py-2">加载中…</p>
      ) : loadError ? (
        <div className="space-y-2 py-1">
          <p className="text-xs text-destructive">{loadError}</p>
          <Button type="button" size="sm" variant="outline" onClick={() => void refetch()}>
            重试
          </Button>
        </div>
      ) : isEditing && canEditNotes ? (
        <div className="space-y-2">
          {ownerNote && <ReadOnlyNoteBlock note={ownerNote} label="负责客服备注" />}
          <Textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="记录访客需求、注意事项等内部备注…"
            className="min-h-[96px] text-sm resize-y bg-background"
            maxLength={10000}
          />
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">{draft.length}/10000</span>
            <div className="flex items-center gap-2">
              <Button type="button" size="sm" variant="outline" onClick={cancelEditing} disabled={saving}>
                取消
              </Button>
              <Button type="button" size="sm" onClick={() => void handleSave()} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    保存中…
                  </>
                ) : (
                  "保存备注"
                )}
              </Button>
            </div>
          </div>
          {saveError && <p className="text-xs text-destructive">{saveError}</p>}
        </div>
      ) : (
        <div className="space-y-2">
          {ownerNote && <ReadOnlyNoteBlock note={ownerNote} label="负责客服备注" />}

          {canEditNotes ? (
            <div
              role="button"
              tabIndex={0}
              onClick={startEditing}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  startEditing();
                }
              }}
              className="w-full text-left rounded-lg border border-border bg-background px-3 py-3 min-h-[52px] cursor-pointer hover:border-primary/50 hover:bg-accent/30 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              {hasMyContent ? (
                <p className="text-sm text-foreground whitespace-pre-wrap break-words leading-relaxed">
                  {myContent}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">点击添加内部备注…</p>
              )}
            </div>
          ) : notes.some((n) => n.content.trim()) ? (
            notes
              .filter((n) => n.content.trim())
              .map((note) => <ReadOnlyNoteBlock key={note.id} note={note} />)
          ) : (
            <p className="text-sm text-muted-foreground py-2">此会话尚无备注</p>
          )}
        </div>
      )}
    </div>
  );
}

function ReadOnlyNoteBlock({ note, label }: { note: SessionNote; label?: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-background/80 px-3 py-2.5">
      <div className="flex items-center justify-between gap-2 mb-1">
        <p className="text-xs font-medium text-muted-foreground">
          {label ?? note.agentDisplayName ?? `客服 #${note.agentId}`}
        </p>
        <span className="text-xs text-muted-foreground">
          {format(new Date(note.updatedAt), "yyyy-MM-dd HH:mm", { locale: zhTW })}
        </span>
      </div>
      <p className="text-sm text-foreground whitespace-pre-wrap break-words leading-relaxed">
        {note.content}
      </p>
    </div>
  );
}
