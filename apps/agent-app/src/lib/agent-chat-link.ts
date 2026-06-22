/** Avoid Windows resolving localhost → broken [::1] docker port forwards. */
function normalizeLocalDevOrigin(origin: string): string {
  try {
    const url = new URL(origin);
    if (url.hostname === "localhost") {
      url.hostname = "127.0.0.1";
    }
    return url.origin.replace(/\/$/, "");
  } catch {
    return origin.replace("://localhost", "://127.0.0.1").replace(/\/$/, "");
  }
}

/** Public origin of the visitor-facing app (never the agent console origin). */
export function getVisitorAppOrigin(): string {
  const configured = import.meta.env.VITE_VISITOR_APP_URL?.trim();
  if (configured) {
    return normalizeLocalDevOrigin(configured.replace(/\/$/, ""));
  }

  if (typeof window !== "undefined") {
    const { protocol, hostname, port } = window.location;
    const host = hostname === "localhost" ? "127.0.0.1" : hostname;
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      // Local docker: agent 5174 / admin 5175 / visitor 5173 — never reuse agent origin
      if (port === "5174" || port === "5175") {
        return `${protocol}//${host}:5173`;
      }
      const visitorPort = import.meta.env.VITE_VISITOR_APP_PORT?.trim() || "5173";
      if (port && port !== visitorPort) {
        return `${protocol}//${host}:${visitorPort}`;
      }
      if (!port || port === visitorPort) {
        return `${protocol}//${host}:5173`;
      }
    }
  }

  const fallback =
    typeof window !== "undefined" ? window.location.origin.replace(/\/$/, "") : "";
  return fallback ? normalizeLocalDevOrigin(fallback) : "";
}

function getVisitorAppBasePath(): string {
  const configured = import.meta.env.VITE_VISITOR_BASE_PATH?.trim();
  if (configured) {
    return configured.replace(/\/$/, "") || "";
  }
  return "";
}

/** Build visitor chat URL for a reception agent (not super_admin). */
export function buildAgentChatUrl(agentId: number): string {
  if (!Number.isInteger(agentId) || agentId <= 0) return "";
  const origin = getVisitorAppOrigin();
  if (!origin) return "";
  const base = getVisitorAppBasePath();
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

/** Redirect wrong-port /chat links opened on the agent app to the visitor app. */
export function redirectToVisitorChat(agentId: number): void {
  const url = buildAgentChatUrl(agentId);
  if (url) window.location.replace(url);
}

/** Admin console origin (never reuse agent port). */
export function getAdminAppUrl(): string {
  const configured = import.meta.env.VITE_ADMIN_APP_URL?.trim();
  if (configured) {
    return normalizeLocalDevOrigin(configured.replace(/\/$/, ""));
  }

  if (typeof window !== "undefined") {
    const { protocol, hostname } = window.location;
    const host = hostname === "localhost" ? "127.0.0.1" : hostname;
    return `${protocol}//${host}:5175`;
  }

  return "http://127.0.0.1:5175";
}

const ADMIN_WINDOW_NAME = "visitor-chat-admin";

/** Open admin console in a single named tab (avoids duplicate tabs on repeated clicks). */
export function openAdminApp(options?: {
  bridgeToken?: string | null;
  bridgeUsername?: string | null;
  bridgeRole?: string | null;
  bridgeUserId?: string | null;
}): void {
  const url = new URL(getAdminAppUrl());
  const { bridgeToken, bridgeUsername, bridgeRole, bridgeUserId } = options ?? {};

  if (bridgeToken && bridgeRole === "super_admin") {
    url.searchParams.set("bridge", "1");
    url.searchParams.set("token", bridgeToken);
    url.searchParams.set("role", bridgeRole);
    if (bridgeUsername) url.searchParams.set("username", bridgeUsername);
    if (bridgeUserId) url.searchParams.set("userId", bridgeUserId);
  }

  window.open(url.toString(), ADMIN_WINDOW_NAME, "noopener,noreferrer");
}
