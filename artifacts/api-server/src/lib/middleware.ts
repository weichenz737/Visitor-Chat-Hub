import { Request, Response } from "express";
import { verifyToken, AgentPayload } from "./auth";
import { isSuperAdmin, hasPermission, Permission, canAccessSession } from "./permissions";

export function extractAuth(req: Request): AgentPayload | null {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return null;
  return verifyToken(authHeader.slice(7));
}

export function requireAuth(req: Request, res: Response): AgentPayload | null {
  const payload = extractAuth(req);
  if (!payload) {
    res.status(401).json({ error: "Not authenticated" });
    return null;
  }
  return payload;
}

export function requireSuperAdmin(req: Request, res: Response): AgentPayload | null {
  const payload = requireAuth(req, res);
  if (!payload) return null;
  if (!isSuperAdmin(payload.role)) {
    res.status(403).json({ error: "Forbidden: super_admin role required" });
    return null;
  }
  return payload;
}

export function requirePermission(
  req: Request,
  res: Response,
  permission: (typeof Permission)[keyof typeof Permission],
): AgentPayload | null {
  const payload = requireAuth(req, res);
  if (!payload) return null;
  if (!hasPermission(payload.role, permission)) {
    res.status(403).json({ error: `Forbidden: missing permission ${permission}` });
    return null;
  }
  return payload;
}

export function requireSessionAccess(
  req: Request,
  res: Response,
  sessionAgentId: number | null | undefined,
): AgentPayload | null {
  const payload = requireAuth(req, res);
  if (!payload) return null;
  if (!canAccessSession(payload.role, payload.userId, sessionAgentId)) {
    res.status(403).json({ error: "Forbidden" });
    return null;
  }
  return payload;
}
