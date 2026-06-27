# Architecture

## Overview

```
┌─────────────┐   activity/screenshots (REST + WS)    ┌──────────────────┐
│  Electron   │ ───────────────────────────────────▶ │     Backend      │
│   Agent     │ ◀─── config push (WS) ─────────────── │  Next.js API +   │
│ (employee)  │                                        │   Socket.IO      │
└─────────────┘                                        └────────┬─────────┘
                                                                │ Prisma
                                            live updates (WS)   ▼
┌─────────────┐                                        ┌──────────────────┐
│  Dashboard  │ ◀───────────────────────────────────  │   PostgreSQL     │
│ (admin/web) │ ─── REST (JWT) ─────────────────────▶  │  + /uploads vol  │
└─────────────┘                                        └──────────────────┘
```

## Data flow

1. **Enrollment** — the agent posts an employee `enrollmentToken` to
   `POST /api/agent/register` and receives a long-lived agent JWT + `deviceId`.
2. **Tracking** — every 15s the agent samples the foreground window
   (`active-win`), OS idle time (`powerMonitor`), and keyboard/mouse *counts*
   (never keystrokes). Each sample is written to local SQLite first.
3. **Live + sync** — samples are published over Socket.IO for the live view and
   queued in SQLite. A sync worker drains the queue to `POST /api/agent/activity`,
   so the agent is fully functional offline and backfills on reconnect.
4. **Screenshots** — captured on a configurable interval, compressed to WebP,
   queued in SQLite, and uploaded to `POST /api/agent/screenshot`. The backend
   re-encodes + thumbnails them (sharp) and stores them on the VPS volume at
   `/uploads/screenshots/{employeeId}/{year}/{month}/`.
5. **Aggregation** — the backend rolls raw activity into per-day
   `ApplicationUsage` / `WebsiteUsage` aggregates and classifies each against
   configurable productivity rules.
6. **Dashboard** — reads aggregates via REST (TanStack Query) and subscribes to
   the Socket.IO `dashboard` room for live activity, status, screenshots and feed.

## Realtime contracts

All socket event names and payloads live in `shared/src/socket.ts` and are
imported by both the agent (publisher) and dashboard (subscriber), so the
contract can never drift.

## Auth model

- **Admins** authenticate with email/password → short-lived JWT (cookie + bearer).
- **Agents** authenticate with a device-scoped JWT issued at enrollment.
- Sockets are authenticated in `server.ts` middleware: admins join the
  `dashboard` room, agents are routed to the agent gateway.

## Why a custom server?

The backend runs `server.ts` (a custom Node HTTP server) wrapping Next.js so a
single process serves API routes, the Socket.IO hub, and static screenshots —
ideal for a single VPS container behind Nginx.

## Privacy posture

Only **counts** of keyboard/mouse events are recorded — never key contents.
Screenshot capture and all monitoring can be globally paused from Settings,
which is pushed live to every connected agent.
