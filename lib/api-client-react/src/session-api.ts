import { customFetch } from "./custom-fetch";
import type { SessionStats, SessionSummary } from "./generated/api.schemas";

export type SessionFilterParams = { agentId?: number };

function withAgentIdQuery(path: string, params?: SessionFilterParams): string {
  const search = new URLSearchParams();
  if (params?.agentId != null) search.set("agentId", String(params.agentId));
  const qs = search.toString();
  return `/api${path}${qs ? `?${qs}` : ""}`;
}

export function getSessionsQueryKey(params?: SessionFilterParams) {
  return ["/api/sessions", params] as const;
}

export function getSessionStatsQueryKey(params?: SessionFilterParams) {
  return ["/api/sessions/stats", params] as const;
}

export async function listSessionsFiltered(
  params?: SessionFilterParams,
  options?: RequestInit,
): Promise<SessionSummary[]> {
  return customFetch<SessionSummary[]>(withAgentIdQuery("/sessions", params), {
    ...options,
    method: "GET",
  });
}

export async function getSessionStatsFiltered(
  params?: SessionFilterParams,
  options?: RequestInit,
): Promise<SessionStats> {
  return customFetch<SessionStats>(withAgentIdQuery("/sessions/stats", params), {
    ...options,
    method: "GET",
  });
}
