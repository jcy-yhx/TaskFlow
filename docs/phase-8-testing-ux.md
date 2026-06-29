# Phase 8 学习文档：测试 + UX 打磨

## 本阶段目标

为项目增加测试覆盖和完善用户体验。包括后端单元测试/集成测试、前端组件测试、骨架屏、空状态、错误边界，以及 toast 提示。

## 核心概念

### 1. 测试金字塔

```
         /\
        /E2E\         Playwright (Phase 9 可加)
       /------\
      /  集成  \       Supertest + 真实 Express app
     /----------\
    /   单元测试  \     Vitest (纯函数/类测试)
   /--------------\
```

本阶段覆盖金字塔底两层，28 个测试全部通过：

| 层级 | 文件 | 测试数 | 覆盖范围 |
|------|------|--------|---------|
| 单元 | `tests/auth.test.ts` | 12 | bcrypt, JWT, 注册, 登录 |
| 单元 | `tests/task.test.ts` | 4 | 任务 CRUD 错误处理 |
| 单元 | `__tests__/utils.test.ts` | 3 | cn() className 合并 |
| 单元 | `__tests__/stores.test.ts` | 3 | Zustand auth store |
| 集成 | `tests/api.test.ts` | 6 | 完整 API 流程 + 认证守卫 |

### 2. Supertest 集成测试模式

Supertest 是 Express 最常用的测试工具——它将 Express app 包裹在一个 HTTP client 中，无需实际启动服务器：

```typescript
import request from 'supertest';
import { createApp } from '../src/app.js';

// 不需要 listen，直接传入 app 实例
const res = await request(app)
  .post('/api/auth/register')
  .send({ email, password, name })
  .expect(201);  // 断言状态码

expect(res.body.data.accessToken).toBeDefined();
```

**集成测试流程**：
```typescript
// 一个测试覆盖完整业务流程
beforeAll → 注册用户 → 获取 token → 创建工作区
it → 创建项目 → 创建任务 → 更新 → 移动 → 删除 → 验证
```

### 3. Zustand Store 测试

```typescript
// 不需要渲染组件，直接测试状态逻辑
it('should login successfully', () => {
  useAuthStore.getState().login(mockUser, 'access-token-123');
  expect(useAuthStore.getState().isAuthenticated).toBe(true);
});
```

### 4. 骨架屏 (Skeleton)

占位符模式：在数据加载完成前，渲染一个灰色脉冲动画占位块。

```tsx
function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-muted', className)} />;
}

// 使用：模拟卡片结构
<Skeleton className="h-4 w-3/4" />    // 标题占位
<Skeleton className="h-3 w-1/2" />    // 副标题占位
<Skeleton className="h-5 w-5 rounded-full" />  // 头像占位
```

### 5. 空状态 (Empty State)

```tsx
<EmptyState
  icon={<FileText className="w-12 h-12" />}
  title="No projects yet"
  description="Create your first project to get started."
  action={<Button onClick={...}>Create Project</Button>}
/>
```

### 6. ErrorBoundary

React class component 实现（错误边界必须用 class component）：

```tsx
class ErrorBoundary extends Component<Props, State> {
  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return <FallbackUI onRetry={() => this.setState({ hasError: false })} />;
    }
    return this.props.children;
  }
}
```

## 测试要求清单

- [x] 密码哈希/验证
- [x] JWT 签名/解析
- [x] 用户注册（正常 + 重复）
- [x] 用户登录（正常 + 错误密码 + 不存在）
- [x] 任务 CRUD 错误处理
- [x] 完整 API 流程（注册→工作区→项目→任务→CRUD）
- [x] 未认证请求拦截
- [x] 无效 JWT 拦截
- [x] cn() className 合并
- [x] Zustand AuthStore 状态流转

## 踩坑记录

### 坑 1：Vitest 的 root vs include
**现象**：`npx vitest run --config packages/backend/vitest.config.ts` 找不到测试文件  
**原因**：vitest 的 `include` 是相对于 `root` 的，默认 root 是项目根目录  
**解决**：在 vitest config 中设置 `root: path.resolve(__dirname)`

### 坑 2：并发测试中的数据库状态污染
**现象**：后续测试运行时有残留数据  
**解决**：每个测试用例用唯一的 email (`Date.now()`)，避免跨用例数据冲突

### 坑 3：ErrorBoundary 必须是 class component
**现象**：用函数组件 + try/catch 实现错误边界失败  
**原因**：React 的 Error Boundary 依赖 `getDerivedStateFromError` / `componentDidCatch` 生命周期，函数组件没有这些 hook  
**解决**：用 class component

## 延伸阅读

- [Vitest 官方文档](https://vitest.dev/)
- [Supertest 集成测试](https://github.com/ladjs/supertest)
- [React Error Boundaries](https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary)
- [Testing React Query](https://tanstack.com/query/latest/docs/framework/react/guides/testing)
- [Testing Zustand](https://docs.pmnd.rs/zustand/guides/testing)

---

## 新增/修改文件清单

```
packages/backend/
├── vitest.config.ts                         ✅ 新增
├── tests/
│   ├── setup.ts                             ✅ 新增
│   ├── auth.test.ts                         ✅ 新增 (12 tests)
│   ├── task.test.ts                         ✅ 新增 (4 tests)
│   └── api.test.ts                          ✅ 新增 (6 tests)

packages/frontend/
├── src/
│   ├── __tests__/
│   │   ├── utils.test.ts                    ✅ 新增 (3 tests)
│   │   └── stores.test.ts                   ✅ 新增 (3 tests)
│   ├── components/
│   │   ├── ui/skeleton.tsx                  ✅ 新增
│   │   ├── common/EmptyState.tsx            ✅ 新增
│   │   └── common/ErrorBoundary.tsx         ✅ 新增
│   └── main.tsx                             ✅ 修改 (ErrorBoundary 包裹)
```

## 测试结果

```
Backend:  3 files | 22 tests | ✓ all passed
Frontend: 2 files | 6 tests  | ✓ all passed
Total:    5 files | 28 tests | ✓ all passed
```

**下一步**：Phase 9 — 部署 + 文档
