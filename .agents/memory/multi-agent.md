---
name: Multi-agent feature
description: How multi-agent support is structured across DB, API, and frontend
---

# Multi-agent feature

## DB Schema additions (lib/db/src/schema/agents.ts)
- `displayName` — shown in visitor agent list and dashboard
- `avatarUrl` — optional profile picture (URL from /api/upload/image)
- `introduction` — shown as subtitle in visitor list
- `isActive` — when false, agent is hidden from visitor list

## API Routes
- `GET /agents` — public, lists active agents (id, displayName, avatarUrl, introduction)
- `GET /admin/agents` — JWT-protected, full agent data including username/createdAt
- `POST /admin/agents` — create agent (body: CreateAgentBody)
- `PATCH /admin/agents/:id` — update agent (body: UpdateAgentBody)
- `DELETE /admin/agents/:id` — delete agent

## Frontend flow
- Visitor root `/` → `AgentList.tsx` → modal dialog for name → creates session with agentId → `/chat`
- Agent dashboard has two tabs: 對話列表 (chat) and 客服管理 (agents tab shows AgentManagementPanel)
- sessionStorage keys: `sessionId`, `visitorNickname`, `agentId`, `agentName`

## Seed
- admin user seeded with displayName=管理員, introduction=系統管理員帳號 (SQL UPDATE, not migration)

**Why:** Visitors must choose which agent to contact before chatting; agents are managed by admin from the dashboard without a separate admin UI.
