---
name: Multi-tenant architecture
description: How data isolation and role-based access work across the chat system
---

## Role system
- `agents.role` column: `"agent"` (default) or `"super_admin"`
- JWT payload: `{ userId, role, username, agentId }` — `agentId` is kept for backward compat with old tokens
- `verifyToken` back-fills `userId = agentId` and `role = "agent"` for legacy tokens

## Data isolation
- Sessions: `sessions.agentId` doubles as `owner_id` — no separate column needed
- Messages: `messages.ownerId` explicitly set from `session.agentId` when message is saved (both WS and REST)
- DB indexes: `sessions_agent_id_idx`, `messages_owner_id_idx`

## Permission middleware (api-server/src/lib/middleware.ts)
- `requireAuth(req, res)` — returns payload or sends 401
- `requireSuperAdmin(req, res)` — returns payload or sends 401/403
- `extractAuth(req)` — returns payload or null (no side effects)

## Route rules
- `POST /sessions`, `GET /sessions/visitor-resume` — public (visitor entry points)
- `GET /sessions`, `GET /sessions/stats`, `GET /sessions/:id`, `GET /sessions/:id/messages`, `POST /sessions/:id/read` — requireAuth + ownership check for non-super_admin
- `/admin/*` — requireSuperAdmin only
- `GET /agents` — public (visitor picks agent)
- `POST /agent/login`, `GET /agent/me` — auth routes

## WebSocket scoping
- `ClientInfo` now includes `role` field
- `broadcastToSessionOwner(ownerId, data)` — only sends to agents where `info.agentId === ownerId` OR `info.role === "super_admin"`
- On `visitor_connect` and `ws.close`, the session's agentId is looked up from DB to route the broadcast

## Frontend
- Login stores `agent_role` in localStorage
- Dashboard reads `agentRole`, shows "客服管理" tab only for `super_admin`
- Crown badge shown next to username for super_admin
- Agents management panel has role selector (普通客服 / 超級管理員)

**Why:** Full data isolation — regular agents cannot see each other's visitors, sessions, or messages through any API or WebSocket path. Super admin bypasses all filters.
