import { useQuery } from "@tanstack/react-query";
import { listAdminTransfers, getAdminTransfersQueryKey } from "@workspace/api-client-react";
import type { SessionTransfer } from "@workspace/api-client-react";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";

export default function TransfersPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: getAdminTransfersQueryKey(200),
    queryFn: () => listAdminTransfers(200),
    refetchInterval: 10000,
  });

  const transfers = (data?.transfers ?? []) as SessionTransfer[];

  return (
    <div className="p-8 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">转接记录</h1>
        <p className="text-sm text-muted-foreground mt-1">查看会话转接与接管历史</p>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-12 bg-muted/50 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <p className="text-destructive text-sm">加载失败</p>
      ) : transfers.length === 0 ? (
        <p className="text-muted-foreground text-center py-16">暂无转接记录</p>
      ) : (
        <div className="border border-border rounded-xl overflow-hidden overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">时间</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">会话</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">访客</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">转出</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">转入</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">操作人</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">原因</th>
              </tr>
            </thead>
            <tbody>
              {transfers.map((t) => (
                <tr key={t.id} className="border-t border-border hover:bg-accent/20">
                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                    {format(new Date(t.createdAt), "yyyy-MM-dd HH:mm", { locale: zhCN })}
                  </td>
                  <td className="px-4 py-3">#{t.sessionId}</td>
                  <td className="px-4 py-3">{t.visitorNickname ?? "—"}</td>
                  <td className="px-4 py-3">{t.fromAgentDisplayName ?? `#${t.fromAgentId}`}</td>
                  <td className="px-4 py-3">{t.toAgentDisplayName ?? `#${t.toAgentId}`}</td>
                  <td className="px-4 py-3">{t.initiatedByDisplayName ?? `#${t.initiatedBy}`}</td>
                  <td className="px-4 py-3 text-muted-foreground max-w-[200px] truncate">
                    {t.reason?.trim() || "—"}
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
