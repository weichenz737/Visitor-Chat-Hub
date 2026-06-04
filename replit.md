# 客服聊天系统 (Customer Service Chat)

Real-time customer service chat system with a visitor web interface and an agent dashboard. Supports text + image messages and multiple simultaneous conversations.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080, exposed at `/api` and `/ws`)
- `pnpm --filter @workspace/chat-app run dev` — run the frontend (exposed at `/`)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string, `SESSION_SECRET` — JWT secret

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + shadcn/ui + Tailwind CSS + Wouter (routing) + TanStack Query
- API: Express 5 + ws (WebSocket) + JWT auth (bcryptjs) + multer (image upload)
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec → React Query hooks)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — OpenAPI spec (source of truth for API contract)
- `lib/api-client-react/src/generated/` — generated React Query hooks and Zod schemas
- `lib/db/src/schema.ts` — DB schema (agents, sessions, messages tables)
- `artifacts/api-server/src/index.ts` — API server entrypoint (Express + WebSocket)
- `artifacts/api-server/src/routes/` — route handlers (sessions, messages, agent, upload)
- `artifacts/api-server/src/lib/websocket.ts` — WebSocket server logic
- `artifacts/chat-app/src/pages/visitor/` — visitor chat UI (Landing + Chat)
- `artifacts/chat-app/src/pages/agent/` — agent dashboard UI (Login + Dashboard)
- `artifacts/chat-app/src/hooks/useChat.ts` — WebSocket hook with reconnect logic
- `artifacts/api-server/uploads/` — uploaded image files

## Architecture decisions

- Contract-first API: OpenAPI spec → Orval codegen → typed React Query hooks used everywhere
- WebSocket path `/ws` handled by a raw `ws` server attached to the same HTTP server as Express
- Images uploaded via `POST /api/upload/image` (multipart), served statically from `/uploads/`
- JWT auth for agents (stored in `localStorage`), no auth for visitors (session identified by ID in `sessionStorage`)
- WS reconnect with exponential backoff (1s → 30s cap) built into `useChat.ts`

## Product

- **Visitor flow**: Enter name → `/` landing → create session → real-time chat at `/chat`
- **Agent flow**: Login with username/password → `/agent/dashboard` → see all sessions, pick one to reply
- Both sides send text and images; messages persist in PostgreSQL
- Dashboard shows live visitor count, unread counts, online/offline status (updated every 3s)
- Default agent credentials: `admin` / `admin123`

## User preferences

- UI style: WeChat/WhatsApp inspired, blue/slate theme, clean modern SaaS design
- Chinese project name (客服聊天系统)

## Gotchas

- WS messages must include `sessionId` — the server routes them to the correct session room
- Never call service ports directly; always use the shared proxy at `localhost:80`
- Run `pnpm --filter @workspace/api-spec run codegen` after any OpenAPI spec change
- Run `pnpm --filter @workspace/db run push` after any schema change (dev only)
- Image upload hook (`useImageUpload.ts`) uses native `fetch` (not customFetch) — no Auth header needed

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
