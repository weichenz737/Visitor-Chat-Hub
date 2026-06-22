# Visitor Chat Hub — 部署文档

## 数据库：自动生成还是需要导入？

**结论：不需要导入 SQL 备份或手工执行 `init-db.sql`。**

本系统的数据库采用 **「先准备空库 + 启动时自动初始化」** 的方式：

| 步骤 | 执行时机 | 作用 |
|------|----------|------|
| 1. 创建 PostgreSQL 实例与空库 `chatdb` | **部署前，人工一次** | 提供数据库连接 |
| 2. `drizzle-kit push` | API 容器启动时自动 | 按 Drizzle Schema 同步表结构 |
| 3. `scripts/apply-migrations.mjs` | API 容器启动时自动 | 按序执行 `scripts/migrations/001`–`011` 增量迁移 |
| 4. `scripts/seed-admin.mjs` | API 容器启动时自动 | 创建/更新默认超级管理员账号 |

迁移记录保存在 `schema_migrations` 表中，已执行过的 SQL 文件不会重复运行。

> **说明：** `scripts/init-db.sql` 为早期手工建表参考，**当前部署流程不依赖它**。请以 Drizzle + `scripts/migrations/` 为准。

---

## 一、环境要求

| 组件 | 版本建议 |
|------|----------|
| Docker Desktop | 最新稳定版（Windows 需启用 WSL2 后端） |
| Node.js | 24.x（Docker 镜像已内置，本地开发可选） |
| pnpm | 9.x / 11.x（Docker 启动脚本会自动安装依赖） |
| PostgreSQL | 15 或 16 |

---

## 二、快速部署（Docker Compose，推荐）

### 1. 克隆代码

```bash
git clone https://github.com/weichenz737/Visitor-Chat-Hub.git
cd Visitor-Chat-Hub
```

### 2. 启动 PostgreSQL（独立容器）

`docker-compose.yml` **不包含** PostgreSQL，需先在本机启动数据库：

```powershell
docker run -d `
  --name chat-postgres `
  -e POSTGRES_PASSWORD=123456 `
  -e POSTGRES_DB=chatdb `
  -p 5433:5432 `
  postgres:16
```

验证：

```powershell
docker exec chat-postgres psql -U postgres -d chatdb -c "SELECT 1"
```

### 3. 启动应用服务

```powershell
docker compose up -d
```

首次启动 `api` 容器会依次执行：

1. 安装 pnpm 依赖  
2. `drizzle-kit push` — 同步表结构  
3. `apply-migrations.mjs` — 应用 SQL 迁移  
4. `seed-admin.mjs` — 写入默认超管  
5. 编译并启动 API  

`visitor-web`、`agent-web`、`admin-web` 启动 Vite 开发服务器。

### 4. 访问地址

| 服务 | URL | 说明 |
|------|-----|------|
| 访客端 | http://127.0.0.1:5173 | 访客首页 |
| 访客聊天 | http://127.0.0.1:5173/chat/{客服ID} | 专属链接 |
| 客服工作台 | http://127.0.0.1:5174/agent | 客服登录 |
| 管理后台 | http://127.0.0.1:5175/login | 超管登录 |
| API | http://127.0.0.1:8080 | REST + WebSocket |

> **Windows 注意：** 请使用 `127.0.0.1`，避免 `localhost:5173` 与 WSL 端口冲突导致无法访问。

### 5. 默认账号

| 用途 | 账号 | 密码 | 说明 |
|------|------|------|------|
| 管理后台 | `admin123` | `123456` | 超级管理员（seed 自动创建） |
| 客服工作台 | 需在管理后台创建 | — | 或使用已有客服账号 |

可通过环境变量覆盖 seed 账号（见下文）。

---

## 三、环境变量

### API 服务（`docker-compose.yml` → `api`）

| 变量 | 默认值（开发） | 说明 |
|------|----------------|------|
| `DATABASE_URL` | `postgresql://postgres:123456@host.docker.internal:5433/chatdb` | PostgreSQL 连接串 |
| `PORT` | `8080` | API 监听端口 |
| `JWT_SECRET` | `local_dev_secret_change_in_production` | **生产环境必须修改** |
| `NODE_ENV` | `development` | 生产部署改为 `production` |
| `STORAGE_PROVIDER` | `local` | 文件存储，目前仅支持 `local` |
| `SEED_USERNAME` | `admin123` | 首次 seed 的超管用户名 |
| `SEED_PASSWORD` | `123456` | 首次 seed 的超管密码 |
| `SEED_DISPLAY_NAME` | `管理員` | 超管显示名称 |

### 前端服务

| 变量 | 说明 |
|------|------|
| `API_PROXY_TARGET` | Vite 代理目标，Compose 内为 `http://api:8080` |
| `VITE_ADMIN_APP_URL` | 客服端跳转管理后台的 URL |
| `VITE_VISITOR_APP_URL` | 客服端访客链接基址 |

本地非 Docker 开发时，可在项目根目录创建 `.env`：

```env
DATABASE_URL=postgresql://postgres:123456@127.0.0.1:5433/chatdb
JWT_SECRET=your-secret-here
```

---

## 四、服务架构（Compose）

```
chat-postgres (:5433)          ← 需单独启动
        ↑
        │ DATABASE_URL
        │
   api (:8080)                ← drizzle push + migrations + seed + API
        ↑
   ┌────┴────┬────────────┐
   │         │            │
visitor-web agent-web  admin-web
  :5173      :5174       :5175
```

常用命令：

```powershell
# 查看状态
docker compose ps

# 查看 API 日志（含迁移输出）
docker logs visitor-chat-hubzip-api-1 -f

# 重启单个服务
docker compose restart agent-web

# 停止全部
docker compose down
```

---

## 五、本地开发（不用 Docker 跑前端）

前提：PostgreSQL 已在 `:5433` 运行，且已执行过一次迁移（可通过启动一次 API 容器完成）。

```powershell
# 安装依赖
pnpm install

# 同步数据库 + 迁移 + seed
$env:DATABASE_URL="postgresql://postgres:123456@127.0.0.1:5433/chatdb"
pnpm --filter @workspace/db exec drizzle-kit push --config ./drizzle.config.ts
node scripts/apply-migrations.mjs
node scripts/seed-admin.mjs

# 分别启动（多个终端）
pnpm --filter @workspace/api-server run dev      # :8080
pnpm --filter @workspace/visitor-app run dev     # :5173
pnpm --filter @workspace/agent-app run dev       # :5174
pnpm --filter @workspace/admin-app run dev       # :5175
```

---

## 六、数据库迁移管理

### 自动迁移（常规）

正常启动 API 即可，`apply-migrations.mjs` 会扫描 `scripts/migrations/*.sql` 并按文件名排序执行未应用的脚本。

### 手动补跑单条迁移

仅在自动迁移失败或调试时使用：

```powershell
Get-Content scripts/migrations/011_p6_system_logs.sql | docker exec -i chat-postgres psql -U postgres -d chatdb
docker exec chat-postgres psql -U postgres -d chatdb -c "INSERT INTO schema_migrations (filename) VALUES ('011_p6_system_logs.sql') ON CONFLICT DO NOTHING;"
```

### 查看已应用迁移

```powershell
docker exec chat-postgres psql -U postgres -d chatdb -c "SELECT * FROM schema_migrations ORDER BY applied_at"
```

### 迁移文件列表

| 文件 | 阶段 | 内容 |
|------|------|------|
| `001_p0_permissions_admin.sql` | P0 | 应用设置、转接策略 |
| `002_p1_quick_replies.sql` | P1 | 快捷回复表 |
| `003_p1_drop_quick_reply_category.sql` | P1 | 移除分类字段 |
| `004_p2_conversation_unread.sql` | P2 | 未读计数 |
| `005_p3_session_read_watermarks.sql` | P3 | 已读水位线 |
| `006_p3_resync_read_cursors.sql` | P3 | 读指针修复 |
| `007_p3_agent_presence.sql` | P3 | 客服在线状态 |
| `008_p3_session_notes.sql` | P3 | 会话备注 |
| `009_p4_session_transfers.sql` | P4 | 会话转接 |
| `010_p5_message_files.sql` | P5 | 文件消息字段 |
| `011_p6_system_logs.sql` | P6 | 系统审计日志 |

---

## 七、文件存储

- 开发环境：`STORAGE_PROVIDER=local`，文件保存在 `artifacts/api-server/uploads/`（Docker 卷 `uploads` 持久化）
- 图片访问路径：`/uploads/...`
- 上传限制：单文件最大 20MB，禁止危险扩展名

生产环境如需对象存储（S3/MinIO），需扩展 `artifacts/api-server/src/lib/storage/` 并设置对应环境变量（当前代码仅实现 `local`）。

---

## 八、生产部署建议

当前 `docker-compose.yml` 面向 **开发环境**（Vite dev server + 热更新）。生产环境建议：

1. **修改密钥：** `JWT_SECRET`、数据库密码、seed 密码  
2. **构建静态前端：** 对各 app 执行 `pnpm run build`，用 Nginx/Caddy 托管 `dist`  
3. **API 以 production 模式运行：** `NODE_ENV=production`，前置反向代理（HTTPS）  
4. **PostgreSQL：** 使用托管数据库或独立高可用集群，定期备份  
5. **上传目录：** 挂载持久卷或使用对象存储  
6. **WebSocket：** 反向代理需开启 `Upgrade` 头转发（`/ws` 路径）

---

## 九、常见问题

### API / 客服端容器启动失败（exit 127）

`scripts/docker-ensure-deps.sh` 在 Windows 上若为 CRLF 换行会导致 Linux 容器无法执行。修复：

```powershell
# 将脚本转为 LF 换行后重启
docker compose up -d api agent-web
```

### 前端页面不更新

Docker 卷挂载 + Windows 下 Vite 可能缓存旧代码：

```powershell
docker exec visitor-chat-hubzip-admin-web-1 rm -rf /app/apps/admin-app/node_modules/.vite
docker restart visitor-chat-hubzip-admin-web-1
```

### 访客端/客服端 API 请求失败

API 容器重建后，需重启前端容器以刷新代理：

```powershell
docker compose restart visitor-web agent-web
```

### 管理后台能进，客服端进不去

确认 `api` 与 `agent-web` 容器均为 `Up` 状态：

```powershell
docker compose ps
docker compose up -d api agent-web
```

### 数据库连接失败

1. 确认 `chat-postgres` 容器运行中  
2. 确认端口 `5433` 未被占用  
3. Docker 内 API 使用 `host.docker.internal:5433`，本机直连使用 `127.0.0.1:5433`

---

## 十、相关文档

- [系统架构与功能描述](./ARCHITECTURE.md)
- [P3 客服体系规划](./P3-agent-system-plan.md)
- OpenAPI 规范：`lib/api-spec/openapi.yaml`
