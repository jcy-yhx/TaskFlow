# Phase 3 学习文档：看板 + 任务管理

## 本阶段目标

实现 Kanban 看板（看板 = Kanban，日文"看板"）：创建/编辑/删除项目和工作项，5 列表拖拽排序，任务指派。这是整个应用的核心价值功能——面试中最能展示前端工程能力的部分。

## 核心概念

### 1. 看板位置排序算法（Position Reordering）

看板拖拽的核心挑战：**如何在列表中高效地插入/移动项目？**

**问题**：假设 Todo 列表有 3 个任务（position: 0, 1, 2），用户把位置 2 的任务拖到位置 0，需要如何处理？

**方案：整数 Position + 移位**

```
Before:  Task A(pos=0)  Task B(pos=1)  Task C(pos=2)
Move:    Task C from pos=2 → pos=0

Shifts:
  Task A: 0 → 1  (shift right)
  Task B: 1 → 2  (shift right)
  Task C: 2 → 0  (moved)

After:   Task C(pos=0)  Task A(pos=1)  Task B(pos=2)
```

**实现**：

```typescript
// Same column reorder
if (newPosition > oldPosition) {
  // Moving down: shift intermediate tasks up by 1
  await prisma.task.updateMany({
    where: { projectId, status, position: { gt: oldPosition, lte: newPosition } },
    data: { position: { decrement: 1 } },
  });
} else {
  // Moving up: shift intermediate tasks down by 1
  await prisma.task.updateMany({
    where: { projectId, status, position: { gte: newPosition, lt: oldPosition } },
    data: { position: { increment: 1 } },
  });
}

// Cross-column move
// 1. Close gap in old column
await prisma.task.updateMany({
  where: { projectId, status: oldStatus, position: { gt: oldPosition } },
  data: { position: { decrement: 1 } },
});
// 2. Make room in new column
await prisma.task.updateMany({
  where: { projectId, status: newStatus, position: { gte: newPosition } },
  data: { position: { increment: 1 } },
});
```

**为什么不用 Fractional Indexing（如 `task.order` = "a0", "aZ", "az"）？**
- 整数方案简单，直到 ~10,000 条任务都可接受
- 同列任务数不超过百位，O(n) 移位开销极小
- 面试时更容易解释

### 2. 乐观更新 (Optimistic Update)

**问题**：用户拖拽卡片 → 等待服务器响应 → 卡片才移动。在慢网络下会有明显的卡顿感。

**解决方案**：先改 UI，再等服务器确认。

```typescript
useMutation({
  mutationFn: async ({ id, status, position }) => {
    // 真正调用 API（可能 200-500ms）
    await apiClient.patch(`/tasks/${id}/status`, { status, position });
  },
  onMutate: async ({ id, status, position }) => {
    // 乐观更新：立即更新缓存
    await queryClient.cancelQueries({ queryKey: taskKeys.byStatus(projectId) });
    const previous = queryClient.getQueryData(taskKeys.byStatus(projectId));

    // 从旧列取出任务，放入新列，更新缓存
    const updated = cloneAndMove(previous, id, status, position);
    queryClient.setQueryData(taskKeys.byStatus(projectId), updated);

    return { previous }; // 保存旧数据，用于回滚
  },
  onError: (_err, _vars, context) => {
    // 服务器失败 → 回滚到旧数据
    if (context?.previous) {
      queryClient.setQueryData(taskKeys.byStatus(projectId), context.previous);
    }
    toast.error('Failed to move task');
  },
  onSettled: () => {
    // 最终 invalidate，确保缓存与服务器一致
    queryClient.invalidateQueries({ queryKey: taskKeys.byStatus(projectId) });
  },
});
```

**乐观更新的三步模式**：
1. `onMutate` — 立即更新缓存（用户看到即时效果），同时保存 `previous` 快照
2. `onError` — 服务器失败后恢复 `previous`
3. `onSettled` — 无论成败，最终刷新缓存确保一致性

### 3. @dnd-kit 的拖拽架构

@dnd-kit 是目前最流行的 React 拖拽库，架构比 react-beautiful-dnd 更现代：

```
DndContext (最外层，管理拖拽状态)
├── sensors (指针/键盘/触摸检测)
├── collisionDetection (如何判断"拖到哪了")
├── onDragStart / onDragEnd (事件回调)
│
├── Droppable (可接收拖入的区域) → KanbanColumn
└── Sortable (可排序的 item)       → KanbanCard
```

**关键设计**：
- `PointerSensor` 的 `activationConstraint: { distance: 5 }` — 移动 5px 后才开始拖拽，避免误触
- `closestCorners` 碰撞检测 — 判断离哪个 droppable 区域最近（而非 centroids）
- `DragOverlay` — 拖拽时显示原卡片的克隆体（视觉反馈强）
- `SortableContext` + `verticalListSortingStrategy` — 列内垂直排序

### 4. Express 路由的 `mergeParams`

看板的路由结构是嵌套的：

```
/api/projects/:projectId/tasks    ← task routes 嵌套在 project 下
/api/tasks/:taskId                ← 也支持直接访问
```

`mergeParams: true` 让子路由能访问父路由的 params：

```typescript
const router = Router({ mergeParams: true });
// router 挂在 /api/projects/:projectId/tasks 下
// 现在 req.params.projectId 可以访问了
```

权限校验中间件需要处理两种路由模式下的 workspace 解析：

```typescript
// 直接解析 workspaceId，或通过 projectId 反查
const wsId = req.params.id ?? req.params.workspaceId;
const pid = req.params.projectId;

if (pid && !wsId) {
  // 从 project 反查 workspace
  const project = await prisma.project.findUnique({ where: { id: pid } });
  wsId = project.workspaceId;
}
```

### 5. React Query 缓存策略

本阶段的缓存层次：

```
['workspaces', 'list']        → DashboardPage (工作区列表)
['projects', 'list', wsId]    → WorkspacePage 侧边栏
['tasks', 'byStatus', projId] → KanbanBoard (按状态分组)
['tasks', 'detail', id]       → TaskDetailSheet
```

**Invalidation 策略**：
- 创建任务 → invalidate `['tasks', 'byStatus', projId]`
- 移动任务 → 乐观更新 + invalidate
- 删除项目 → invalidate `['projects', 'list', wsId]` + `['workspaces', 'list']`

### 6. `_count` 查询优化

Prisma 的 `_count` 可以在一次查询中获取关联记录数，无需额外 round-trip：

```typescript
// project.service.ts — listProjects
include: {
  _count: { select: { tasks: true } },  // 项目下的任务总数
  tasks: { select: { status: true } },   // 用于按状态分组计数
}
```

前端 controller 将 tasks 数组转成 `statusCounts: { TODO: 3, DONE: 2 }` 后移除 tasks 数组，减小响应体积。

## 关键代码走读

### 文件 1：`packages/backend/src/services/task.service.ts`

**`updateTaskStatus()`** 是整个后端最复杂的函数。实现了同列和跨列两种位置重算逻辑。在 68 行内完成了完整的看板拖拽后端支持。

**`getTasksByStatus()`** 是看板视图的专用查询——按 status field 将所有任务分组成 5 个数组返回：
```typescript
const grouped: Record<string, Array<Task>> = {
  BACKLOG: [], TODO: [], IN_PROGRESS: [], IN_REVIEW: [], DONE: [],
};
for (const t of tasks) {
  grouped[t.status]?.push(formatTask(t));
}
```

**`listTasks()`** 支持多维度过滤：status、priority、assignee、search。查询参数通过 Zod schema 校验（`taskQuerySchema`）后传入 service。

### 文件 2：`packages/frontend/src/api/tasks.ts`

`useMoveTask` 的 optimistic update 是前端最核心的 mutation：
- `onMutate` — 快照当前缓存 → 克隆数据 → 从旧列移除 → 插入新列 → setQueryData
- `onError` — 恢复快照、toast 错误
- `onSettled` — invalidate 确保最终一致性

### 文件 3：`packages/frontend/src/components/task/KanbanBoard.tsx`

```
DndContext (PointerSensor + closestCorners)
├── 5 个 KanbanColumn (每个对应一个 TaskStatus)
│   └── SortableContext (verticalListSortingStrategy)
│       └── N 个 KanbanCard (useSortable)
└── DragOverlay (拖拽时的浮层副本)
```

`handleDragEnd` 中处理了关键的边界情况：拖到列空白区域（over.data.current?.type === 'column'）vs 拖到卡片上。通过 `over.data.current?.task.status` 判断目标列。

### 文件 4：`packages/frontend/src/components/task/TaskDetailSheet.tsx`

右侧抽屉显示完整任务详情：标题可编辑、状态/优先级下拉、描述 textarea、截止日期选择器、指派管理。

焦点设计：
- 状态和优先级的 `<select>` 在 header 中，inline 修改无需打开额外面板
- 指派管理通过下拉新增 + inline 移除（`UserX` 按钮）
- 截止日期用 `<input type="date">` 原生控件

### 文件 5：`packages/frontend/src/api/tasks.ts` 的 query key 分层

```typescript
export const taskKeys = {
  all: ['tasks'] as const,
  byProject: (projectId: string) => [...taskKeys.all, 'project', projectId] as const,
  byStatus: (projectId: string) => [...taskKeys.all, 'byStatus', projectId] as const,
  detail: (id: string) => [...taskKeys.all, 'detail', id] as const,
};
```

精确的分层让 invalidate 可以做到"只刷新看板，不动详情缓存"。

## 踩坑记录

### 坑 1：Droppable 的 id 和 Sortable 的 id 冲突
**现象**：看板列不可拖放  
**原因**：`Droppable` 的 `id` 和 `SortableContext` 内部的 `id` 如果重合，@dnd-kit 会混淆  
**解决**：列用 `status` 字符串（"TODO"），卡片用 `task.id`，两者天然不冲突

### 坑 2：乐观更新后位置不一致
**现象**：拖拽后瞬间位置不对，刷新后恢复  
**原因**：乐观更新中只移动了卡片但没重新计算 position  
**解决**：`updated[status]` 排序后重新赋值 position（`map((t, i) => ({ ...t, position: i }))`）

### 坑 3：Prisma `skip` undefined
**现象**：`prisma.task.findMany({ skip: undefined })` 报错 "Argument `skip` is missing"  
**原因**：当 `query.page` 和 `query.pageSize` 通过 Zod 的 `.default()` 设置了默认值后，它们永远是 number，但未传时 req.query 解析后可能跳过 Zod 得到 undefined  
**解决**：在 controller 中用 `taskQuerySchema.parse(req.query)` 确保所有字段经过 Zod coercion

## 延伸阅读

- [@dnd-kit 官方文档](https://dndkit.com/)
- [Optimistic Updates in TanStack Query](https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates)
- [Designing a Kanban Board's Data Model](https://www.prisma.io/blog/database-design-for-kanban-boards)
- [React Router Layout Routes](https://reactrouter.com/start/library/routing#layout-routes)
- [Express Router mergeParams](https://expressjs.com/en/api.html#express.router)

---

## 新增/修改文件清单

```
packages/backend/
├── src/
│   ├── services/project.service.ts      ✅ 新增
│   ├── services/task.service.ts         ✅ 新增 (position reordering)
│   ├── controllers/project.controller.ts ✅ 新增
│   ├── controllers/task.controller.ts   ✅ 新增
│   ├── routes/project.routes.ts         ✅ 新增 (mergeParams)
│   ├── routes/task.routes.ts            ✅ 新增 (mergeParams)
│   ├── middleware/authorize.ts          ✅ 修改 (project→workspace 解析)
│   └── app.ts                           ✅ 修改 (挂载 project/task 路由)

packages/frontend/
├── src/
│   ├── api/projects.ts                  ✅ 新增
│   ├── api/tasks.ts                     ✅ 新增 (optimistic updates)
│   ├── components/
│   │   ├── task/KanbanBoard.tsx         ✅ 新增 (DndContext)
│   │   ├── task/KanbanColumn.tsx        ✅ 新增 (Droppable)
│   │   ├── task/KanbanCard.tsx          ✅ 新增 (useSortable)
│   │   ├── task/TaskForm.tsx            ✅ 新增
│   │   ├── task/TaskDetailSheet.tsx     ✅ 新增
│   │   └── project/ProjectForm.tsx      ✅ 新增
│   ├── pages/
│   │   ├── ProjectPage.tsx              ✅ 新增 (看板视图)
│   │   ├── ProjectListPage.tsx          ✅ 新增 (表格视图)
│   │   └── WorkspacePage.tsx            ✅ 修改 (项目侧边栏)
│   └── App.tsx                          ✅ 修改 (项目路由)
```

## API 端点总结

```
POST   /api/workspaces/:workspaceId/projects  → 创建项目 (需 ADMIN+)
GET    /api/workspaces/:workspaceId/projects  → 列表项目 (含任务数统计)
GET    /api/projects/:projectId               → 项目详情
PATCH  /api/projects/:projectId               → 更新项目 (需 ADMIN+)
DELETE /api/projects/:projectId               → 删除项目 (需 ADMIN+, 级联删除任务)

POST   /api/projects/:projectId/tasks         → 创建任务
GET    /api/projects/:projectId/tasks         → 列表任务 (多维度过滤 + 分页)
GET    /api/projects/:projectId/tasks/by-status → 按状态分组 (Kanban 专用)
GET    /api/tasks/:taskId                     → 任务详情
PATCH  /api/tasks/:taskId                     → 更新任务
DELETE /api/tasks/:taskId                     → 删除任务 (需 ADMIN+)
PATCH  /api/tasks/:taskId/status              → 移动任务 (position reordering)
POST   /api/tasks/:taskId/assignees           → 指派用户
DELETE /api/tasks/:taskId/assignees/:userId   → 取消指派
```

**下一步**：Phase 4 — 实时协作（Socket.IO 实时同步看板变更）
