import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getAdminLogsQueryKey, listAdminLogs } from "@workspace/api-client-react";
import type { SystemLog } from "@workspace/api-client-react";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ACTION_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "全部操作" },
  { value: "agent.login.success", label: "登录成功" },
  { value: "agent.login.failed", label: "登录失败" },
  { value: "agent.password.change", label: "客服修改密码" },
  { value: "admin.agent.create", label: "创建客服" },
  { value: "admin.agent.update", label: "更新客服" },
  { value: "admin.agent.delete", label: "删除客服" },
  { value: "admin.agent.reset_password", label: "重置密码" },
  { value: "admin.password.change", label: "修改密码" },
  { value: "session.transfer", label: "会话转接" },
];

const ACTION_LABELS: Record<string, string> = Object.fromEntries(
  ACTION_OPTIONS.filter((o) => o.value).map((o) => [o.value, o.label]),
);

function formatAction(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

function formatTarget(log: SystemLog): string {
  if (!log.targetType) return "—";
  const id = log.targetId != null ? `#${log.targetId}` : "";
  const typeLabel =
    log.targetType === "agent" ? "客服" : log.targetType === "session" ? "会话" : log.targetType;
  return `${typeLabel}${id}`;
}

function formatDetail(detail: string | null | undefined): string {
  if (!detail?.trim()) return "—";
  try {
    const parsed = JSON.parse(detail) as Record<string, unknown>;
    if (parsed.reason === "invalid_credentials") return "账号不存在或已禁用";
    if (parsed.reason === "invalid_password") return "密码错误";

    const parts: string[] = [];
    if (typeof parsed.username === "string") parts.push(`账号: ${parsed.username}`);
    if (typeof parsed.displayName === "string") parts.push(`昵称: ${parsed.displayName}`);
    if (typeof parsed.role === "string") parts.push(`角色: ${parsed.role}`);
    if (typeof parsed.reason === "string") parts.push(`原因: ${parsed.reason}`);
    if (parsed.fromAgentId != null && parsed.toAgentId != null) {
      parts.push(`${parsed.fromAgentId} → ${parsed.toAgentId}`);
    }
    if (typeof parsed.visitorNickname === "string") parts.push(`访客: ${parsed.visitorNickname}`);
    if (Array.isArray(parsed.changed) && parsed.changed.length > 0) {
      parts.push(`变更: ${parsed.changed.join(", ")}`);
    }
    return parts.length > 0 ? parts.join(" · ") : detail;
  } catch {
    return detail;
  }
}

export default function LogsPage() {
  const [actionFilter, setActionFilter] = useState("");
  const limit = 200;

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: getAdminLogsQueryKey(limit, actionFilter || undefined),
    queryFn: () => listAdminLogs(limit, actionFilter || undefined),
    refetchInterval: 15000,
  });

  const logs = data?.logs ?? [];

  return (
    <div className="p-8 max-w-6xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">系统日志</h1>
          <p className="text-sm text-muted-foreground mt-1">记录登录、客服管理与会话转接等关键操作</p>
        </div>
        <div className="flex items-center gap-3">
          <Select
            value={actionFilter || "all"}
            onValueChange={(v) => setActionFilter(v === "all" ? "" : v)}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="筛选操作" />
            </SelectTrigger>
            <SelectContent>
              {ACTION_OPTIONS.map((opt) => (
                <SelectItem key={opt.value || "all"} value={opt.value || "all"}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <button
            type="button"
            onClick={() => refetch()}
            className="text-sm text-primary hover:underline disabled:opacity-50"
            disabled={isFetching}
          >
            {isFetching ? "刷新中…" : "刷新"}
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-12 bg-muted/50 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <p className="text-destructive text-sm">加载失败</p>
      ) : logs.length === 0 ? (
        <p className="text-muted-foreground text-center py-16">暂无日志记录</p>
      ) : (
        <div className="border border-border rounded-xl overflow-hidden overflow-x-auto">
          <table className="w-full text-sm min-w-[880px]">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">时间</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">操作</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">操作人</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">对象</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">详情</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">IP</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-t border-border hover:bg-accent/20">
                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                    {format(new Date(log.createdAt), "yyyy-MM-dd HH:mm:ss", { locale: zhCN })}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">{formatAction(log.action)}</td>
                  <td className="px-4 py-3">
                    {log.actorUsername ?? "—"}
                    {log.actorRole ? (
                      <span className="text-muted-foreground text-xs ml-1">({log.actorRole})</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">{formatTarget(log)}</td>
                  <td className="px-4 py-3 text-muted-foreground max-w-[280px] truncate" title={formatDetail(log.detail)}>
                    {formatDetail(log.detail)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                    {log.ipAddress ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
