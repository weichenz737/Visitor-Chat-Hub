import { useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useAgentListQuickReplies,
  getAgentListQuickRepliesQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Zap, Search, Settings2 } from "lucide-react";
import { QuickRepliesManager } from "./QuickRepliesManager";

interface QuickReplyItem {
  id: number;
  title: string;
  content: string;
  createdAt: string;
}

export function QuickReplyPicker({
  disabled,
  onSend,
}: {
  disabled?: boolean;
  onSend: (content: string) => void;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [manageInitialView, setManageInitialView] = useState<"list" | "create">("list");
  const [search, setSearch] = useState("");

  const listParams = useMemo(
    () => ({
      q: search.trim() || undefined,
    }),
    [search],
  );

  const { data: replies = [], isLoading } = useAgentListQuickReplies(listParams, {
    query: { enabled: open },
  });

  const handlePick = (content: string) => {
    onSend(content);
    setOpen(false);
  };

  const openManager = (view: "list" | "create") => {
    setOpen(false);
    setManageInitialView(view);
    setManageOpen(true);
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen} modal>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            title="快捷回复"
            className="p-2.5 rounded-xl border border-border hover:bg-accent/50 transition-colors text-muted-foreground disabled:opacity-50"
          >
            <Zap className="w-5 h-5" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-3 bg-card border-border shadow-xl" align="start" side="top">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold">快捷回复</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={() => openManager("list")}
            >
              <Settings2 className="w-3.5 h-3.5" />
              管理
            </Button>
          </div>
          <div className="relative mb-2">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="搜索标题或内容..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-xs"
            />
          </div>
          <div className="max-h-52 overflow-y-auto space-y-1">
            {isLoading ? (
              <p className="text-xs text-muted-foreground text-center py-4">加载中...</p>
            ) : (replies as QuickReplyItem[]).length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">
                暂无常用语，
                <button
                  type="button"
                  className="text-primary underline-offset-2 hover:underline"
                  onClick={() => openManager("create")}
                >
                  去添加
                </button>
              </p>
            ) : (
              (replies as QuickReplyItem[]).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handlePick(item.content)}
                  className="w-full text-left px-2 py-2 rounded-lg hover:bg-accent/60 transition-colors"
                >
                  <p className="text-xs font-medium text-foreground truncate">{item.title}</p>
                  <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">{item.content}</p>
                </button>
              ))
            )}
          </div>
        </PopoverContent>
      </Popover>
      <QuickRepliesManager
        open={manageOpen}
        initialView={manageInitialView}
        onOpenChange={(o) => {
          setManageOpen(o);
          if (!o) setManageInitialView("list");
          if (!o) {
            queryClient.invalidateQueries({ queryKey: getAgentListQuickRepliesQueryKey() });
          }
        }}
      />
    </>
  );
}
