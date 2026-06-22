# P3 阶段功能设计与开发规划

> 版本：v1.0 · 2026-06-17  
> 范围：客服个人信息、访客端客服信息栏、客服 ID 统一后台治理

---

## 1. 背景与目标

### 1.1 P3 阶段定位

P3 在 P0（权限/后台）、P1（快捷回复）、P2（未读/会话）之上，完成**客服身份体系的产品化闭环**：

| 维度 | 目标 |
|------|------|
| 身份 | 客服昵称、头像可维护，修改后全局即时生效 |
| 展示 | 访客聊天页顶部展示客服头像、昵称、在线状态 |
| 治理 | `agent_id` 仅由后台创建，会话绑定以数据库为准，禁止前端伪造 |

### 1.2 与已完成 P3 工作的关系

以下能力已在前期 P3 迭代中落地（迁移 `005`/`006`），**本规划不重复开发**：

- 会话已读游标：`last_message_id` / `agent_last_read_msg_id` / `visitor_last_read_msg_id`
- 未读计算：`last_message_id - *_last_read_msg_id`
- 访客在线：`sessions.last_seen_at` + 12s 心跳，60s 窗口
- WS 消息优先推送，未读/状态异步处理

本规划聚焦**客服侧身份与展示**，与上述已读/在线模型并行、不冲突。

---

## 2. 现状评估

### 2.1 已有能力（可直接复用）

| 模块 | 现状 | 文件 |
|------|------|------|
| DB 客服表 | `id`(serial)、`display_name`、`avatar_url`、`is_active`、`role` | `lib/db/src/schema/agents.ts` |
| 后台 CRUD | 创建/编辑/禁用/删/重置密码，含头像上传 | `apps/admin-app/src/pages/Agents.tsx` |
| 管理 API | `POST/PATCH/DELETE /admin/agents` | `artifacts/api-server/src/routes/admin.ts` |
| 公开客服信息 | `GET /agents/:id` 返回 `displayName`、`avatarUrl` | `artifacts/api-server/src/routes/agent.ts` |
| 会话绑定校验 | `findAssignableAgent()` 校验 active + 非 super_admin | `artifacts/api-server/src/lib/agents.ts` |
| agent_id 来源 | DB serial，仅 admin `POST` 创建 | 无前端生成 |

**字段映射（需求 → 实现）**

| 需求术语 | 代码/DB 字段 |
|----------|--------------|
| nickname（昵称） | `displayName` / `display_name` |
| avatar（头像） | `avatarUrl` / `avatar_url` |
| agent_id | `agents.id`（serial PK） |

### 2.2 缺口清单

| # | 需求 | 缺口 |
|---|------|------|
| R1 | 客服在 agent-app 修改昵称/头像 | 无 Profile 页；无 `PATCH /agent/me` |
| R2 | 修改后全局生效 | 后台已满足；agent-app 自改 + 访客端需拉取/订阅最新资料 |
| R3 | 访客顶栏：头像 + 昵称 + 在线 | 仅显示 `sessionStorage.agentName`；副标题为**访客** WS 状态，非客服在线 |
| R4 | agent_id 后台唯一来源 | 服务端已校验；需补充文档与前端禁止硬编码/自造 ID |
| R5 | 后台创建/启用/禁用/设资料 | **admin-app 已基本完成**，仅需验收与小幅增强 |

---

## 3. 需求规格与验收标准

### 3.1 客服可修改昵称与头像（admin-app + agent-app）

**admin-app**

- 已有：创建时设 `displayName`、`avatarUrl`；编辑弹窗可改；`isActive` 开关
- 验收：创建客服 → 访客 `GET /agents/:id` 可见新资料；禁用后访客链接 404

**agent-app（新增）**

- 新增「个人信息」页（建议路由 `/agent/profile`）
- 可编辑：`displayName`（昵称）、`avatarUrl`（头像，复用现有 upload 组件模式）
- 不可编辑：`username`、`role`、`isActive`（仍由 admin 管理）
- 保存后：调用 `PATCH /agent/me`；Dashboard 标题/专属链接卡片即时刷新

**验收标准**

- [ ] 客服登录后进入 Profile，修改昵称/头像并保存成功
- [ ] 刷新 Dashboard，显示新昵称
- [ ] 访客打开 `/chat/:agentId`，顶栏与入口页显示新资料（无需重新建会话）
- [ ] super_admin 账号在 agent-app Profile 中同样可改自己的 displayName/avatar（role 不可自改）

### 3.2 访客端顶部客服信息栏

**展示内容**

```
[ ← ]  [头像]  客服昵称          [访客昵称 pill]
              ● 在线 / ○ 离线
```

- **头像**：`avatarUrl`，无图时显示首字/默认占位
- **昵称**：`displayName`，fallback「客服」
- **在线状态**：客服 online/offline（非访客 WS 状态）

**在线判定规则（与现有访客在线模型对齐）**

- 新增 `agents.last_seen_at`（timestamptz，nullable）
- 客服 WS `agent_connect` + 周期性 `ping`（建议 12s，与访客一致）更新 `last_seen_at`
- 公开 API / 会话列表：`isOnline = now - last_seen_at < 60s`
- 访客端：进入聊天后轮询 `GET /agents/:id`（30s）+ 可选 WS `agent_presence` 广播

**验收标准**

- [ ] 聊天页顶栏显示客服头像、昵称、在线/离线
- [ ] 客服登录 Dashboard 后，访客端在 60s 内显示「在线」
- [ ] 客服关闭页面/断线超过 60s，访客端显示「离线」
- [ ] 顶栏不再把访客 WS「已連線」误标为客服状态（可移至次要位置或移除）

### 3.3 客服 ID 统一后台配置体系

**规则（服务端为唯一真相源）**

```
admin POST /admin/agents  →  DB agents.id (serial)
visitor POST /sessions    →  body.agentId 必须经过 findAssignableAgent()
visitor URL /chat/:id     →  id 仅用于查找，不可创建 agent
agent-app                 →  agentId 来自 login 响应，禁止 localStorage 手工写入
```

**禁止项**

- 前端生成、递增、或 UUID 伪造 `agent_id`
- 绕过 admin 创建客服账号
- 禁用/不存在 agent 仍创建会话（已有 400/404，需保持）

**验收标准**

- [ ] 仅 super_admin 可 `POST /admin/agents`
- [ ] 访客对不存在/禁用 agentId 创建会话返回 4xx
- [ ] 代码审查：visitor/agent 前端无 `agentId = generate*` 逻辑
- [ ] admin 列表展示 agent id，便于配置专属链接

---

## 4. 技术设计

### 4.1 数据模型

**迁移 `007_p3_agent_presence.sql`**

```sql
ALTER TABLE agents ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS agents_last_seen_at_idx ON agents(last_seen_at);
```

无需新增 nickname 列（沿用 `display_name`）。

### 4.2 API 变更

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/agent/me` | 扩展响应：`displayName`、`avatarUrl`（对齐 OpenAPI `AgentInfo`） |
| `PATCH` | `/agent/me` | **新增**。Body: `{ displayName?, avatarUrl? }`；禁止改 role/isActive |
| `GET` | `/agents/:id` | 扩展：`isOnline: boolean` |
| `GET` | `/agents` | 可选：列表项增加 `isOnline` |

**`UpdateAgentMeBody`（Zod / OpenAPI）**

```yaml
UpdateAgentMeBody:
  type: object
  properties:
    displayName:
      type: string
      minLength: 1
    avatarUrl:
      type: ["string", "null"]
```

**在线计算（共享 helper）**

```ts
// artifacts/api-server/src/lib/agents.ts
export function isAgentOnline(lastSeenAt: Date | null): boolean {
  if (!lastSeenAt) return false;
  return Date.now() - lastSeenAt.getTime() < 60_000;
}
```

### 4.3 WebSocket

| 事件 | 方向 | 说明 |
|------|------|------|
| `agent_connect` | C→S | 已有；连接后写 `agents.last_seen_at` |
| `ping` / `pong` | C↔S | agent 连接时 ping 也更新 `agents.last_seen_at` |
| `agent_presence` | S→C | **可选** `{ type, agentId, isOnline }` 广播给订阅该 agent 的 visitor WS |

实现优先级：DB + REST 轮询先行；WS 广播作为增强。

### 4.4 前端改动清单

#### api-server / OpenAPI

- `lib/api-spec/openapi.yaml` — 上述 schema + routes
- `artifacts/api-server/src/routes/agent.ts` — `PATCH /agent/me`、扩展 GET
- `artifacts/api-server/src/lib/websocket.ts` — agent heartbeat → `last_seen_at`
- `artifacts/api-server/src/lib/agents.ts` — `isAgentOnline`、公开列扩展
- 运行 codegen → `lib/api-zod`、`lib/api-client-react`

#### admin-app（验收 + 小改）

- `apps/admin-app/src/pages/Agents.tsx` — 展示专属链接 `http://127.0.0.1:5173/chat/{id}`；禁用态提示
- 无大改，CRUD 已满足 R5

#### agent-app（主要新增）

- **新建** `apps/agent-app/src/pages/agent/Profile.tsx`
- `apps/agent-app/src/App.tsx` — 路由 `/agent/profile`
- `apps/agent-app/src/pages/agent/Dashboard.tsx` — 导航入口；用 `/agent/me` 的 `displayName` 替代 username 展示
- 复用 admin 头像上传：`POST /storage/uploads/request-url` 或现有 upload API

#### visitor-app

- `apps/visitor-app/src/pages/visitor/VisitorEntry.tsx` — `getPublicAgent` 后写入 `agentName` + `agentAvatarUrl`
- `apps/visitor-app/src/lib/visitor-session.ts` — 读写 agent 展示字段 helper
- **新建** `apps/visitor-app/src/components/AgentHeaderBar.tsx` — 顶栏 UI
- `apps/visitor-app/src/pages/visitor/Chat.tsx` — 替换现有 header；`useGetPublicAgent` 轮询刷新资料与在线态

### 4.5 全局生效策略

| 变更来源 | 生效路径 |
|----------|----------|
| admin 改资料 | 下次 `GET /agents/:id` / 会话列表 join agents 表 |
| agent 自改资料 | 同上 |
| 访客聊天中 | 30s 轮询 public agent + 进入页已缓存 sessionStorage |
| agent Dashboard | mutation 成功后 invalidate `getAgentMe` query |

不在 messages 表冗余 agent 昵称，避免历史消息展示不一致时再加 snapshot（P3 不做）。

---

## 5. 开发任务拆分

建议按依赖顺序实施，每步可独立验收。

### Phase P3-A：后端基础（1–2d）

| ID | 任务 | 产出 |
|----|------|------|
| P3-A1 | 迁移 `007_p3_agent_presence.sql` | `agents.last_seen_at` |
| P3-A2 | `isAgentOnline` + 扩展 `GET /agents/:id` | 含 `isOnline` |
| P3-A3 | `PATCH /agent/me` + 扩展 `GET /agent/me` | 自服务资料更新 |
| P3-A4 | WS agent ping → 更新 `agents.last_seen_at` | 客服在线数据源 |
| P3-A5 | OpenAPI 更新 + codegen | 客户端类型同步 |

### Phase P3-B：agent-app 个人信息（1d）

| ID | 任务 | 产出 |
|----|------|------|
| P3-B1 | Profile 页 UI + 表单校验 | 昵称/头像编辑 |
| P3-B2 | 对接 `patchAgentMe` + 头像上传 | 保存流程 |
| P3-B3 | Dashboard 入口 + 展示名刷新 | 导航与 query invalidation |

### Phase P3-C：visitor-app 顶栏（1d）

| ID | 任务 | 产出 |
|----|------|------|
| P3-C1 | `AgentHeaderBar` 组件 | 头像/昵称/在线 UI |
| P3-C2 | Entry + Chat 集成 + sessionStorage | 资料缓存 |
| P3-C3 | `useGetPublicAgent` 轮询（refetchInterval 30s） | 资料与在线刷新 |
| P3-C4 | 移除/降级访客 WS 状态在顶栏的误导展示 | UX 修正 |

### Phase P3-D：admin-app 验收与文档（0.5d）

| ID | 任务 | 产出 |
|----|------|------|
| P3-D1 | admin Agents 页验收 R5 全项 | 测试清单签字 |
| P3-D2 | 专属链接展示与复制 | 运营友好 |
| P3-D3 | 更新 `.agents/memory/multi-agent.md` | 架构记忆同步 |

### Phase P3-E：联调与回归（0.5d）

- admin 创建客服 → agent 登录改资料 → visitor 顶栏验证
- 禁用客服 → 访客链接 404、无法建会话
- 与 P3 已读游标、P2 未读、WS 消息推送回归

**预估总工时：4–5 人日**

---

## 6. 测试计划

### 6.1 API

```bash
# 客服自改资料
PATCH /agent/me  Authorization: Bearer <token>
{ "displayName": "小美", "avatarUrl": "https://..." }

# 公开信息含在线
GET /agents/2
→ { id, displayName, avatarUrl, introduction, isOnline }
```

### 6.2 E2E 场景

1. Admin 创建 agent(id=5) → 访客打开 `/chat/5` → 见默认资料
2. Agent 改昵称为「阿明」→ 访客刷新/轮询后顶栏更新
3. Agent 开 Dashboard（WS 连接）→ 访客见 online；关页 60s 后 offline
4. Admin 禁用 agent → `GET /agents/5` 404，`POST /sessions` 400

### 6.3 安全

- `PATCH /agent/me` 不能修改 `role`、`isActive`、`username`
- 访客 token 无法调用 admin/agent 写接口
- `agentId` 在 createSession 必须 DB 存在且 active

---

## 7. 风险与决策

| 项 | 决策 |
|----|------|
| nickname 字段名 | 不新增列，统一用 `displayName`，UI 文案写「昵称」 |
| 客服在线 vs 访客在线 | 分离：`agents.last_seen_at` vs `sessions.last_seen_at` |
| 实时性 | REST 轮询 30s 为 P3 默认；WS presence 为可选增强 |
| super_admin 专属链接 | super_admin 不可 assignable，列表/链接仅针对 role=agent |
| 历史消息发送者名 | P3 仍用当前 agent displayName；不做消息级 snapshot |

---

## 8. 不在 P3 范围

- 客服个人改密码（已有 admin reset-password）
- 客服自助注册
- 多客服轮询分配 / 智能路由
- 消息已读回执（P3 前期已明确移除）
- 客服离线留言推送 / 邮件通知

---

## 9. 里程碑

| 里程碑 | 内容 | 完成标志 |
|--------|------|----------|
| M1 | P3-A 后端 | 迁移 applied；API 测试通过 |
| M2 | P3-B agent Profile | 客服可自改资料 |
| M3 | P3-C 访客顶栏 | 三要素展示 + 在线准确 |
| M4 | P3-D/E 验收 | 本文档 §3 验收项全部勾选 |

---

## 附录：关键文件索引

```
lib/db/src/schema/agents.ts
scripts/migrations/007_p3_agent_presence.sql          [待建]
lib/api-spec/openapi.yaml
artifacts/api-server/src/routes/agent.ts
artifacts/api-server/src/routes/admin.ts
artifacts/api-server/src/lib/agents.ts
artifacts/api-server/src/lib/websocket.ts
apps/admin-app/src/pages/Agents.tsx
apps/agent-app/src/pages/agent/Profile.tsx            [待建]
apps/agent-app/src/pages/agent/Dashboard.tsx
apps/visitor-app/src/components/AgentHeaderBar.tsx  [待建]
apps/visitor-app/src/pages/visitor/Chat.tsx
apps/visitor-app/src/pages/visitor/VisitorEntry.tsx
```
