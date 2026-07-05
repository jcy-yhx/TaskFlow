# TaskFlow — Team Task Management, Simplified.

A full-stack SaaS task management app built as a portfolio project. JWT authentication with OAuth2, multi-tenant workspaces, RBAC, real-time Kanban boards, comments, notifications, file uploads, and full-text search.

**Stack:** Node.js 24 · Express 5 · Prisma 6 · PostgreSQL 16 · Socket.IO 4 · React 19 · Vite 6 · Tailwind 4 · Docker

**Language:** [中文文档](README_CN.md)

---

## Architecture

```
┌─────────────┐     ┌──────────────────────────┐
│   Browser   │────▶│  Nginx (:80)             │
│  React SPA  │     │  /          → Frontend   │
└─────────────┘     │  /api/*     → Backend    │
                    │  /socket.io → Backend WS │
                    │  /uploads   → Backend    │
                    └──────────────────────────┘
                               │
                    ┌──────────┴──────────┐
                    │  Express (:3000)    │
                    │  ┌──────────────┐   │
                    │  │ Socket.IO    │   │
                    │  │ (auth+rooms) │   │
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

## Quick Start (Development)

```bash
# 1. Start databases
docker compose up -d

# 2. Install dependencies
npm install

# 3. Run database migrations
cp .env.example .env
npm run db:migrate

# 4. Start dev servers
npm run dev
# Backend:  http://localhost:3000
# Frontend: http://localhost:5173
```

## Quick Start (Production — Docker)

```bash
# 1. Configure environment
cp .env.production.example .env
# Edit .env — fill in JWT secrets, OAuth keys, and Resend API key

# 2. Start the full stack
JWT_ACCESS_SECRET=your-64-char-secret \
JWT_REFRESH_SECRET=your-64-char-secret \
POSTGRES_PASSWORD=strong-password \
  docker compose -f docker-compose.prod.yml up -d

# 3. Visit http://localhost
```

## Features

| Category | Details |
|----------|---------|
| **Auth** | Email/password registration + login, JWT dual tokens (access 15min + refresh 7d httpOnly cookie), refresh token rotation, Google & GitHub OAuth2 |
| **Workspaces** | Multi-tenant workspaces, OWNER / ADMIN / MEMBER roles, slug-based URLs |
| **Invitations** | Email invites via Resend, workspace invite codes (join code), two invite modes: email or share-a-code |
| **Projects** | Project sidebar with color labels, project CRUD |
| **Kanban Board** | Drag-and-drop (backlog → todo → in progress → in review → done), optimistic updates, position reordering |
| **Real-time** | Socket.IO rooms (workspace + project), real-time task & comment sync, online presence |
| **Tasks** | Create / edit / delete tasks, assign users, priority (low → urgent), due dates, search & filter |
| **Comments** | Threaded comments per task, inline edit, author-only edit/delete |
| **Notifications** | Auto-generated for comments and assignments, unread count badge, mark all read, polling + Socket.IO hybrid |
| **File Uploads** | Drag-and-drop file upload, task attachments (images / PDFs / documents), avatar upload, storage abstraction |
| **Search** | PostgreSQL tsvector with GIN index, weighted ranking (title:A, description:B), `<mark>` highlighting, Cmd+K command palette |
| **UI/UX** | Clean light theme, skeleton loaders, empty states, error boundary, password visibility toggle, toast notifications |

## Project Structure

```
taskflow/
├── packages/
│   ├── shared/          # @taskflow/shared — types, Zod schemas, constants
│   ├── backend/         # @taskflow/backend — Express + Prisma + Socket.IO
│   └── frontend/        # @taskflow/frontend — Vite + React + Tailwind
├── nginx/nginx.conf     # Reverse proxy (production)
├── docker-compose.yml       # PostgreSQL + Redis (dev)
├── docker-compose.prod.yml  # Full production stack
├── Dockerfile.backend       # Multi-stage Node.js build (~250MB)
├── Dockerfile.frontend      # Multi-stage React → NGINX build
├── .github/workflows/ci.yml # CI: lint → typecheck → migrate → test
└── docs/                    # Phase-by-phase learning guides (10 docs)
```

## API Overview

| Module | Base | Key Endpoints |
|--------|------|---------------|
| Auth | `/api/auth` | register, login, refresh, logout, OAuth (google / github) |
| Users | `/api/users` | /me, /me/avatar |
| Workspaces | `/api/workspaces` | CRUD, /join (by code), /:id/reset-join-code, members, invitations |
| Projects | `/api/workspaces/:wid/projects` | CRUD + task counts |
| Tasks | `/api/projects/:pid/tasks` | CRUD + /by-status + status/position update + assignees |
| Comments | `/api/tasks/:tid/comments` | CRUD |
| Attachments | `/api/tasks/:tid/attachments` | Upload, download, delete |
| Search | `/api/search` | Full-text with highlighting & ranking |
| Notifications | `/api/notifications` | List, unread-count, mark-read, mark-all-read |

All responses: `{ data, meta? }` success / `{ error: { code, message } }` error.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_ACCESS_SECRET` | Yes | JWT signing key (64 hex chars) |
| `JWT_REFRESH_SECRET` | Yes | Refresh token signing key |
| `FRONTEND_URL` | Yes | CORS origin (e.g. http://localhost:5173) |
| `RESEND_API_KEY` | No | Resend API key for invitation emails |
| `GOOGLE_CLIENT_ID` | No | Google OAuth2 app ID |
| `GOOGLE_CLIENT_SECRET` | No | Google OAuth2 secret |
| `GITHUB_CLIENT_ID` | No | GitHub OAuth app ID |
| `GITHUB_CLIENT_SECRET` | No | GitHub OAuth app secret |
| `UPLOAD_DIR` | No | File storage directory (default: ./uploads) |
| `REDIS_URL` | No | Redis connection (default: localhost:6379) |

## Testing

```bash
# All tests (28 tests)
npm test

# Backend unit + integration (22 tests)
npm -w packages/backend test

# Frontend unit (6 tests)
npm -w packages/frontend test
```

Backend: `22 tests` — sign/verify JWT, bcrypt hash/compare, register (happy path + duplicate), login (happy path + wrong password + nonexistent), task CRUD error handling, full API integration flow, auth guard rejection.

Frontend: `6 tests` — className merge (`cn`), Zustand auth store (initial state → login → logout).

## Phase-by-Phase Guide

Each phase has a dedicated learning document in [docs/](./docs/):

| Phase | Topic | Doc |
|-------|-------|-----|
| 0 | Scaffolding: monorepo, Docker, Prisma, Vite | [phase-0](./docs/phase-0-scaffolding.md) |
| 1 | Auth: JWT dual tokens, OAuth2, token rotation | [phase-1](./docs/phase-1-authentication.md) |
| 2 | Workspaces: multi-tenant, RBAC, invitations | [phase-2](./docs/phase-2-workspaces.md) |
| 3 | Kanban: drag-and-drop, position reordering, optimistic updates | [phase-3](./docs/phase-3-kanban.md) |
| 4 | Real-time: Socket.IO rooms, presence, event-driven cache | [phase-4](./docs/phase-4-realtime.md) |
| 5 | Comments + Notifications | [phase-5](./docs/phase-5-comments-notifications.md) |
| 6 | File Uploads: multer, storage abstraction | [phase-6](./docs/phase-6-file-uploads.md) |
| 7 | Search: PostgreSQL tsvector, Cmd+K palette | [phase-7](./docs/phase-7-search.md) |
| 8 | Testing + UX polish: 28 tests, skeleton, error boundary | [phase-8](./docs/phase-8-testing-ux.md) |
| 9 | Deployment: Docker multi-stage, Nginx, CI/CD | [phase-9](./docs/phase-9-deployment.md) |

## Deployment to VPS

```bash
# On your server:
git clone <repo> taskflow && cd taskflow
cp .env.production.example .env
# Edit .env with real secrets

# Build and start
docker compose -f docker-compose.prod.yml up -d --build

# Migrations run automatically via docker-entrypoint.sh
```

## Deployment to Railway

See [docs/railway-deploy.md](./docs/railway-deploy.md) for a step-by-step guide.
Zero-config: push to GitHub, add PostgreSQL plugin, deploy backend + frontend services.

## License

MIT — use this as your own portfolio template.

---

🤖 Built with [Claude Code](https://claude.com/claude-code)
