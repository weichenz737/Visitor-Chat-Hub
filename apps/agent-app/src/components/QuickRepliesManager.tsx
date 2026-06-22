import { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { useQueryClient } from "@tanstack/react-query";
import {
  useAgentListQuickReplies,
  useAgentCreateQuickReply,
  useAgentUpdateQuickReply,
  useAgentDeleteQuickReply,
  getAgentListQuickRepliesQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Search, ArrowLeft, X } from "lucide-react";

interface QuickReplyItem {
  id: number;
  title: string;
  content: string;
  createdAt: string;
}

type View = "list" | "create" | "edit";

function formatCreatedAt(iso: string) {
  try {
    return format(new Date(iso), "yyyy-MM-dd HH:mm", { locale: zhCN });
  } catch {
    return iso;
  }
}

export function QuickRepliesManager({
  open,
  onOpenChange,
  initialView = "list",
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initialView?: View;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [view, setView] = useState<View>("list");
  const [search, setSearch] = useState("");
  const [editItem, setEditItem] = useState<QuickReplyItem | null>(null);

  const [form, setForm] = useState({ title: "", content: "" });
  const [editForm, setEditForm] = useState({ title: "", content: "" });

  useEffect(() => {
    if (open) {
      setView(initialView);
      if (initialView !== "edit") setEditItem(null);
    } else {
      setView("list");
      setEditItem(null);
    }
  }, [open, initialView]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("keydown", onKeyDown);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prev;
    };
  }, [open, onOpenChange]);

  const listParams = useMemo(
    () => ({
      q: search.trim() || undefined,
    }),
    [search],
  );

  const { data: replies = [], isLoading } = useAgentListQuickReplies(listParams, {
    query: { enabled: open && view === "list" },
  });

  const createReply = useAgentCreateQuickReply();
  const updateReply = useAgentUpdateQuickReply();
  const deleteReply = useAgentDeleteQuickReply();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getAgentListQuickRepliesQueryKey() });
  };

  const handleCreate = () => {
    if (!form.title.trim() || !form.content.trim()) return;
    createReply.mutate(
      {
        data: {
          title: form.title.trim(),
          content: form.content.trim(),
        },
      },
      {
        onSuccess: () => {
          invalidate();
          setForm({ title: "", content: "" });
          setView("list");
          toast({ title: "常用语已添加" });
        },
        onError: (err: Error) =>
          toast({ title: "添加失败", description: err.message, variant: "destructive" }),
      },
    );
  };

  const handleUpdate = () => {
    if (!editItem) return;
    updateReply.mutate(
      {
        id: editItem.id,
        data: {
          title: editForm.title.trim() || undefined,
          content: editForm.content.trim() || undefined,
        },
      },
      {
        onSuccess: () => {
          invalidate();
          setEditItem(null);
          setView("list");
          toast({ title: "已更新" });
        },
        onError: (err: Error) =>
          toast({ title: "更新失败", description: err.message, variant: "destructive" }),
      },
    );
  };

  const handleDelete = (item: QuickReplyItem) => {
    if (!confirm(`确定删除「${item.title}」？`)) return;
    deleteReply.mutate(
      { id: item.id },
      {
        onSuccess: () => {
          invalidate();
          toast({ title: "已删除" });
        },
        onError: (err: Error) =>
          toast({ title: "删除失败", description: err.message, variant: "destructive" }),
      },
    );
  };

  const title =
    view === "create" ? "新增常用语" : view === "edit" ? "编辑常用语" : "我的常用语";

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[200]">
      <button
        type="button"
        aria-label="关闭"
        className="absolute inset-0 bg-black/80"
        onClick={() => onOpenChange(false)}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="quick-replies-manager-title"
        className="absolute left-1/2 top-1/2 z-[201] flex w-[calc(100%-2rem)] max-w-lg max-h-[85vh] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg border bg-background p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 mb-4 pr-8">
          {view !== "list" && (
            <button
              type="button"
              onClick={() => {
                setView("list");
                setEditItem(null);
              }}
              className="p-1 rounded-md hover:bg-accent/50 text-muted-foreground"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <h2 id="quick-replies-manager-title" className="text-lg font-semibold">
            {title}
          </h2>
        </div>

        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="absolute right-4 top-4 rounded-sm p-1 opacity-70 hover:opacity-100 text-muted-foreground hover:bg-accent/50"
        >
          <X className="w-4 h-4" />
        </button>

        {view === "list" && (
          <>
            <div className="flex gap-2 mb-3">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  placeholder="搜索标题或内容..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 h-8 text-xs"
                />
              </div>
              <Button size="sm" className="h-8 gap-1" onClick={() => setView("create")}>
                <Plus className="w-3.5 h-3.5" />
                新增
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto min-h-[200px]">
              {isLoading ? (
                <p className="text-sm text-muted-foreground text-center py-8">加载中...</p>
              ) : (replies as QuickReplyItem[]).length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm text-muted-foreground mb-3">暂无常用语</p>
                  <Button size="sm" onClick={() => setView("create")}>
                    新增常用语
                  </Button>
                </div>
              ) : (
                <div className="border border-border rounded-lg overflow-hidden">
                  <div className="grid grid-cols-[1fr_2fr_100px_56px] gap-2 px-3 py-2 bg-muted/40 text-[11px] font-medium text-muted-foreground border-b border-border">
                    <span>标题</span>
                    <span>内容</span>
                    <span>创建时间</span>
                    <span className="text-right">操作</span>
                  </div>
                  {(replies as QuickReplyItem[]).map((item) => (
                    <div
                      key={item.id}
                      className="grid grid-cols-[1fr_2fr_100px_56px] gap-2 px-3 py-2 items-start border-b border-border last:border-b-0 text-xs"
                    >
                      <span className="font-medium truncate">{item.title}</span>
                      <span className="text-muted-foreground line-clamp-2 whitespace-pre-wrap">
                        {item.content}
                      </span>
                      <span className="text-muted-foreground whitespace-nowrap">
                        {formatCreatedAt(item.createdAt)}
                      </span>
                      <div className="flex justify-end gap-0.5">
                        <button
                          type="button"
                          onClick={() => {
                            setEditItem(item);
                            setEditForm({ title: item.title, content: item.content });
                            setView("edit");
                          }}
                          className="p-1.5 rounded hover:bg-accent/50 text-muted-foreground"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(item)}
                          className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {view === "create" && (
          <div className="space-y-3 overflow-y-auto">
            <Input
              placeholder="标题 *"
              value={form.title}
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              autoFocus
            />
            <Textarea
              placeholder="回复内容 *"
              value={form.content}
              onChange={(e) => setForm((p) => ({ ...p, content: e.target.value }))}
              className="min-h-[120px] resize-none"
            />
            <Button
              className="w-full"
              onClick={handleCreate}
              disabled={!form.title.trim() || !form.content.trim() || createReply.isPending}
            >
              {createReply.isPending ? "保存中..." : "保存"}
            </Button>
          </div>
        )}

        {view === "edit" && (
          <div className="space-y-3 overflow-y-auto">
            <Input
              placeholder="标题"
              value={editForm.title}
              onChange={(e) => setEditForm((p) => ({ ...p, title: e.target.value }))}
              autoFocus
            />
            <Textarea
              placeholder="回复内容"
              value={editForm.content}
              onChange={(e) => setEditForm((p) => ({ ...p, content: e.target.value }))}
              className="min-h-[120px] resize-none"
            />
            <Button className="w-full" onClick={handleUpdate} disabled={updateReply.isPending}>
              {updateReply.isPending ? "保存中..." : "保存"}
            </Button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
