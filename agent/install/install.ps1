# Trackly agent — Windows installer (per-user).
#
# Per-user install (no admin needed) so the agent can silently auto-update
# itself forever. It installs under the user's profile and auto-starts at login
# (the app registers itself as a login item). Runs headless in the background.
#
# Usage (normal PowerShell — no admin required):
#   $env:TRACKLY_TOKEN="<enrollment-token>"; $env:TRACKLY_SERVER="https://api.yourdomain.com"; `
#     irm https://YOUR_VPS_DOMAIN/install.ps1 | iex

$ErrorActionPreference = "Stop"

$DownloadBase = "https://tracker.zootcloud.com"
$Server = if ($env:TRACKLY_SERVER) { $env:TRACKLY_SERVER } else { $DownloadBase }
$Token  = $env:TRACKLY_TOKEN

if (-not $Token) {
  Write-Error "TRACKLY_TOKEN is not set. Copy the install command from the Trackly dashboard."
  return
}

Write-Host "Installing Trackly agent..."

# 1. User-level provisioning file (no admin needed). The agent reads this to
#    enroll silently.
$ProvisionDir = Join-Path $env:USERPROFILE ".trackly"
New-Item -ItemType Directory -Force -Path $ProvisionDir | Out-Null
@{ serverUrl = $Server; enrollmentToken = $Token } |
  ConvertTo-Json | Set-Content -Path (Join-Path $ProvisionDir "provision.json") -Encoding UTF8

# 2. Download + silent per-user install (installs under %LOCALAPPDATA%\Programs).
$Installer = Join-Path $env:TEMP "Trackly-Setup.exe"
Invoke-WebRequest -Uri "$DownloadBase/downloads/Trackly-Setup.exe" -OutFile $Installer
Start-Process -FilePath $Installer -ArgumentList "/S" -Wait

# 3. Best-effort firewall rule for WebRTC live view. Silently ignored if the
#    user isn't allowed to add it (no admin) — outbound is usually allowed anyway.
$AppExe = Join-Path $env:LOCALAPPDATA "Programs\Trackly\Trackly.exe"
try {
  New-NetFirewallRule -DisplayName "Trackly Agent (In)" -Direction Inbound -Program $AppExe `
    -Action Allow -Profile Any -ErrorAction SilentlyContinue | Out-Null
} catch { }

# 4. Launch it now. The app registers itself to auto-start at every login.
if (Test-Path $AppExe) {
  Start-Process -FilePath $AppExe
  Write-Host "Trackly installed and running. It auto-starts at login and updates itself."
} else {
  Write-Warning "Installed, but could not locate Trackly.exe. It will start at next login."
}
