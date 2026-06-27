# Deploy the backend to the VPS (tracker.zootcloud.com)

Backend + Caddy (auto-TLS) on the VPS, Supabase for the database, dashboard on
Vercel. Caddy obtains and renews the Let's Encrypt certificate automatically.

## 1. DNS
Create an **A record**: `tracker.zootcloud.com → 213.210.36.122`. Wait until
`dig +short tracker.zootcloud.com` returns the VPS IP before continuing (ACME
needs it resolving).

## 2. VPS prerequisites
```bash
curl -fsSL https://get.docker.com | sh
ufw allow 80/tcp && ufw allow 443/tcp        # Caddy needs both for TLS
```

## 3. Get the code on the VPS
Push the repo to GitHub then `git clone …`, or from your laptop:
```bash
rsync -av --exclude node_modules --exclude .next --exclude dist \
  ./ root@213.210.36.122:/root/trackly/
```

## 4. Configure
```bash
cd /root/trackly/docker
cp .env.example .env
nano .env
```
Set:
- `TRACKLY_DOMAIN=tracker.zootcloud.com`
- `ACME_EMAIL=you@zootcloud.com`
- `PUBLIC_BASE_URL=https://tracker.zootcloud.com`
- `CORS_ORIGIN=` your dashboard URL (Vercel), e.g. `https://app.zootcloud.com` (add `,http://localhost:3000` while testing)
- `DATABASE_URL` / `DIRECT_URL` = your Supabase pooled (:6543) + direct (:5432) URLs
- `JWT_SECRET` / `AGENT_TOKEN_SECRET` = `openssl rand -hex 32` each

## 5. Launch
```bash
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml logs -f backend   # watch migrate + boot
```
The backend runs `prisma migrate deploy` on start (uses `DIRECT_URL`). Caddy
fetches the TLS cert within ~30s.

## 6. Verify
```bash
curl https://tracker.zootcloud.com/api/health
# {"data":{"status":"ok","service":"trackly-backend",...}}
```
First admin (only if not already seeded on Supabase):
```bash
docker compose -f docker-compose.prod.yml exec backend npx tsx prisma/seed.ts
```

## 7. Dashboard (Vercel)
Import the repo, **Root Directory = `dashboard`**, env:
```
NEXT_PUBLIC_API_URL=https://tracker.zootcloud.com
NEXT_PUBLIC_SOCKET_URL=https://tracker.zootcloud.com
NEXT_PUBLIC_INSTALL_BASE=https://tracker.zootcloud.com
```
Then make sure the backend `CORS_ORIGIN` includes the Vercel domain and
`docker compose ... up -d` again to apply.

## 8. Agent installers (when ready)
Build via GitHub Actions, then upload to the VPS so the install links work:
```
docker/agent-dist/
├── install.ps1   (from agent/install/)
├── install.sh    (from agent/install/)
└── downloads/Trackly-Setup.exe, Trackly.dmg, Trackly.AppImage, latest*.yml
```
Caddy serves `/install.ps1`, `/install.sh`, `/downloads/*`. The dashboard
**Deploy agent** card already points at `https://tracker.zootcloud.com`.

## Updating later
```bash
cd /root/trackly && git pull
cd docker && docker compose -f docker-compose.prod.yml up -d --build
```
