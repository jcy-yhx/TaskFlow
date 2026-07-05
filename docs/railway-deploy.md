# Railway 部署指南

> 🟢 **在线地址**：[https://taskflowfrontend-production-764b.up.railway.app](https://taskflowfrontend-production-764b.up.railway.app)

## 架构

```
浏览器 → frontend.up.railway.app (Node.js Express :8080)
              │
              ├── /              → SPA 静态文件
              ├── /api/*         → proxy → taskflowbackend.railway.internal:3000
              ├── /socket.io/*   → proxy (WebSocket) → :3000
              └── /uploads/*     → proxy → :3000
                                            │
                                     ┌──────┴──────┐
                                     │ PostgreSQL  │ (Railway 插件)
                                     └─────────────┘
```

注意：最终方案用 **Node.js Express + http-proxy-middleware** 而非 Nginx 做反向代理（见下方问题 3）。

## 步骤 1：推送代码到 GitHub

```bash
git add -A
git commit -m "Railway deploy"
git push origin main
```

## 步骤 2：在 Railway 创建项目

1. 打开 [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo**
2. 选择你的 TaskFlow 仓库

## 步骤 3：添加数据库插件

项目页面 → **New** → **Database** → PostgreSQL。

Railway 会自动注入 `DATABASE_URL` 环境变量。**不用手动添加**，但如果手动加了其他 PostgreSQL 变量，需要删掉 Railway 自己生成的、以 Railway 注入的为准。

> ⚠️ Railway 的 PostgreSQL 要求 SSL 连接。确保 `DATABASE_URL` 末尾有 `?sslmode=require`。

## 步骤 4：创建 Backend 服务

项目页面 → **New** → **Service** → **Empty Service**（选 GitHub 仓库）。

**Settings → General**：

| 字段 | 值 |
|------|-----|
| Service Name | `taskflowbackend`（不能是 `backend`，Railway 根据 package.json 自动命名） |
| Root Directory | `/` |
| Dockerfile Path | `Dockerfile.backend` |
| Start Command | 留空（Dockerfile 自带 entrypoint） |

**Variables**（⚠️ Railway 自动从 `.env.example` 扫出来的默认值**全部要改为空或删除**）：

| 变量 | 值 | 说明 |
|------|-----|------|
| `PORT` | `3000` | **必须手动加！** Railway 自动注入 `PORT=8080`，要用这个覆盖，确保后端监听 3000 |
| `FRONTEND_URL` | `http://localhost` | 先占位，拿到 frontend 域名后改 |
| `BACKEND_URL` | `http://localhost` | 同上 |
| `JWT_ACCESS_SECRET` | `openssl rand -hex 32` 生成 | 不要用默认的 `change-me-...` |
| `JWT_REFRESH_SECRET` | `openssl rand -hex 32` 生成 | 同上 |
| `JWT_ACCESS_EXPIRY` | `15m` | 可保留默认 |
| `JWT_REFRESH_EXPIRY` | `7d` | 可保留默认 |
| `UPLOAD_DIR` | `./uploads` | 可保留 |
| `MAX_FILE_SIZE` | `10485760` | 可保留 |
| `RESEND_API_KEY` | 你的 Resend API Key | 邀请邮件 |
| `GOOGLE_CLIENT_ID` | 你的 Google Client ID | OAuth（可选） |
| `GOOGLE_CLIENT_SECRET` | 你的 Google Client Secret | OAuth（可选） |
| `GOOGLE_CALLBACK_URL` | `https://域名/api/auth/oauth/google/callback` | OAuth（可选） |
| `GITHUB_CLIENT_ID` | 你的 GitHub Client ID | OAuth（可选） |
| `GITHUB_CLIENT_SECRET` | 你的 GitHub Client Secret | OAuth（可选） |
| `GITHUB_CALLBACK_URL` | `https://域名/api/auth/oauth/github/callback` | OAuth（可选） |

**以下变量要删除**（Railway 自动扫出来的，但生产环境不适用）：

- `DATABASE_URL` — 会被 PostgreSQL 插件自动注入，手动加的可能端口/密码不对
- `SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS` — 生产走 Resend，不走 SMTP
- `REDIS_URL` — 没加 Redis 插件就删掉

## 步骤 5：创建 Frontend 服务

**Settings → General**：

| 字段 | 值 |
|------|-----|
| Service Name | `taskflowfrontend` |
| Root Directory | `/` |
| Dockerfile Path | `Dockerfile.frontend.railway` |
| Start Command | 留空 |

**Variables**：不需要手动加任何变量。

## 步骤 6：生成域名

Frontend 服务 → **Settings** → **Domains** → **Generate Service Domain** → 端口填 **8080**。

> Railway 会给前端容器注入 `PORT=8080`，`server.js` 读这个环境变量监听 8080。

## 步骤 7：配置 CORS

拿到 frontend 域名后（如 `taskflowfrontend-production-xxxx.up.railway.app`），去 backend → Variables 更新：

```
FRONTEND_URL=https://taskflowfrontend-production-xxxx.up.railway.app
BACKEND_URL=https://taskflowfrontend-production-xxxx.up.railway.app
```

然后 **Redeploy** backend。CORS 不配会导致登录返回 401/403。

## 步骤 8：配置 OAuth

去 Google Cloud Console / GitHub Developer Settings 更新回调地址为新的 Railway 域名。

## 常见问题总结

这些是本次部署实际踩过的坑：

| # | 问题 | 现象 | 根因 | 解决 |
|---|------|------|------|------|
| 1 | **DATABASE_URL 未找到** | 容器启动 crash: `Environment variable not found: DATABASE_URL` | PostgreSQL 插件自动注入的变量被手动加的空值覆盖了 | 删掉手动加的 `DATABASE_URL`，保留插件注入的 |
| 2 | **Nginx DNS 解析失败** | 前端 502: `host not found in upstream "backend:3000"` | `nginx.conf` 里的 `upstream backend` 是 Docker Compose 的 DNS 名，Railway 上不存在 | 改为 `taskflowbackend.railway.internal` |
| 3 | **Nginx DNS 超时** | 前端 502: `backend.railway.internal could not be resolved (110: Operation timed out)` | Railway 容器不用 Docker DNS (`127.0.0.11`)，系统 DNS 在 nginx 变量模式下不稳定 | **放弃 nginx**，用 Node.js Express + `http-proxy-middleware` 做反向代理 |
| 4 | **Nginx 解析出 IPv6** | 前端 502: `upstream server temporarily disabled`, upstream 显示 IPv6 地址 | Railway DNS 解析出 IPv6，但后端只监听 IPv4，nginx 连接拒绝 | 同上，换 Node.js 代理 |
| 5 | **Express 5 catch-all 路由崩溃** | 容器 crash: `Missing parameter name at index 1: *` | Express 5 里 `app.get('*', ...)` 语法不兼容，需要 `/{*path}` | 改为 `app.get('/{*path}', ...)` |
| 6 | **Express 5 路径剥离导致 404** | 前端 504: `Route not found` | `app.use('/api', proxy)` 在 Express 5 里会剥离 `/api` 前缀 | 改用 `proxy({ pathFilter: '/api', ... })` |
| 7 | **PORT 自动注入导致端口不匹配** | 前端 504 Gateway Timeout | Railway 给前后端都注入 `PORT=8080`，后端实际监听 3000（Dockerfile EXPOSE），proxy 写的是 3000 → 连接超时 | Backend 手动加 `PORT=3000` 覆盖 |
| 8 | **前端生成域名端口不匹配** | 前端 Application failed to respond | 后端被注入 `PORT=8080`，前端 `server.js` 监听 8080，生成域名填 80 | 域名端口改为 **8080** |
| 9 | **FRONTEND_URL 没更新** | 登录/注册报 401 或 CORS 错误 | 后端 CORS 允许的 origin 还是 `http://localhost:5173`，拒绝 Railway 域名 | 更新 `FRONTEND_URL` 和 `BACKEND_URL` 为 Railway 域名后 Redeploy |
| 10 | **数据库 SSL 连接** | 日志 `SSL error: unexpected eof` / `Connection reset by peer` | Railway PostgreSQL 要求 SSL 连接 | `DATABASE_URL` 末尾加 `?sslmode=require` |
| 11 | **npm workspace 命令在 Railway 不生效** | 前端构建失败 | Railway 的 RAILPACK builder 不识别 monorepo workspace 语法 | 改用 Dockerfile builder，在 Dockerfile 里执行 npm workspace 命令 |

### 关键教训

1. **Railway 不要用 Nginx**：Railway 的网络模型不适合 nginx 的 DNS 解析方式，用 Node.js HTTP 代理更可靠
2. **`PORT` 变量是全局注入的**：Railway 给每个容器自动注入 `PORT=8080`，后端必须手动覆盖回预期的端口
3. **Dockerfile 比 RAILPACK 可靠**：monorepo 项目 RAILPACK 默认配置全错，直接用 Dockerfile 完全可控
4. **环境变量要勇敢删除**：Railway 扫描出来的默认值（如 `change-me-access-secret`、`VALUE or ${{REF}}`）必须清掉或替换

## 费用

| 资源 | Railway 价格 |
|------|-------------|
| PostgreSQL | $0.01/GB-hr（最低约 $5/月） |
| Backend + Frontend | 共享 $5/月额度，通常够用 |
| **合计** | **约 $5-8/月** |

> 💡 Railway 新用户有 $5 免费额度。
