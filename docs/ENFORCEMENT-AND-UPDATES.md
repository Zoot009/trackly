# Agent enforcement & auto-updates

> Applies to **company-owned devices with employees notified per policy**. That
> is the lawful basis for mandatory monitoring; this doc assumes it.

## Making the agent hard to remove (the lawful way)

We do **not** build anti-uninstall/persistence into the app (that's malware and
gets quarantined by antivirus). Instead, enforcement happens at the OS/management
layer, which is stronger and standard for enterprise agents.

### 1. Per-machine install (built in)
The NSIS installer is configured `perMachine: true`, so Trackly installs under
`C:\Program Files\Trackly` for all users. A **standard (non-admin) employee
account has no permission to uninstall it.** The install therefore needs admin
rights — `install.ps1` self-elevates (one UAC prompt) or runs silently when
launched by an admin / MDM.

> Note: if the employee *is* a local administrator, they can still uninstall it —
> the only real prevention is making them a standard user (best practice) or
> using MDM (below).

### 2. MDM deployment (strongest)
Push Trackly as a **required app** via your device manager. The MDM keeps it
installed and **auto-reinstalls it if it's ever removed** — no UAC prompt,
deployed as SYSTEM.

- **Microsoft Intune (Windows):** package `Trackly-Setup.exe` as a Win32 app;
  install command `Trackly-Setup.exe /S`; assign as *Required*. Set the machine
  provisioning file via a separate config (drop `provision.json` to
  `C:\ProgramData\Trackly\`) or push `TRACKLY_TOKEN`/`TRACKLY_SERVER` as system
  environment variables.
- **Jamf / Kandji (macOS):** deploy the signed `.dmg`/`.pkg` as a managed app;
  drop `provision.json` to `/Library/Application Support/Trackly/`.

The agent already reads provisioning from those machine-wide paths and from env
vars, so MDM zero-touch enrollment works out of the box.

### 3. Tamper alert (built in)
The dashboard **Agent Health** card (on the home page) lists any employee whose
enrolled agent has gone **silent/offline** — so if an agent is killed or removed,
you're alerted immediately and can have IT/MDM re-push it. Every agent
heartbeats every 30s, so detection is near-real-time.

## Auto-updates — how employees get new versions

Built on `electron-updater`. The agent is headless and never quits on its own,
so updates are **downloaded in the background and applied immediately**
(`quitAndInstall`), relaunching hidden on the new version. Employees do nothing.

### Releasing an update
1. Bump the version in `agent/package.json` (e.g. `1.0.0` → `1.0.1`).
2. Build the new installers (GitHub Actions → "Build Trackly Agent", or per-OS
   locally).
3. Upload the new artifacts **and** the generated update manifests to your
   `publish` URL (`https://<your-domain>/downloads`):
   - Windows: `Trackly-Setup-1.0.1.exe` + `latest.yml`
   - macOS: `Trackly-1.0.1.dmg` + `latest-mac.yml`
   - Linux: `Trackly-1.0.1.AppImage` + `latest-linux.yml`
4. Done. Within a few hours (agents check ~30s after boot and every 4h), every
   agent sees the new version, downloads it, and restarts on it automatically.

> The `latest*.yml` files are the update feed — electron-updater compares the
> version there against the running version. Always upload them alongside the
> installer, or clients won't detect the update.

### Requirements for updates to work
- The `publish.url` in `agent/package.json` must point at your real
  `/downloads` host (currently a placeholder).
- Installers should be **code-signed** (Windows + macOS) — unsigned auto-updates
  are blocked by the OS and flagged by antivirus.
