# Railway 部署指南

## 架构

```
浏览器 → frontend.up.railway.app (Nginx :80)
              │
              ├── /              → SPA 静态文件
              ├── /api/*         → proxy → backend.railway.internal:3000
              ├── /socket.io/*   → proxy (WebSocket) → backend.railway.internal:3000
              └── /uploads/*     → proxy → backend.railway.internal:3000
                                            │
                                     ┌──────┴──────┐
                                     │ PostgreSQL  │ (Railway 插件)
                                     │ Redis       │ (Railway 插件, 可选)
                                     └─────────────┘
```

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

在项目页面右上角点 **New** → **Database**：

| 插件 | 选型 |
|------|------|
| PostgreSQL | 添加。Railway 自动注入 `DATABASE_URL` 环境变量 |
| Redis | 可选。如果不加，应用也能跑（Socket.IO 单进程），但加了更好 |

## 步骤 4：创建 Backend 服务

在项目页面点 **New** → **Service** → **Empty Service**，命名为 `backend`。

然后在 Settings 中配置：

**General**：
| 字段 | 值 |
|------|-----|
| Root Directory | `/` |
| Dockerfile Path | `Dockerfile.backend` |
| Start Command | 留空（Dockerfile 自带 entrypoint） |

**Variables（环境变量）**：
| 变量 | 值 |
|------|-----|
| `PORT` | `3000` |
| `FRONTEND_URL` | `https://你的frontend域名.up.railway.app`（稍后填） |
| `BACKEND_URL` | `https://你的frontend域名.up.railway.app` |
| `JWT_ACCESS_SECRET` | `openssl rand -hex 32` 生成一个 |
| `JWT_REFRESH_SECRET` | `openssl rand -hex 32` 再生成一个 |
| `REDIS_URL` | Railway Redis 插件会自动注入（如果有的话） |
| `UPLOAD_DIR` | `./uploads` |
| `GOOGLE_CLIENT_ID` | （可选）你的 Google OAuth Client ID |
| `GOOGLE_CLIENT_SECRET` | （可选）你的 Google OAuth Client Secret |
| `GOOGLE_CALLBACK_URL` | `https://你的frontend域名.up.railway.app/api/auth/oauth/google/callback` |

> **注意**：`DATABASE_URL` 会被 PostgreSQL 插件自动注入，不需要手动加。

**Deploy**：点 Deploy，等 2-3 分钟。数据库迁移会自动运行。

## 步骤 5：创建 Frontend 服务

同样 **New** → **Service** → **Empty Service**，命名为 `frontend`。

**General**：
| 字段 | 值 |
|------|-----|
| Root Directory | `/` |
| Dockerfile Path | `Dockerfile.frontend.railway` |
| Start Command | 留空 |

**Variables**：不需要额外变量。

**Deploy**：点 Deploy，等 1-2 分钟。

## 步骤 6：配置域名和 CORS

部署完成后，Railway 会给 frontend 服务分配一个域名，如 `taskflow-frontend.up.railway.app`。

1. 打开 frontend 服务 → **Settings** → **Domains** → 复制域名
2. 回到 backend 服务 → **Variables** → 更新：
   - `FRONTEND_URL` = `https://你的frontend域名.up.railway.app`
   - `BACKEND_URL` = `https://你的frontend域名.up.railway.app`
3. **Redeploy** backend 服务

## 步骤 7（可选）：配置 OAuth

如果你要启用 Google/GitHub 登录，去对应的开发者控制台更新回调地址：

**Google Cloud Console**：
- Authorized redirect URI → `https://你的frontend域名.up.railway.app/api/auth/oauth/google/callback`

**GitHub Developer Settings**：
- Authorization callback URL → `https://你的frontend域名.up.railway.app/api/auth/oauth/github/callback`

## 步骤 8（可选）：绑定自定义域名

Railway → frontend 服务 → Settings → Custom Domain → 添加你自己的域名。

## 验证

```bash
# 健康检查
curl https://你的域名.up.railway.app/health

# 注册
curl -X POST https://你的域名.up.railway.app/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test1234","name":"Test"}'

# 浏览器打开
open https://你的域名.up.railway.app
```

## 费用

| 资源 | Railway 价格 |
|------|-------------|
| PostgreSQL | $0.01/GB-hr（最低约 $5/月） |
| Backend + Frontend | 共享 $5/月额度，通常够用 |
| **合计** | **约 $5-8/月** |

> 💡 Railway 新用户有 $5 免费额度，够跑一个月。
