# TaskFlow — SaaS 团队任务管理工具 实施计划

## Context

用户是 2-4 年经验的 Node.js 全栈工程师，目标进入创业公司/中小厂。需要一个功能完整的 SaaS 作品集项目来展示独立交付能力（从数据库到 UI）。用户希望边做边学，每个阶段产出一份学习文档。

## Tech Stack

| 层 | 选型 | 理由 |
|---|---|---|
| 构建 | Vite 6 + React 19 | HMR 快，SPA 架构清晰，与独立后端边界明确 |
| 样式 | Tailwind CSS 4 + shadcn/ui | 复制即拥有，无厂商锁定 |
| 状态 | TanStack Query 5 + Zustand 5 | 服务端状态与客户端状态分离，避免 Redux 反模式 |
| 拖拽 | @dnd-kit/core + sortable | 无障碍友好，专为看板设计 |
| 表单 | React Hook Form + Zod | 高性能，与后端共享校验 |
| 后端 | Express 5 + Prisma 6 | 面试最熟悉，Prisma Studio 可视化管理数据 |
| 实时 | Socket.IO 4 | 自动重连、房间管理、认证中间件 |
| 数据库 | PostgreSQL 16 (Docker) | 行业标准，支持全文搜索 tsvector |
| 部署 | Docker Compose + Nginx | 一键启动完整生产栈 |
| 工程 | npm workspaces | 零安装成本，3 个包的 monorepo 足够 |
| 测试 | Vitest + Playwright | 前后端统一测试框架 |

## Monorepo 结构

```
taskflow/
├── package.json              # workspaces: ["packages/*"]
├── tsconfig.base.json
├── docker-compose.yml        # PostgreSQL dev
├── docker-compose.prod.yml   # 完整生产栈
├── nginx/nginx.conf
├── packages/
│   ├── shared/               # @taskflow/shared — 类型、Zod Schema、常量
│   ├── backend/               # @taskflow/backend — Express + Prisma + Socket.IO
│   └── frontend/              # @taskflow/frontend — Vite + React + shadcn/ui
```

## Database Schema (10 张表)

**核心实体关系**：User → WorkspaceMember → Workspace → Project → Task → (TaskAssignee, Comment, Attachment)

关键表：`User`, `RefreshToken`, `Workspace`, `WorkspaceMember`, `Invitation`, `Project`, `Task`, `TaskAssignee`, `Comment`, `Attachment`, `Notification`

- 所有主键使用 `cuid()`，URL 安全且无需协调服务即可生成
- Task 表有 `position` 列用于看板排序，`status` 枚举（BACKLOG|TODO|IN_PROGRESS|IN_REVIEW|DONE）
- 全文搜索通过 PostgreSQL `tsvector` 生成列 + GIN 索引实现
- 级联删除：删除 Workspace → Projects → Tasks → Comments/Attachments/Assignees

## API 设计 (约 40 个端点)

统一响应格式：`{ data: T }` 成功 / `{ error: { code, message } }` 失败

| 模块 | 端点前缀 | 示例 |
|------|---------|------|
| Auth | `/api/auth` | register, login, refresh, OAuth |
| Users | `/api/users` | me, avatar upload |
| Workspaces | `/api/workspaces` | CRUD, members, invitations |
| Projects | `/api/workspaces/:wid/projects` | CRUD + task counts |
| Tasks | `/api/projects/:pid/tasks` | CRUD + status/position update (看板拖拽) |
| Comments | `/api/tasks/:tid/comments` | CRUD |
| Attachments | `/api/tasks/:tid/attachments` | upload, download |
| Search | `/api/search` | PostgreSQL 全文搜索 |
| Notifications | `/api/notifications` | 列表, 标记已读 |

中间件链：helmet → cors → json → logger → rateLimit → authenticate → authorize → validate → route handler → error handler

## 前端路由与组件树

```
AppShell (认证后)
├── Sidebar (WorkspaceSwitcher, ProjectList, CreateProject)
├── TopBar (SearchCommand Cmd+K, NotificationBell, UserMenu)
└── <Outlet>
    ├── DashboardPage        / — 工作区列表
    ├── WorkspacePage        /workspaces/:wid
    ├── MembersPage          /workspaces/:wid/settings/members
    ├── WorkspaceSettingsPage
    ├── ProjectPage          看板视图 (KanbanBoard, KanbanColumn, KanbanCard)
    ├── ProjectListPage      列表视图
    ├── ProfilePage          /profile
    └── NotificationsPage    /notifications
```

关键交互：点击 KanbanCard → TaskDetailSheet（右侧抽屉）展示任务详情、指派、附件、评论

## 实时架构 (Socket.IO)

- 前端连接时带 JWT 认证，服务端中间件校验后加入对应 room
- Room 命名：`workspace:<id>`, `project:<id>`, `task:<id>`, `user:<userId>`
- 事件：`task:created/moved/updated/deleted`, `comment:created`, `notification:new`, `presence:users`
- 乐观更新：拖拽时先更新 React Query 缓存，PATCH 失败时回滚

## 部署方案

- **开发环境**：`docker compose up` 启动 PostgreSQL，前后端用 tsx/Vite 热重载
- **生产环境**：`docker compose -f docker-compose.prod.yml up` 启动完整栈（PostgreSQL + Redis + Backend + Frontend + Nginx）
- **Nginx**：`/` → 前端 SPA，`/api/` → 后端，`/socket.io/` → WebSocket 升级
- **CI**：GitHub Actions (lint → typecheck → test → build)

---

## 实施阶段 (9 个 Phase，每个 Phase 产出学习文档)

### Phase 0: 项目脚手架 ✅ (完成日期: 2026-06-11)

- [x] 初始化 npm workspaces monorepo
- [x] docker-compose.yml (PostgreSQL)
- [x] Express + Prisma 连接数据库 (10 张表迁移完成)
- [x] Vite + React + Tailwind 渲染首页
- **产出**：两个服务可启动，数据库连接成功 → [学习文档](docs/phase-0-scaffolding.md)

### Phase 1: 认证系统 ✅ (完成日期: 2026-06-14)

- [x] User + RefreshToken 模型
- [x] 注册/登录/Token 刷新/登出 API (5 端点已测试通过)
- [x] JWT access (15min) + httpOnly refresh cookie (7d) + Token Rotation
- [x] Google/GitHub OAuth 登录 (授权码流程，后端交换 code)
- [x] 前端：LoginPage, RegisterPage, OAuthCallback, authStore, ProtectedRoute, axios 拦截器(401 自动刷新 + 并发排队)
- **产出**：完整认证流 + OAuth，可登录看到 Dashboard
- 📖 [学习文档](docs/phase-1-authentication.md)

### Phase 2: 工作区 + 权限 ✅ (完成日期: 2026-06-14)

- [x] Workspace + WorkspaceMember + Invitation 模型
- [x] CRUD + 成员管理 + 邀请 API (11 端点全部测试通过)
- [x] RBAC 中间件 (Owner/Admin/Member + 数字层级)
- [x] 邀请流程 (CUID token + email 绑定 + 7天过期)
- [x] 前端：DashboardPage + AppShell 布局 + WorkspacePage + MembersPage + WorkspaceForm + InviteDialog + Settings + Profile
- **产出**：多租户工作区，完整 RBAC 权限
- 📖 [学习文档](docs/phase-2-workspaces.md)

### Phase 3: 看板 + 任务管理 ✅ (完成日期: 2026-06-14)

- [x] Project + Task + TaskAssignee CRUD API (13 端点)
- [x] Position reordering 算法 (同列移位 + 跨列移动)
- [x] Kanban 5 列拖拽 (BACKLOG|TODO|IN_PROGRESS|IN_REVIEW|DONE)
- [x] @dnd-kit 集成: DndContext + Sortable + Droppable + DragOverlay
- [x] 乐观更新 (拖拽即时响应 + 失败回滚)
- [x] TaskDetailSheet 右侧抽屉 (inline 编辑)
- [x] Project 侧边栏 + 列表视图
- **产出**：完整看板，拖拽排序、状态流转、任务指派
- 📖 [学习文档](docs/phase-3-kanban.md)

### Phase 4: 实时协作 ✅ (完成日期: 2026-06-29)

- [x] Socket.IO server + JWT 认证中间件
- [x] Room 管理 (workspace + project) + presence 广播
- [x] Controller 层事件发射 (task:created/moved/updated/deleted)
- [x] 前端 useSocket hook + singleton socket client
- [x] Socket 事件驱动 React Query 缓存 invalidate
- [x] 端到端测试：创建任务 → 事件到达 → 移动任务 → 事件到达
- **产出**：多人实时同步，看板变化即时可见
- 📖 [学习文档](docs/phase-4-realtime.md)

### Phase 5: 评论 + 通知 ✅ (完成日期: 2026-06-29)

- [x] Comment CRUD API (4 端点) + 仅作者编辑
- [x] Notification 自动生成 (评论通知 + 多人批量创建)
- [x] Notification API (列表/未读计数/标记已读/全部已读)
- [x] authorize 中间件扩展 (taskId + commentId 反查 workspace)
- [x] 前端: CommentSection + CommentItem (内联编辑) + NotificationBell + NotificationsPage
- [x] Socket.IO 评论实时推送 + 通知轮询 (15s) 混合模式
- **产出**：评论讨论线 + 通知中心 + 未读计数
- 📖 [学习文档](docs/phase-5-comments-notifications.md)

### Phase 6: 文件上传 ✅ (完成日期: 2026-06-29)

- [x] multer 配置 (memoryStorage + fileFilter + 10MB limit)
- [x] StorageProvider 抽象层 (storeFile/readFile/deleteFile)
- [x] 附件上传/下载/删除 API (4 端点)
- [x] 头像上传 API (替换旧文件)
- [x] 前端: FileUpload 拖拽上传组件 + ProfilePage 头像上传
- [x] Vite /uploads 代理配置
- **产出**：附件管理 + 头像上传，StorageProvider 可扩展
- 📖 [学习文档](docs/phase-6-file-uploads.md)

### Phase 7: 全文搜索 ✅ (完成日期: 2026-06-29)

- [x] PostgreSQL tsvector GENERATED ALWAYS 列 + GIN 索引 (raw SQL 迁移)
- [x] 搜索 API (to_tsquery + ts_rank + ts_headline + 状态/优先级过滤)
- [x] 权重设置 (title:A, description:B)
- [x] 前端: SearchCommand (Cmd+K 面板, 键盘导航, HTML 高亮, 防抖)
- **产出**：全局全文搜索，关键词高亮，相关性排序
- 📖 [学习文档](docs/phase-7-search.md)

### Phase 8: 测试 + 打磨 ✅ (完成日期: 2026-06-29)

- [x] 后端: 22 tests (单元: bcrypt/JWT/注册登录 12 + 任务错误处理 4, 集成: API 全流程 6)
- [x] 前端: 6 tests (cn() 合并 3 + AuthStore 状态 3)
- [x] UX 打磨: Skeleton 骨架屏 + EmptyState 空状态 + ErrorBoundary 错误边界
- [x] 28 tests 全部通过，TypeScript 编译零错误
- **产出**：28 测试通过，骨架屏/空状态/错误边界/t
- 📖 [学习文档](docs/phase-8-testing-ux.md)

### Phase 9: 部署 + 文档 (预计 3-4 天)

- [ ] Dockerfile (后端多阶段构建 + 前端 Nginx)
- [ ] docker-compose.prod.yml + nginx.conf
- [ ] Swagger/Postman API 文档
- [ ] README.md (架构图 + 快速开始 + 环境变量 + 部署指南)
- [ ] GitHub Actions CI (lint → typecheck → test → build)
- **产出**：一键部署，完整文档
- 📖 **学习文档**：Docker 多阶段构建、Nginx 反向代理、CI/CD 流水线设计、API 文档规范

---

## 依赖关系

```
Phase 0 (Scaffolding)
    │
Phase 1 (Auth)
    │
Phase 2 (Workspaces + RBAC)
    │
Phase 3 (Tasks + Kanban) ───────────────────┐
    │                                         │
Phase 4 (Real-time) ◄── depends on Phase 3    │
    │                                         │
Phase 5 (Comments + Notifications) ◄── depends on Phase 3,4
    │
Phase 6 (File Uploads) ◄── depends on Phase 3
    │
Phase 7 (Search) ◄── depends on Phase 3
    │
Phase 8 (Polish + Testing) ◄── depends on Phase 5,6,7
    │
Phase 9 (Deployment) ◄── depends on Phase 8
```

Phases 5, 6, 7 可并行开发（涉及不同代码区域）。

---

## 验证方式

每个 Phase 结束时：
1. `npm run dev` 启动开发环境，功能可正常交互
2. Phase 8+：`npm test` 所有测试通过
3. Phase 9：`docker compose -f docker-compose.prod.yml up` 完整栈启动

---

## 学习文档格式约定

每个 Phase 完成后输出一份 Markdown 文档，结构：
1. **本阶段目标** — 要做什么，为什么
2. **核心概念** — 涉及的技术原理（配合代码片段解释）
3. **关键代码走读** — 挑 3-5 个最重要的文件逐段讲解
4. **踩坑记录** — 遇到的坑和解决方案
5. **延伸阅读** — 推荐进一步学习的资源
