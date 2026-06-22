import { customFetch } from "./custom-fetch";

export async function resetAgentPassword(agentId: number, password: string): Promise<{ success: boolean }> {
  return customFetch(`/api/admin/agents/${agentId}/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
}

export async function getAdminMe(): Promise<{ userId: number; username: string; role: string }> {
  return customFetch("/api/admin/me", { method: "GET" });
}

export async function changeAdminPassword(data: {
  currentPassword: string;
  newPassword: string;
}): Promise<{ success: boolean }> {
  return customFetch("/api/admin/me/password", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}
