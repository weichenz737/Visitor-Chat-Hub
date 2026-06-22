/** Build visitor chat URL for a reception agent (not super_admin). */
export function buildAgentChatUrl(agentId: number): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "") || "";
  const origin = typeof window !== "undefined" ? window.location.origin.replace(/\/$/, "") : "";
  return `${origin}${base}/chat/${agentId}`;
}

export function parseAgentIdFromLocation(path: string, search: string): number | null {
  const tryParseId = (raw: string | null | undefined): number | null => {
    if (!raw) return null;
    const id = Number(raw);
    return Number.isInteger(id) && id > 0 ? id : null;
  };

  const fromQuery = new URLSearchParams(search);
  const queryId = tryParseId(fromQuery.get("agentId") ?? fromQuery.get("agent"));
  if (queryId) return queryId;

  const pathMatch = path.match(/\/chat\/(?:agent-)?(\d+)\/?$/);
  if (pathMatch) {
    return tryParseId(pathMatch[1]);
  }

  const combined = `${path}${search}`;
  if (combined.includes("agentId=") || combined.includes("/chat/")) {
    try {
      const url = new URL(combined, typeof window !== "undefined" ? window.location.origin : "http://localhost");
      const fromUrlQuery = tryParseId(url.searchParams.get("agentId") ?? url.searchParams.get("agent"));
      if (fromUrlQuery) return fromUrlQuery;
      const urlPathMatch = url.pathname.match(/\/chat\/(?:agent-)?(\d+)\/?$/);
      if (urlPathMatch) return tryParseId(urlPathMatch[1]);
    } catch {
      // ignore malformed URLs
    }
  }

  return null;
}
