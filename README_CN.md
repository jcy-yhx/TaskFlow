# TaskFlow — 团队任务管理，化繁为简

一个全栈 SaaS 团队任务管理工具，作为个人作品集项目构建。涵盖 JWT 认证 + OAuth2、多租户工作区、RBAC 权限、实时看板、评论、通知、文件上传和全文搜索。

**技术栈：** Node.js 24 · Express 5 · Prisma 6 · PostgreSQL 16 · Socket.IO 4 · React 19 · Vite 6 · Tailwind 4 · Docker

**在线演示：** [taskflowfrontend-production-764b.up.railway.app](https://taskflowfrontend-production-764b.up.railway.app)

**Language:** [English README](README.md)

---

## 系统架构

```
┌─────────────┐     ┌──────────────────────────┐
│   浏览器     │────▶│  Nginx (:80)             │
│  React SPA  │     │  /          → 前端静态   │
└─────────────┘     │  /api/*     → 后端 API   │
                    │  /socket.io → WebSocket  │
                    │  /uploads   → 文件服务   │
                    └──────────────────────────┘
                               │
                    ┌──────────┴──────────┐
                    │  Express (:3000)    │
                    │  ┌──────────────┐   │
                    │  │ Socket.IO    │   │
                    │  │ (认证+房间)  │   │
                    │  └──────────────┘   │
                    │  ┌──────────────┐   │
                    │  │ Prisma ORM   │   │
                    │  └──────┬───────┘   │
                    └─────────┼───────────┘
                              │
                    ┌─────────┴───────────┐
                    │  PostgreSQL :5432   │
                    │  Redis :6379        │
                    └─────────────────────┘
```

## 快速开始（开发环境）

```bash
# 1. 启动数据库
docker compose up -d

# 2. 安装依赖
npm install

# 3. 运行数据库迁移
cp .env.example .env
npm run db:migrate

# 4. 启动开发服务器
npm run dev
# 后端:  http://localhost:3000
# 前端: http://localhost:5173
```

## 快速开始（生产环境 — Docker）

```bash
# 1. 配置环境变量
cp .env.production.example .env
# 编辑 .env — 填入 JWT 密钥、OAuth 凭证和 Resend API Key

# 2. 启动完整栈
JWT_ACCESS_SECRET=你的64位随机密钥 \
JWT_REFRESH_SECRET=另一个64位随机密钥 \
POSTGRES_PASSWORD=强密码 \
  docker compose -f docker-compose.prod.yml up -d

# 3. 访问 http://localhost
```

## 功能特性

| 分类 | 详情 |
|------|------|
| **认证系统** | 邮箱注册/登录，JWT 双 Token（access 15分钟 + refresh 7天 httpOnly Cookie），Token 轮转防窃取，Google 和 GitHub OAuth2 登录 |
| **工作区** | 多租户工作区，OWNER / ADMIN / MEMBER 三级角色，slug 友好 URL |
| **邀请机制** | Resend 邮件邀请 + 工作区邀请码，两种模式：邮箱邀请或分享邀请码 |
| **项目管理** | 侧边栏项目列表，颜色标签，项目增删改查 |
| **看板** | 五列拖拽（待办 → 处理中 → 审查中 → 已完成），乐观更新即时响应，位置重排算法 |
| **实时协作** | Socket.IO 房间管理（工作区 + 项目），任务和评论实时同步，在线状态 |
| **任务管理** | 创建/编辑/删除任务，指派成员，优先级（低 → 紧急），截止日期，搜索和过滤 |
| **评论** | 任务内评论讨论，内联编辑，仅作者可编辑/删除 |
| **通知** | 评论和指派自动生成通知，未读计数角标，一键全部已读，轮询 + Socket.IO 混合推送 |
| **文件上传** | 拖拽上传，任务附件（图片/PDF/文档），头像上传，存储抽象层 |
| **全文搜索** | PostgreSQL tsvector + GIN 索引，加权排序（标题:A 级，描述:B 级），`<mark>` 关键词高亮，Cmd+K 命令面板 |
| **UI/UX** | 清爽浅色主题，骨架屏加载态，空状态提示，错误边界，密码可见性切换，Toast 通知 |

## 项目结构

```
taskflow/
├── packages/
│   ├── shared/          # @taskflow/shared — 类型定义、Zod 校验、常量
│   ├── backend/         # @taskflow/backend — Express + Prisma + Socket.IO
│   └── frontend/        # @taskflow/frontend — Vite + React + Tailwind
├── nginx/nginx.conf     # Nginx 反向代理配置（生产环境）
├── docker-compose.yml       # PostgreSQL + Redis（开发环境）
├── docker-compose.prod.yml  # 完整生产栈（4 个服务）
├── Dockerfile.backend       # 多阶段构建 Node.js 镜像（约 250MB）
├── Dockerfile.frontend      # 多阶段构建 React → NGINX 镜像
├── .github/workflows/ci.yml # CI 流水线：lint → typecheck → migrate → test
└── docs/                    # 分阶段学习文档（10 篇）
```

## API 接口概览

| 模块 | 前缀 | 主要端点 |
|------|------|---------|
| 认证 | `/api/auth` | 注册、登录、刷新、登出、OAuth（Google / GitHub）|
| 用户 | `/api/users` | /me、/me/avatar |
| 工作区 | `/api/workspaces` | CRUD、/join（邀请码加入）、/:id/reset-join-code、成员管理、邀请管理 |
| 项目 | `/api/workspaces/:wid/projects` | CRUD + 任务数量统计 |
| 任务 | `/api/projects/:pid/tasks` | CRUD + /by-status + 状态/位置更新 + 指派 |
| 评论 | `/api/tasks/:tid/comments` | CRUD |
| 附件 | `/api/tasks/:tid/attachments` | 上传、下载、删除 |
| 搜索 | `/api/search` | 全文搜索带高亮和排序 |
| 通知 | `/api/notifications` | 列表、未读计数、标记已读、全部已读 |

统一响应格式：`{ data, meta? }` 成功 / `{ error: { code, message } }` 错误。

## 环境变量

| 变量 | 必填 | 说明 |
|------|------|------|
| `DATABASE_URL` | 是 | PostgreSQL 连接字符串 |
| `JWT_ACCESS_SECRET` | 是 | JWT 签名密钥（64 位随机字符串）|
| `JWT_REFRESH_SECRET` | 是 | Refresh Token 签名密钥 |
| `FRONTEND_URL` | 是 | CORS 来源（如 http://localhost:5173）|
| `RESEND_API_KEY` | 否 | Resend API Key，用于发送邀请邮件 |
| `GOOGLE_CLIENT_ID` | 否 | Google OAuth2 应用 ID |
| `GOOGLE_CLIENT_SECRET` | 否 | Google OAuth2 密钥 |
| `GITHUB_CLIENT_ID` | 否 | GitHub OAuth 应用 ID |
| `GITHUB_CLIENT_SECRET` | 否 | GitHub OAuth 密钥 |
| `UPLOAD_DIR` | 否 | 文件存储目录（默认：./uploads）|
| `REDIS_URL` | 否 | Redis 连接（默认：localhost:6379）|

## 测试

```bash
# 全部测试（28 个测试用例）
npm test

# 后端单元 + 集成测试（22 个用例）
npm -w packages/backend test

# 前端单元测试（6 个用例）
npm -w packages/frontend test
```

后端 22 个测试覆盖：JWT 签名/校验、bcrypt 哈希/比对、注册（正常 + 重复）、登录（正常 + 错误密码 + 不存在用户）、任务 CRUD 错误处理、完整 API 集成流程、认证守卫拦截。

前端 6 个测试覆盖：className 合并工具函数（`cn`）、Zustand 认证状态流转（初始态 → 登录 → 登出）。

## 分阶段学习指南

每个阶段都有独立的说明文档，详见 [docs/](./docs/)：

| 阶段 | 主题 | 文档 |
|------|------|------|
| 0 | 项目脚手架：monorepo、Docker、Prisma、Vite | [phase-0](./docs/phase-0-scaffolding.md) |
| 1 | 认证系统：JWT 双 Token、OAuth2、Token 轮转 | [phase-1](./docs/phase-1-authentication.md) |
| 2 | 工作区 + 权限：多租户、RBAC、邀请系统 | [phase-2](./docs/phase-2-workspaces.md) |
| 3 | 看板 + 任务：拖拽排序、乐观更新 | [phase-3](./docs/phase-3-kanban.md) |
| 4 | 实时协作：Socket.IO 房间、事件驱动缓存 | [phase-4](./docs/phase-4-realtime.md) |
| 5 | 评论 + 通知 | [phase-5](./docs/phase-5-comments-notifications.md) |
| 6 | 文件上传：multer、存储抽象 | [phase-6](./docs/phase-6-file-uploads.md) |
| 7 | 全文搜索：PostgreSQL tsvector、Cmd+K 面板 | [phase-7](./docs/phase-7-search.md) |
| 8 | 测试 + UX 打磨：28 个测试、骨架屏、错误边界 | [phase-8](./docs/phase-8-testing-ux.md) |
| 9 | 部署 + 文档：Docker 多阶段构建、Nginx、CI/CD | [phase-9](./docs/phase-9-deployment.md) |

## 部署到 VPS

```bash
# 在服务器上：
git clone <仓库地址> taskflow && cd taskflow
cp .env.production.example .env
# 编辑 .env 填入真实的密钥

# 构建并启动
docker compose -f docker-compose.prod.yml up -d --build

# 数据库迁移会自动通过 docker-entrypoint.sh 运行
```

## 许可证

MIT — 可作为你自己的作品集模板使用。


