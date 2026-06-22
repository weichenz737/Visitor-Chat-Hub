import { useQuery } from "@tanstack/react-query";
import { getSessionStatsFiltered, getAdminListAgentsQueryKey, useAdminListAgents } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, MessageSquare, Activity } from "lucide-react";

export default function DashboardPage() {
  const { data: stats } = useQuery({
    queryKey: ["admin", "session-stats"],
    queryFn: () => getSessionStatsFiltered(undefined),
    refetchInterval: 10000,
  });

  const { data: agents = [] } = useAdminListAgents({
    query: { queryKey: getAdminListAgentsQueryKey() },
  });

  const activeAgents = agents.filter((a) => a.isActive && a.role === "agent").length;

  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">概览</h1>
        <p className="text-sm text-muted-foreground mt-1">系统运行概况（完整统计分析将在 P7 交付）</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">总会话数</CardTitle>
            <MessageSquare className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats?.total ?? "—"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">在线会话</CardTitle>
            <Activity className="w-4 h-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-green-600">{stats?.online ?? "—"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">启用客服</CardTitle>
            <Users className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{activeAgents}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
