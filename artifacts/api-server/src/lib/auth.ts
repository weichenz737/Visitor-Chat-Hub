import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET ?? "chat_secret_key_change_in_production";

export interface AgentPayload {
  agentId: number;
  username: string;
}

export function signToken(payload: AgentPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "24h" });
}

export function verifyToken(token: string): AgentPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as AgentPayload;
  } catch {
    return null;
  }
}
