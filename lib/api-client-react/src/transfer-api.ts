import { customFetch } from "./custom-fetch";
import type {
  AdminTransfersResponse,
  SessionTransfersResponse,
  TransferSessionBody,
  TransferSessionResponse,
} from "./generated/api.schemas";

export function getSessionTransfersQueryKey(sessionId: number) {
  return ["/api/sessions", sessionId, "transfers"] as const;
}

export function getAdminTransfersQueryKey(limit?: number) {
  return ["/api/admin/transfers", limit ?? 100] as const;
}

export async function transferSession(
  sessionId: number,
  body: TransferSessionBody,
): Promise<TransferSessionResponse> {
  return customFetch<TransferSessionResponse>(`/api/sessions/${sessionId}/transfer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function getSessionTransfers(sessionId: number): Promise<SessionTransfersResponse> {
  return customFetch<SessionTransfersResponse>(`/api/sessions/${sessionId}/transfers`, {
    method: "GET",
  });
}

export async function listAdminTransfers(limit = 100): Promise<AdminTransfersResponse> {
  const qs = limit !== 100 ? `?limit=${limit}` : "";
  return customFetch<AdminTransfersResponse>(`/api/admin/transfers${qs}`, {
    method: "GET",
  });
}
