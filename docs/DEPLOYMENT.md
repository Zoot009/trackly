# Deployment

## 1. Backend + Postgres + Nginx (VPS)

```bash
cd docker
cp .env.example .env          # set strong secrets + your domains
openssl rand -hex 32          # use for JWT_SECRET and AGENT_TOKEN_SECRET

# TLS certs (e.g. from certbot) go in nginx/certs/fullchain.pem + privkey.pem
docker compose up -d --build
```

`docker compose` will:
- start PostgreSQL with a persistent `pgdata` volume,
- run `prisma migrate deploy` then boot the backend on port 4000,
- serve everything through Nginx (TLS, WebSocket upgrade, `/uploads` static).

Seed the first admin (one-off):

```bash
docker compose exec backend npx tsx prisma/seed.ts
```

### Screenshot storage

Screenshots live on the `uploads` Docker volume, mounted into both the backend
(read/write) and Nginx (read-only) at `/data/uploads/screenshots`. Back this
volume up like any other data volume. Retention is enforced by the
`dataRetentionDays` setting.

## 2. Dashboard (Vercel)

Import the repo into Vercel with **Root Directory = `dashboard`**.

Environment variables:

```
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
NEXT_PUBLIC_SOCKET_URL=https://api.yourdomain.com
```

Set `CORS_ORIGIN` on the backend to the Vercel domain so REST + sockets are
allowed.

## 3. Desktop agent (Trackly)

### a. Build the installers

```bash
npm run dist:win   --workspace agent   # Trackly-Setup-<ver>.exe (Windows, NSIS)
npm run dist:mac   --workspace agent   # Trackly-<ver>.dmg (macOS)
npm run dist:linux --workspace agent   # Trackly-<ver>.AppImage + .deb (Linux)
```

### b. Host the installers + scripts on the VPS

Create `docker/agent-dist/` (bind-mounted into Nginx at `/data/agent`) with:

```
docker/agent-dist/
├── install.ps1                 # copy from agent/install/install.ps1
├── install.sh                  # copy from agent/install/install.sh
└── downloads/
    ├── Trackly-Setup.exe       # the built Windows installer (rename, drop the version)
    ├── Trackly.dmg
    └── Trackly.AppImage
```

Edit the `DOWNLOAD_BASE` / `DownloadBase` placeholder in `install.ps1` and
`install.sh` to your real domain. Nginx already serves `/install.ps1`,
`/install.sh` and `/downloads/`.

### c. Zero-touch deployment

In the dashboard open any employee → **Deploy agent** and copy the command for
their OS, e.g. Windows:

```powershell
$env:TRACKLY_TOKEN="<employee-token>"; $env:TRACKLY_SERVER="https://api.yourdomain.com"; irm https://api.yourdomain.com/install.ps1 | iex
```

The script writes a per-user provisioning file (`~/.trackly/provision.json`),
installs the agent silently, and launches it. The agent reads the token, enrolls
itself with the backend, then runs in the background (tray) and auto-starts at
login. No prompts, no manual token entry.

- The enrollment token is per-employee; the agent clears the provisioning file
  after a successful enrollment.
- Auto-updates pull from the `publish` URL in `agent/package.json`
  (`electron-updater`) — point it at `https://<your-domain>/downloads`.
- The agent is a normal installed app: it appears in the OS app list and can be
  uninstalled. (`TRACKLY_TOKEN`/`TRACKLY_SERVER` env vars also work for manual
  or MDM-pushed installs.)

## Operational notes

- **Backups**: snapshot the `pgdata` and `uploads` volumes.
- **Scaling**: the backend is stateless except for the uploads volume; to scale
  horizontally, move screenshots to object storage (S3) and use the Socket.IO
  Redis adapter.
- **Rotating secrets**: rotating `AGENT_TOKEN_SECRET` forces all agents to
  re-enroll.
