# Flowace — Enterprise Employee Monitoring

An admin-only workforce monitoring platform: a desktop agent tracks activity,
a backend ingests and stores it, and a clean black-&-white admin dashboard
surfaces it in real time.

> Employees have **no** dashboard. Only administrators access the web console.

## Monorepo layout

```
flowace/
├── agent/        # Electron desktop agent (tracking, screenshots, offline sync)
├── backend/      # Next.js API routes + Socket.IO server + uploads (VPS)
├── dashboard/    # Next.js 15 admin dashboard (shadcn/ui, Vercel)
├── shared/       # Shared TypeScript types, Zod schemas, socket contracts
├── docker/       # Dockerfile + docker-compose for the VPS stack
├── nginx/        # Reverse proxy config (TLS, WebSocket, screenshots)
└── docs/         # Architecture & deployment docs
```

## Tech stack

| Area      | Stack |
|-----------|-------|
| Agent     | Electron, TypeScript, better-sqlite3, electron-updater, active-win, sharp |
| Dashboard | Next.js 15, React 19, Tailwind, shadcn/ui, TanStack Query, Zustand, Recharts, Socket.IO client |
| Backend   | Next.js API routes, Socket.IO, Prisma, PostgreSQL, JWT, bcrypt, sharp |
| Infra     | Docker Compose, Nginx, Vercel (dashboard), VPS (backend + Postgres + storage) |

## Quick start (local)

Prerequisites: Node 20+, PostgreSQL running locally.

```bash
# 1. Install all workspaces
npm install

# 2. Build shared types (needed by all apps)
npm run build:shared

# 3. Backend
cp backend/.env.example backend/.env          # edit DATABASE_URL + secrets
npm run prisma:migrate --workspace backend
npm run seed --workspace backend              # creates admin@flowace.dev / admin12345 + demo data
npm run dev:backend                            # http://localhost:4000

# 4. Dashboard (new terminal)
cp dashboard/.env.example dashboard/.env.local
npm run dev:dashboard                          # http://localhost:3000

# 5. Agent (new terminal, optional)
npm run dev --workspace agent
```

Log in to the dashboard with **admin@flowace.dev / admin12345**.

To connect a real agent, create an employee in the dashboard, copy their
enrollment token (exposed via the API), and paste it into the agent's
enrollment window.

## Production

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md). In short:

- **Backend + Postgres + storage + Nginx** → VPS via `docker compose` in `docker/`.
- **Dashboard** → Vercel, pointing `NEXT_PUBLIC_API_URL` / `NEXT_PUBLIC_SOCKET_URL` at the VPS.
- **Agent** → packaged with `electron-builder` and auto-updated via `electron-updater`.

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
# trackly
