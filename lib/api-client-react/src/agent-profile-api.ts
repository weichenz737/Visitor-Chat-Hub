import { useMutation } from "@tanstack/react-query";
import type { UseMutationOptions } from "@tanstack/react-query";
import { customFetch } from "./custom-fetch";
import type { AgentInfo, UpdateAgentMeBody } from "./generated/api.schemas";

export async function updateAgentMe(data: UpdateAgentMeBody): Promise<AgentInfo> {
  return customFetch<AgentInfo>("/api/agent/me", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function changeAgentPassword(data: {
  currentPassword: string;
  newPassword: string;
}): Promise<{ success: boolean }> {
  return customFetch("/api/agent/me/password", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export function useUpdateAgentMe(
  options?: Omit<
    UseMutationOptions<AgentInfo, Error, UpdateAgentMeBody>,
    "mutationFn"
  >,
) {
  return useMutation({
    mutationFn: updateAgentMe,
    ...options,
  });
}
