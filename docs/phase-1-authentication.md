# Phase 1 学习文档：认证系统

## 本阶段目标

实现完整的用户认证系统：邮箱注册/登录、JWT 双 Token 机制、OAuth2 第三方登录、前端自动 Token 刷新。这是 SaaS 应用的第一道门，也是面试中最高频被问到的技术点。

## 核心概念

### 1. JWT 双 Token 模式（Access + Refresh）

**为什么需要两个 Token？**

传统的单 Token 方案有一个矛盾：
- 有效期短 → 用户频繁重新登录，体验差
- 有效期长 → Token 被窃取后攻击窗口大，不安全

双 Token 解耦了这两个问题：

| | Access Token | Refresh Token |
|---|---|---|
| **存储** | 前端内存（变量） | httpOnly Cookie |
| **有效期** | 15 分钟 | 7 天 |
| **用途** | API 鉴权（Authorization header） | 获取新的 Access Token |
| **被 XSS 窃取** | 可能（内存可读） | 不可能（httpOnly 对 JS 不可见） |
| **被 CSRF 利用** | 不会（非 Cookie 传输） | 不会（SameSite=Lax） |

```
用户登录 → 获得 access (15min) + refresh (7d, httpOnly cookie)
    │
    │  请求 /api/tasks  → Authorization: Bearer <access>
    │  ├─ 200 → 正常返回
    │  └─ 401 → access 过期
    │         │
    │         └─ 自动 POST /api/auth/refresh (cookie 自动携带)
    │              ├─ 200 → 获得新 access，重放原请求（用户无感知）
    │              └─ 401 → refresh 也过期或被盗用 → 跳转登录页
```

**安全设计要点**：

```typescript
// httpOnly cookie 的设置
res.cookie('refresh_token', token, {
  httpOnly: true,    // JS 不可读（防 XSS）
  secure: true,      // 仅 HTTPS 传输（生产环境）
  sameSite: 'lax',   // 跨站导航不发送（防 CSRF，但允许同站 POST）
  path: '/api/auth', // 只在 auth 路径下发送（最小暴露面）
  maxAge: 7天,       // 到期自动清除
});
```

### 2. Refresh Token Rotation（令牌轮转）

**问题**：如果攻击者获取了一个未过期的 refresh token，他就能无限获取新的 access token。

**解决方式**：每次使用 refresh token 时：
1. 验证旧 token 有效性
2. **删除旧 token**
3. 签发一个**新的** refresh token（同一 family）

这就是 refresh token rotation。如果旧 token 被再次使用（意味着攻击者持有了被盗的 token，而合法用户已经用过了）：
```typescript
// 检测到 token 重用 — 这是旋转攻击
if (!storedInDB) {
  // 吊销整个 family！让合法用户和攻击者都重新登录
  await prisma.refreshToken.deleteMany({ where: { family: payload.family } });
  throw new UnauthenticatedError('Token reused — family revoked');
}
```

**为什么用 token family？**
- 每次旋转签发同一个 family 的新 token
- 如果 family 内任何 token 被重用，吊销整个 family
- 合法用户会因被吊销而重新登录（收到安全通知）
- 攻击者无法再使用任何该 family 的 token

### 3. bcrypt 密码哈希

```typescript
import bcrypt from 'bcryptjs';  // 纯 JS 实现，无原生依赖

const SALT_ROUNDS = 12;  // 2^12 = 4096 次迭代，平衡安全与性能

// 注册时：哈希后存储（永不存明文）
const hash = await bcrypt.hash(plainPassword, SALT_ROUNDS);

// 登录时：比对哈希（永不做解密，bcrypt 是单向的）
const match = await bcrypt.compare(plainPassword, hash);
```

**关键知识点**：
- bcrypt 是**单向**的 — 你永远无法从哈希推导出密码
- salt rounds = 12 意味着 2^12 次迭代，在 2026 年的硬件上约 250ms
- 每次哈希时 salt 随机，所以同一密码两次哈希结果不同
- 为什么用 bcryptjs 而不用 bcrypt？bcrypt 有 C++ 原生依赖，在 Docker/Alpine 中容易编译失败

### 4. OAuth2 授权码流程（Authorization Code Grant）

OAuth2 是目前互联网最主流的三方登录协议。完整流程：

```
1. 用户点击 "Sign in with Google"
   └─ 前端跳转 → GET /api/auth/oauth/google
      └─ 后端构建授权 URL，302 重定向到 Google：
         https://accounts.google.com/o/oauth2/v2/auth?
           client_id=xxx&
           redirect_uri=http://localhost:3000/api/auth/oauth/google/callback&
           response_type=code&
           scope=openid+email+profile

2. Google 展示授权页面，用户确认

3. Google 302 重定向回你的 callback URL：
   http://localhost:3000/api/auth/oauth/google/callback?code=AUTH_CODE

4. 后端用 code 换 token（后端到 Google，用户看不到）：
   POST https://oauth2.googleapis.com/token
   { code, client_id, client_secret, grant_type: "authorization_code" }
   ← { access_token, ... }

5. 后端用 access_token 获取用户信息（后端到 Google）：
   GET https://www.googleapis.com/oauth2/v2/userinfo
   Authorization: Bearer <google_access_token>
   ← { id, email, name, picture }

6. 后端创建/查找 TaskFlow 用户，签发自己的 JWT

7. 302 重定向回前端，URL 中附带 taskflow 的 access token：
   http://localhost:5173/oauth/callback?access_token=xxx&user={...}
```

**为什么后端换 code 而不在前端做？**
- client_secret 必须保密（只能在后端）
- 授权码（code）是一次性的，用完即销毁
- 前端拿不到 client_secret，拿不到 refresh_token（安全）

### 5. API Client 的 Axios 拦截器模式

前端在 `api-client.ts` 中实现了自动 token 刷新：

```
请求拦截器
  ├─ 每个请求自动附加 Authorization header（从内存取 access token）
  └─ 请求发出

响应拦截器 (401 处理)
  ├─ 正常响应 → 直接返回
  ├─ 401 + 非 refresh 请求
  │   ├─ 不在刷新中 → 发起 refresh 请求，成功后重放原请求
  │   └─ 正在刷新中 → 将原请求加入队列，refresh 完成后批量重放
  └─ refresh 本身 401 → 跳转登录页
```

**关键的并发 401 处理**：
```typescript
let isRefreshing = false;
let refreshSubscribers: Array<{ resolve; reject }> = [];

// 场景：页面加载后同时发出 3 个 API 请求，access token 已过期
// 第 1 个请求触发 refresh，后 2 个排队等待
// refresh 完成后，3 个请求用新 token 同时重放
```

## 关键代码走读

### 文件 1：`packages/backend/src/services/auth.service.ts`

核心业务逻辑，与 HTTP 层完全解耦。

**`issueTokens()`** 是 Token 签发的核心辅助函数：
```typescript
async function issueTokens(userId: string, family?: string) {
  const tokenFamily = family ?? createId();   // 首次登录创建新 family
  const refreshTokenId = createId();           // 每个 refresh token 有唯一 ID

  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user, refreshTokenId, tokenFamily);

  // refresh token 持久化到 DB（用于后续验证和吊销）
  await prisma.refreshToken.create({
    data: { id: refreshTokenId, userId, token: refreshToken,
            family: tokenFamily, expiresAt: ... },
  });

  return { accessToken, refreshToken };
}
```

**`login()` vs `register()` vs `refreshTokens()` vs `oauthCallback()`** — 四种不同的认证入口，但最终都调用 `issueTokens()` 统一签发 token 对。

### 文件 2：`packages/backend/src/utils/jwt.ts`

封装了 jsonwebtoken 库，提供类型安全的签名和验证：
- `signAccessToken` / `signRefreshToken` — payload 类型约束
- `verifyAccessToken` / `verifyRefreshToken` — 返回类型化 payload
- Access token payload: `{ sub: userId, email }`
- Refresh token payload: `{ sub: userId, jti: tokenId, family }`

### 文件 3：`packages/backend/src/middleware/authenticate.ts`

JWT 鉴权中间件，只有 12 行：
```typescript
export function authenticate(req, _res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) throw new UnauthenticatedError('...');
  const payload = verifyAccessToken(token);  // 抛异常 → 401
  req.user = { id: payload.sub, email: payload.email };  // 注入用户信息
  next();
}
```

后续所有受保护路由：`router.get('/me', authenticate, controller.getMe)`

### 文件 4：`packages/frontend/src/lib/api-client.ts`

Axios 实例配置 + 双拦截器：
- **请求拦截器**：每次请求前从内存读取 access token 附加到 header
- **响应拦截器**：401 自动触发 refresh → 重放失败请求 → refresh 失败则跳转登录

**为什么 access token 存内存而不是 localStorage？**
- localStorage 可被 XSS 读取 → token 泄露
- 内存变量在页面刷新时丢失 → 需要 refresh token（httpOnly cookie）恢复
- 这就是双 Token 架构的精妙之处

### 文件 5：`packages/backend/src/controllers/auth.controller.ts`

控制器层职责：解析 HTTP 请求 → 调用 service → 构造 HTTP 响应。

OAuth 流程中 `fetchOAuthProfile()` 函数处理了 Google 和 GitHub 两种提供者的差异：
- Google 用 `oauth2/v2/userinfo` 获取用户信息（email 必定返回）
- GitHub 用 `/user` + `/user/emails`（email 可能为 private，需单独获取）

## 踩坑记录

### 坑 1：Express 5 的异步错误处理
**现象**：controller 中 throw 的错误没有被 errorHandler 捕获  
**原因**：Express 5 虽然支持 async/await，但函数必须返回 Promise，错误才会被捕获  
**解决**：用 try/catch + `next(err)` 模式包裹每个处理器，或使用 `express-async-errors` 包

### 坑 2：httpOnly Cookie + CORS 的配置
**现象**：前端收不到 refreshToken cookie  
**原因**：三个条件缺一不可：
- 后端 `cors({ credentials: true })` 且 `origin` 不能是 `*`
- 前端 `axios/fetch` 设置 `credentials: 'include'`
- Cookie 的 `sameSite` 不能是 `strict`（跨站场景）
**解决**：`sameSite: 'lax'` + `credentials: true` 两边配齐

### 坑 3：jsonwebtoken sign() 的 expiresIn 类型
**现象**：`jwt.sign(payload, secret, { expiresIn: '15m' })` 报 TS 错误  
**原因**：新版 `@types/jsonwebtoken` 中 `expiresIn` 使用了 `number | StringValue` 类型  
**解决**：用 `SignOptions['expiresIn']` 做类型断言

## 延伸阅读

- [JWT Best Practices (IANA)](https://datatracker.ietf.org/doc/html/rfc8725)
- [The Hard Parts of JWT Security Nobody Talks About](https://pragmaticwebsecurity.com/articles/apisecurity/hard-parts-of-jwt-security)
- [OAuth 2.0 Simplified](https://www.oauth.com/)
- [Refresh Token Rotation — Auth0 Blog](https://auth0.com/blog/refresh-tokens-what-are-they-and-when-to-use-them/)
- [Express Error Handling](https://expressjs.com/en/guide/error-handling.html)

---

## 新增/修改文件清单

```
packages/backend/
├── src/
│   ├── utils/jwt.ts           ✅ 新增 — JWT 签名/验证
│   ├── utils/password.ts      ✅ 新增 — bcrypt 哈希/比对
│   ├── services/auth.service.ts ✅ 新增 — 注册/登录/刷新/登出/OAuth
│   ├── controllers/auth.controller.ts ✅ 新增 — 认证 HTTP 控制器
│   ├── controllers/user.controller.ts ✅ 新增 — 用户信息控制器
│   ├── routes/auth.routes.ts  ✅ 新增 — /api/auth/* 路由
│   ├── routes/user.routes.ts  ✅ 新增 — /api/users/* 路由
│   ├── middleware/authenticate.ts ✅ 新增 — JWT 鉴权中间件
│   ├── middleware/validate.ts  ✅ 新增 — Zod 校验中间件
│   ├── types/express.d.ts     ✅ 新增 — Express Request 类型扩展
│   └── app.ts                 ✅ 修改 — 挂载路由 + cookieParser
└── package.json               ✅ 修改 — 新增 cookie-parser 依赖

packages/frontend/
├── src/
│   ├── lib/api-client.ts      ✅ 新增 — Axios + 拦截器 + token 管理
│   ├── stores/auth-store.ts   ✅ 新增 — Zustand 认证状态
│   ├── api/auth.ts            ✅ 新增 — React Query 认证 hooks
│   ├── components/
│   │   ├── ui/button.tsx      ✅ 新增 — Button 组件
│   │   ├── ui/input.tsx       ✅ 新增 — Input 组件
│   │   ├── auth/ProtectedRoute.tsx ✅ 新增 — 路由守卫
│   │   └── layout/AuthLayout.tsx   ✅ 新增 — 认证页布局
│   ├── pages/
│   │   ├── LoginPage.tsx      ✅ 新增 — 登录页
│   │   ├── RegisterPage.tsx   ✅ 新增 — 注册页
│   │   ├── OAuthCallbackPage.tsx ✅ 新增 — OAuth 回调
│   │   └── DashboardPage.tsx  ✅ 新增 — 首页（临时）
│   └── App.tsx                ✅ 修改 — 完整路由配置
```

## API 测试结果

```
POST /api/auth/register  → 201 { user, accessToken } + httpOnly refresh cookie
POST /api/auth/login     → 200 { user, accessToken } + httpOnly refresh cookie
GET  /api/users/me       → 200 { id, email, name, ... } (Bearer token)
POST /api/auth/refresh   → 200 { accessToken } (reads cookie, issues new token pair)
POST /api/auth/logout    → 200 { message } (clears cookie, revokes token)
```

**下一步**：Phase 2 — 工作区 + RBAC 权限
