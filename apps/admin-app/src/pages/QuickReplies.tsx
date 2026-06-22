import { useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import {
  useAdminListQuickReplies,
  useAdminCreateQuickReply,
  useAdminUpdateQuickReply,
  useAdminDeleteQuickReply,
  useAdminListAgents,
  getAdminListQuickRepliesQueryKey,
  getAdminListAgentsQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Search, ArrowLeft } from "lucide-react";

interface QuickReplyRow {
  id: number;
  agentId: number;
  title: string;
  content: string;
  createdAt: string;
  agentDisplayName?: string | null;
  agentUsername?: string | null;
}

type View = "list" | "create" | "edit";

const emptyForm = {
  agentId: "",
  title: "",
  content: "",
};

function formatCreatedAt(iso: string) {
  try {
    return format(new Date(iso), "yyyy-MM-dd HH:mm", { locale: zhCN });
  } catch {
    return iso;
  }
}

export default function QuickRepliesPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [view, setView] = useState<View>("list");
  const [agentFilter, setAgentFilter] = useState<number | "all">("all");
  const [search, setSearch] = useState("");
  const [editItem, setEditItem] = useState<QuickReplyRow | null>(null);

  const [form, setForm] = useState(emptyForm);
  const [editForm, setEditForm] = useState({ title: "", content: "" });

  const listParams = useMemo(
    () => ({
      agentId: agentFilter === "all" ? undefined : agentFilter,
      q: search.trim() || undefined,
    }),
    [agentFilter, search],
  );

  const { data: agents = [] } = useAdminListAgents({
    query: { queryKey: getAdminListAgentsQueryKey() },
  });

  const agentOptions = agents.filter((a) => a.role === "agent");

  const { data: replies = [], isLoading } = useAdminListQuickReplies(listParams);

  const createReply = useAdminCreateQuickReply();
  const updateReply = useAdminUpdateQuickReply();
  const deleteReply = useAdminDeleteQuickReply();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getAdminListQuickRepliesQueryKey() });
  };

  const backToList = () => {
    setView("list");
    setEditItem(null);
  };

  const handleCreate = () => {
    const agentId = Number(form.agentId);
    if (!agentId || !form.title.trim() || !form.content.trim()) return;
    createReply.mutate(
      {
        data: {
          agentId,
          title: form.title.trim(),
          content: form.content.trim(),
        },
      },
      {
        onSuccess: () => {
          invalidate();
          setForm(emptyForm);
          setView("list");
          toast({ title: "常用语已创建" });
        },
        onError: (err: Error) =>
          toast({ title: "创建失败", description: err.message, variant: "destructive" }),
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
          backToList();
          toast({ title: "已更新" });
        },
        onError: (err: Error) =>
          toast({ title: "更新失败", description: err.message, variant: "destructive" }),
      },
    );
  };

  const handleDelete = (item: QuickReplyRow) => {
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

  if (view === "create") {
    return (
      <div className="p-8 max-w-lg">
        <Button variant="ghost" size="sm" className="mb-4 gap-2 -ml-2" onClick={backToList}>
          <ArrowLeft className="w-4 h-4" />
          返回列表
        </Button>
        <Card>
          <CardHeader>
            <CardTitle>新增常用语</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {agentOptions.length === 0 ? (
              <p className="text-sm text-muted-foreground p-3 bg-muted/40 rounded-lg">
                暂无普通客服账号，请先在「客服管理」中创建客服后再添加常用语。
              </p>
            ) : (
              <Select value={form.agentId} onValueChange={(v) => setForm((p) => ({ ...p, agentId: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="选择客服 *" />
                </SelectTrigger>
                <SelectContent position="popper">
                  {agentOptions.map((a) => (
                    <SelectItem key={a.id} value={String(a.id)}>
                      {a.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Input
              placeholder="标题 *"
              value={form.title}
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
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
              disabled={
                agentOptions.length === 0 ||
                !form.agentId ||
                !form.title.trim() ||
                !form.content.trim() ||
                createReply.isPending
              }
            >
              {createReply.isPending ? "创建中..." : "创建"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (view === "edit" && editItem) {
    return (
      <div className="p-8 max-w-lg">
        <Button variant="ghost" size="sm" className="mb-4 gap-2 -ml-2" onClick={backToList}>
          <ArrowLeft className="w-4 h-4" />
          返回列表
        </Button>
        <Card>
          <CardHeader>
            <CardTitle>编辑常用语</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              所属客服：{editItem.agentDisplayName ?? "—"} (@{editItem.agentUsername ?? "—"})
            </p>
            <Input
              placeholder="标题"
              value={editForm.title}
              onChange={(e) => setEditForm((p) => ({ ...p, title: e.target.value }))}
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
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">快捷回复管理</h1>
          <p className="text-sm text-muted-foreground mt-1">管理全部客服的常用语</p>
        </div>
        <Button onClick={() => setView("create")} className="gap-2">
          <Plus className="w-4 h-4" />
          新增常用语
        </Button>
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        <Select
          value={agentFilter === "all" ? "all" : String(agentFilter)}
          onValueChange={(v) => setAgentFilter(v === "all" ? "all" : Number(v))}
        >
          <SelectTrigger className="w-44 h-9">
            <SelectValue placeholder="客服" />
          </SelectTrigger>
          <SelectContent position="popper">
            <SelectItem value="all">全部客服</SelectItem>
            {agentOptions.map((a) => (
              <SelectItem key={a.id} value={String(a.id)}>
                {a.displayName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="搜索标题或内容..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 bg-muted/50 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : (replies as QuickReplyRow[]).length === 0 ? (
        <div className="text-center py-16 border border-dashed border-border rounded-xl">
          <p className="text-muted-foreground mb-4">暂无常用语</p>
          <Button onClick={() => setView("create")} className="gap-2">
            <Plus className="w-4 h-4" />
            新增第一条常用语
          </Button>
        </div>
      ) : (
        <div className="border border-border rounded-xl overflow-hidden">
          <div className="grid grid-cols-[minmax(120px,1fr)_2fr_140px_80px] gap-3 px-4 py-3 bg-muted/40 text-xs font-medium text-muted-foreground border-b border-border">
            <span>标题</span>
            <span>内容</span>
            <span>创建时间</span>
            <span className="text-right">操作</span>
          </div>
          {(replies as QuickReplyRow[]).map((item) => (
            <div
              key={item.id}
              className="grid grid-cols-[minmax(120px,1fr)_2fr_140px_80px] gap-3 px-4 py-3 items-start border-b border-border last:border-b-0 bg-card hover:bg-accent/20 transition-colors"
            >
              <div className="min-w-0">
                <p className="font-medium text-sm text-foreground truncate">{item.title}</p>
                <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                  {item.agentDisplayName ?? "—"}
                </p>
              </div>
              <p className="text-sm text-muted-foreground line-clamp-2 whitespace-pre-wrap min-w-0">
                {item.content}
              </p>
              <p className="text-xs text-muted-foreground whitespace-nowrap">
                {formatCreatedAt(item.createdAt)}
              </p>
              <div className="flex justify-end gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setEditItem(item);
                    setEditForm({ title: item.title, content: item.content });
                    setView("edit");
                  }}
                  className="p-2 rounded-lg hover:bg-accent/50 text-muted-foreground"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(item)}
                  className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
