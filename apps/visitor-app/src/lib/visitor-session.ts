import {
  syncVisitorIdToSession,
  getStoredVisitorNickname,
} from "@/lib/visitor-identity";

export { syncVisitorIdToSession } from "@/lib/visitor-identity";

export function isValidSessionId(raw: string | null): boolean {
  if (!raw) return false;
  const id = Number(raw);
  return Number.isInteger(id) && id > 0;
}

/** True when sessionStorage has a complete, usable visitor session for this agent. */
export function hasValidStoredSession(agentId: number): boolean {
  const storedAgentId = sessionStorage.getItem("agentId");
  if (storedAgentId !== String(agentId)) return false;

  const sessionId = sessionStorage.getItem("sessionId");
  const nickname = getStoredVisitorNickname();
  const visitorId = syncVisitorIdToSession();

  return isValidSessionId(sessionId) && !!nickname && !!visitorId;
}

/** Drop broken session fields but keep agentId/agentName for re-entry. */
export function clearInvalidSessionFields(): void {
  sessionStorage.removeItem("sessionId");
  sessionStorage.removeItem("visitorNickname");
  sessionStorage.removeItem("visitorId");
}

export function getStoredAgentName(): string {
  return sessionStorage.getItem("agentName") ?? "客服";
}

export function getStoredAgentAvatarUrl(): string | null {
  return sessionStorage.getItem("agentAvatarUrl");
}

export function setStoredAgentProfile(displayName: string, avatarUrl?: string | null): void {
  sessionStorage.setItem("agentName", displayName);
  if (avatarUrl) {
    sessionStorage.setItem("agentAvatarUrl", avatarUrl);
  } else {
    sessionStorage.removeItem("agentAvatarUrl");
  }
}

export function getStoredAgentId(): number | null {
  const raw = sessionStorage.getItem("agentId");
  if (!raw) return null;
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export function readStoredSessionOrNull(): {
  sessionId: number;
  visitorNickname: string;
  visitorId: string;
  agentId: number;
} | null {
  const agentIdRaw = sessionStorage.getItem("agentId");
  const agentId = agentIdRaw ? Number(agentIdRaw) : 0;
  const sessionIdRaw = sessionStorage.getItem("sessionId");
  const visitorNickname = getStoredVisitorNickname() ?? "";
  const visitorId = syncVisitorIdToSession() ?? "";

  if (!Number.isInteger(agentId) || agentId <= 0) return null;
  if (!isValidSessionId(sessionIdRaw) || !visitorNickname || !visitorId) {
    return null;
  }

  return {
    sessionId: Number(sessionIdRaw),
    visitorNickname,
    visitorId,
    agentId,
  };
}
