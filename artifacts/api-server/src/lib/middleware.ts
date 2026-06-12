import { Request, Response } from "express";
import { verifyToken, AgentPayload } from "./auth";

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
  if (payload.role !== "super_admin") {
    res.status(403).json({ error: "Forbidden: super_admin role required" });
    return null;
  }
  return payload;
}
