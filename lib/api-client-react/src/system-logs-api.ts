import { customFetch } from "./custom-fetch";
import type { AdminLogsResponse } from "./generated/api.schemas";

export function getAdminLogsQueryKey(limit?: number, action?: string) {
  return ["/api/admin/logs", limit ?? 100, action ?? ""] as const;
}

export async function listAdminLogs(limit = 100, action?: string): Promise<AdminLogsResponse> {
  const params = new URLSearchParams();
  if (limit !== 100) params.set("limit", String(limit));
  if (action) params.set("action", action);
  const qs = params.toString();
  return customFetch<AdminLogsResponse>(`/api/admin/logs${qs ? `?${qs}` : ""}`, {
    method: "GET",
  });
}
