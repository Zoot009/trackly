# Trackly Agent — build & deploy

The agent runs **headless**: no window, no tray, no dock icon. After a silent
install it auto-starts hidden at login and enrolls itself. It remains a normal,
listed, uninstallable program (we do not hide it from Task Manager / "Installed
apps") — that's the line that keeps it lawful workplace monitoring rather than
malware, and keeps antivirus from quarantining it.

## 1. Produce the installers

You don't need a Windows or Mac machine — build them in the cloud:

1. Push this repo to GitHub.
2. Go to **Actions → "Build Trackly Agent" → Run workflow** (or push a tag
   `agent-v1.0.0`). It builds on Windows, macOS and Linux runners.
3. Download the three artifacts:
   - `Trackly-Setup-<ver>.exe` (Windows)
   - `Trackly-<ver>.dmg` (macOS)
   - `Trackly-<ver>.AppImage` (Linux)

> Local build (Linux only, for testing): `npm run dist:linux --workspace agent`.

## 2. Host them on your VPS

Put the files where Nginx serves them (`docker/agent-dist/`, mounted at
`/data/agent`):

```
docker/agent-dist/
├── install.ps1                 # from agent/install/ (edit DownloadBase → your domain)
├── install.sh                  # from agent/install/ (edit DOWNLOAD_BASE → your domain)
└── downloads/
    ├── Trackly-Setup.exe        # rename the built .exe (drop the version)
    ├── Trackly.dmg
    └── Trackly.AppImage
```

Also set `NEXT_PUBLIC_INSTALL_BASE` (dashboard) and the `publish` URL in
`agent/package.json` to your domain.

## 3. Deploy to an employee

In the dashboard: open the employee → **Deploy agent** → copy their command.
They paste it once. Example (Windows PowerShell):

```powershell
$env:TRACKLY_TOKEN="<their-token>"; $env:TRACKLY_SERVER="https://api.yourdomain.com"; irm https://api.yourdomain.com/install.ps1 | iex
```

Installs silently → launches hidden → enrolls → streams to your dashboard. Done.

## Notes
- The token is per-employee and single-use (cleared after enrollment).
- Uninstalling: standard OS uninstall (Add/Remove Programs, drag-to-Trash, or
  remove the AppImage + `~/.config/autostart/trackly.desktop`).
- Auto-updates pull from the `publish` URL via electron-updater.
