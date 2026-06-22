/** Build visitor chat URL for a reception agent (not super_admin). */
export function buildAgentChatUrl(agentId: number): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "") || "";
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}${base}/chat?agentId=${agentId}`;
}

export function buildAgentChatQrUrl(agentId: number, size = 200): string {
  const chatUrl = buildAgentChatUrl(agentId);
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(chatUrl)}`;
}

export function parseAgentIdFromLocation(
  path: string,
  search: string,
): number | null {
  const query = new URLSearchParams(search);
  const fromQuery = query.get("agentId") ?? query.get("agent");
  if (fromQuery) {
    const id = Number(fromQuery);
    if (Number.isInteger(id) && id > 0) return id;
  }
  const pathMatch = path.match(/\/chat\/(?:agent-)?(\d+)\/?$/);
  if (pathMatch) {
    const id = Number(pathMatch[1]);
    if (Number.isInteger(id) && id > 0) return id;
  }
  return null;
}
