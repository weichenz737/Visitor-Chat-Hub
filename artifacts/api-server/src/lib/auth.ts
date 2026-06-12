import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET ?? "chat_secret_key_change_in_production";

export type UserRole = "agent" | "super_admin";

export interface AgentPayload {
  userId: number;
  role: UserRole;
  username: string;
  /** @deprecated use userId */
  agentId: number;
}

export function signToken(payload: { userId: number; role: UserRole; username: string }): string {
  return jwt.sign({ ...payload, agentId: payload.userId }, JWT_SECRET, { expiresIn: "24h" });
}

export function verifyToken(token: string): AgentPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AgentPayload;
    // Support legacy tokens that only have agentId (no userId/role)
    if (!decoded.userId && decoded.agentId) {
      decoded.userId = decoded.agentId;
      decoded.role = decoded.role ?? "agent";
    }
    return decoded;
  } catch {
    return null;
  }
}
