# Phase 4 学习文档：实时协作

## 本阶段目标

为看板增加实时协作能力：当用户 A 创建/移动/编辑任务时，用户 B 在同一看板页面无需刷新即可看到变化。这是 SaaS 协作工具从"单机工具"升级为"团队工具"的关键一步。

## 核心概念

### 1. WebSocket vs HTTP 长轮询 vs SSE

| | WebSocket | SSE (Server-Sent Events) | HTTP 长轮询 |
|---|---|---|---|
| 方向 | 全双工 | 单向（服务端→客户端）| 半双工 |
| 协议 | ws://（独立协议）| HTTP | HTTP |
| 连接数 | 1 个持久连接 | 1 个持久连接 | 每次请求新建 |
| 适用场景 | 实时协作、IM | 通知流、日志推送 | 兼容性回退 |
| 浏览器支持 | 所有现代浏览器 | 所有现代浏览器 | 所有浏览器 |

**为什么选 WebSocket？**
- 看板需要双向通信（客户端发送 `join:project`，服务端下发 `task:moved`）
- Socket.IO 自动降级到长轮询（兼容性保底）
- Socket.IO 内置心跳、自动重连、房间管理

### 2. Socket.IO 房间模型

Room 是 Socket.IO 的核心抽象——把连接按逻辑分组，向一个 room 广播一条消息就行：

```
连接 A (Alice) ─┐
                ├─ room "project:abc" ── io.to("project:abc").emit(...)
连接 B (Bob) ───┘
```

**本项目中的 room 命名**：
```
workspace:<id>  — 工作区级别广播（成员变动通知）
project:<id>    — 项目级别广播（任务变动通知）
```

**为什么不用 `user:<userId>` room？** 本阶段不需要——Phase 5 的通知系统会有用到。

**关键 API**：

```typescript
// 加入房间
socket.join(`project:${projectId}`);

// 向房间内所有连接广播（不包括发送者）
io.to(`project:${projectId}`).emit('task:created', { task });

// 获取房间内在线用户
const sockets = io.sockets.adapter.rooms.get(`workspace:${workspaceId}`);
const online = sockets ? Array.from(sockets).map(sid => {
  const s = io.sockets.sockets.get(sid);
  return { userId: s.data.userId };
}) : [];
```

### 3. Socket.IO 认证中间件

WebSocket 不像 HTTP 有 header + middleware 的标准模式。Socket.IO 通过 `auth` 选项处理认证：

**服务端**：
```typescript
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error('Authentication required'));
  try {
    const payload = verifyAccessToken(token);
    socket.data.userId = payload.sub;  // 挂载到 socket.data
    next();
  } catch {
    next(new Error('Invalid token'));
  }
});
```

**客户端**：
```typescript
const socket = io('/', {
  auth: (cb) => cb({ token: getAccessToken() }),
});
```

关键设计：`auth` 可以是一个回调函数而不是静态值 → 每次重连时动态读取最新的 access token（因为 token 会因 refresh rotation 而更新）。

### 4. 控制器层的副作用发射

事件发射放在 controller 而不是 service 层的原因：

```
controller (HTTP 层) → 负责两件事：
  1. 调用 service 执行业务逻辑
  2. 发射事件通知其他客户端

service (业务逻辑层) → 只负责一件事：
  1. 数据库操作
```

**分离的好处**：
- Service 层是纯业务逻辑，不依赖 Socket.IO
- Controller 层知道 HTTP 上下文和 Socket.IO server 的存在
- 未来如果要换成 MQ 或 Serverless Event，只改 controller 即可

```typescript
// task.controller.ts
export async function updateStatus(req, res, next) {
  const task = await taskService.updateTaskStatus(id, body);
  res.json({ data: task });

  // 副作用：通知同一 project room 的其他用户
  try {
    getIO().to(`project:${task.projectId}`).emit('task:moved', {
      taskId: task.id, projectId: task.projectId,
      status: task.status, position: task.position,
    });
  } catch { /* Socket.IO 未初始化（无伤大雅） */ }
}
```

### 5. 前端 Socket Hook 设计

`useSocket` hook 封装了完整的 Socket 生命周期：

```
on mount:
  → getSocket() (singleton)
  → socket.connect() (如果未连接)
  → socket.emit('join:project', { projectId })
  → 注册事件监听 (task:created/moved/updated/deleted → invalidate React Query)

on unmount:
  → socket.emit('leave:project', { projectId })
  → 移除事件监听

on logout:
  → disconnectSocket() (完全断开)
```

**为什么用 singleton socket？**
- WebSocket 连接很贵（一次握手、持久连接、心跳）
- 多个组件共享一个连接，通过 room 区分收信范围
- 页面切换时 leave/join room，不重建连接

**事件到缓存更新的映射**：
```typescript
socket.on('task:created', () => {
  qc.invalidateQueries({ queryKey: taskKeys.byStatus(projectId) });
});
```

收到事件 → invalidate 看板缓存 → React Query 自动重新 fetch `/tasks/by-status` → 看板自动更新。

### 6. 在线状态（Presence）

在线状态通过 Socket.IO 的房间成员数量推断：

```typescript
function broadcastPresence(io, workspaceId) {
  const room = `workspace:${workspaceId}`;
  const sockets = io.sockets.adapter.rooms.get(room);
  const online = sockets
    ? Array.from(sockets).map(sid => ({
        userId: io.sockets.sockets.get(sid)?.data.userId,
        email: io.sockets.sockets.get(sid)?.data.email,
      }))
    : [];
  io.to(room).emit('presence:users', { workspaceId, online });
}
```

每次用户 join/leave workspace room 或 disconnect 时广播一次。

## 关键代码走读

### 文件 1：`packages/backend/src/websocket/index.ts`

完整 Socket.IO server 工厂函数。关键设计：

- `createSocketServer(httpServer, corsOrigin)` — 接收 Express 的 HTTP server 和 CORS origin
- 认证中间件：校验 JWT → 挂载 userId/email 到 `socket.data`
- `join:workspace` / `join:project` / `leave:workspace` / `leave:project` — 客户端手动声明 room
- `disconnect` 事件：广播更新后的在线状态
- `ONLINE_USERS` Map：socketId → Set<room>，用于 disconnect 时知道该更新哪些 workspace 的 presence

### 文件 2：`packages/backend/src/controllers/task.controller.ts` 的 `emit()` 辅助

```typescript
function emit(projectId: string, event: string, payload: Record<string, unknown>) {
  try {
    getIO().to(`project:${projectId}`).emit(event, payload);
  } catch { /* socket not initialized yet */ }
}
```

每个 mutation 成功后调用一次 emit。5 个 mutation 点：
- create → `task:created`
- update → `task:updated`
- remove → `task:deleted`
- updateStatus → `task:moved`（专用事件，前端知道要重排）
- assignUser / unassignUser → `task:updated`

### 文件 3：`packages/frontend/src/lib/socket.ts`

Singleton socket 工厂。关键点：`auth` 用回调函数延迟获取 token，重连时自动拿最新 token。

### 文件 4：`packages/frontend/src/hooks/useSocket.ts`

React hook，管理 socket 生命周期。依赖数组包含 `[workspaceId, projectId, isAuthenticated]`——切换项目时自动 leave old room、join new room。

**`connectedRef`** 防止 StrictMode 下重复 join room（React 19 StrictMode 会双重调用 effect）。

### 文件 5：`packages/backend/src/index.ts` 的改动

```typescript
// Before: app.listen(config.port, ...)
// After:  createServer(app); io = createSocketServer(httpServer); setIO(io); httpServer.listen(...)
```

为什么需要修改启动方式？Socket.IO 需要附加在原生 `http.Server` 上，不能直接挂在 Express 实例上。Express 的 `app.listen()` 会隐式创建 HTTP server，但我们需要显式创建它以便 Socket.IO 引用。

## 踩坑记录

### 坑 1：Express 5 `app.listen()` 不暴露 HTTP server
**现象**：`io.attach(app)` 失败  
**原因**：Express 5 的 `app.listen()` 返回的 server 类型和 Socket.IO 期望的不完全匹配  
**解决**：显式 `createServer(app)` → `io = new Server(httpServer)` → `httpServer.listen()`

### 坑 2：React StrictMode 导致双重 join room
**现象**：开发环境下 `presence:users` 广播中同一用户出现两次  
**原因**：React 19 StrictMode 在开发环境下会 mount → unmount → mount，导致 effect 跑了两次  
**解决**：`connectedRef` 标记防止重复 join

### 坑 3：`formatTask` 丢失 `projectId`
**现象**：controller 中 `task.projectId` 报 TS 错误  
**原因**：`formatTask()` 用了 `...task` 展开但类型推断只保留了显式字段  
**解决**：重构 `formatTask` 为显式字段构建，确保 `projectId`、`status`、`position` 都在返回类型中

## 延伸阅读

- [Socket.IO Server API](https://socket.io/docs/v4/server-api/)
- [Socket.IO Rooms & Namespaces](https://socket.io/docs/v4/rooms/)
- [Socket.IO Client Auth](https://socket.io/docs/v4/client-options/#auth)
- [WebSocket Protocol RFC 6455](https://datatracker.ietf.org/doc/html/rfc6455)
- [Optimistic Updates with React Query](https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates)

---

## 新增/修改文件清单

```
packages/backend/
├── src/
│   ├── websocket/index.ts        ✅ 新增 — Socket.IO server 工厂 + auth + rooms
│   ├── controllers/task.controller.ts ✅ 修改 — 5 个 mutation 点增加事件发射
│   ├── services/task.service.ts  ✅ 修改 — formatTask 保留 projectId
│   ├── config/index.ts           ✅ 修改 — setIO/getIO ioInstance
│   └── index.ts                  ✅ 修改 — createServer → attach Socket.IO → listen

packages/frontend/
├── src/
│   ├── lib/socket.ts             ✅ 新增 — singleton socket client
│   ├── hooks/useSocket.ts        ✅ 新增 — 生命周期管理 + 事件 → 缓存更新
│   └── pages/ProjectPage.tsx     ✅ 修改 — 调用 useSocket(wsId, projectId)

docs/
└── phase-4-realtime.md           ✅ 本文档
```

## 事件目录

```
Server → Client:
  task:created      { task }
  task:updated      { task }
  task:deleted      { taskId, projectId }
  task:moved        { taskId, projectId, status, position }
  presence:users    { workspaceId, online: Array<{ userId, email }> }

Client → Server:
  join:workspace    { workspaceId }
  leave:workspace   { workspaceId }
  join:project      { projectId }
  leave:project     { projectId }
```

## 测试结果

```
✅ Socket auth 拒绝无 token 连接
✅ Socket auth 接受有效 token
✅ task:created 事件在创建任务时发射
✅ task:moved 事件在拖拽移动任务时发射
✅ 事件到达 socket client 并与 HTTP 响应时间一致
```

**下一步**：Phase 5 — 评论 + 通知系统
