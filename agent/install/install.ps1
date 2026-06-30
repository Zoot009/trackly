# Trackly agent — Windows installer (per-machine / admin).
#
# Per-machine install means a standard (non-admin) employee account cannot
# uninstall it. It therefore requires admin rights — run this in an elevated
# PowerShell, or let it self-elevate (one UAC prompt), or push it via MDM as
# SYSTEM (no prompt).
#
# Usage:
#   $env:TRACKLY_TOKEN="<enrollment-token>"; $env:TRACKLY_SERVER="https://api.yourdomain.com"; `
#     irm https://YOUR_VPS_DOMAIN/install.ps1 | iex

$ErrorActionPreference = "Stop"

# --- Configuration (edit DownloadBase to your VPS/CDN) ------------------------
$DownloadBase = "https://tracker.zootcloud.com"
$Server = if ($env:TRACKLY_SERVER) { $env:TRACKLY_SERVER } else { $DownloadBase }
$Token  = $env:TRACKLY_TOKEN

if (-not $Token) {
  Write-Error "TRACKLY_TOKEN is not set. Copy the install command from the Trackly dashboard."
  return
}

# Self-elevate if not running as administrator (preserves the token + server).
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()
  ).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
  Write-Host "Requesting administrator rights..."
  $inner = "`$env:TRACKLY_TOKEN='$Token'; `$env:TRACKLY_SERVER='$Server'; irm $DownloadBase/install.ps1 | iex"
  $encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($inner))
  Start-Process powershell -Verb RunAs -ArgumentList "-NoProfile -EncodedCommand $encoded"
  return
}

Write-Host "Installing Trackly agent (per-machine)..."

# 1. Machine-wide provisioning file (readable by every logged-in user's agent).
$ProvisionDir = Join-Path $env:ProgramData "Trackly"
New-Item -ItemType Directory -Force -Path $ProvisionDir | Out-Null
@{ serverUrl = $Server; enrollmentToken = $Token } |
  ConvertTo-Json | Set-Content -Path (Join-Path $ProvisionDir "provision.json") -Encoding UTF8

# 2. Download + silent per-machine install.
$Installer = Join-Path $env:TEMP "Trackly-Setup.exe"
Invoke-WebRequest -Uri "$DownloadBase/downloads/Trackly-Setup.exe" -OutFile $Installer
Start-Process -FilePath $Installer -ArgumentList "/S" -Wait

$AppExe = Join-Path $env:ProgramFiles "Trackly\Trackly.exe"

# 3. Register a machine-wide Scheduled Task so the agent auto-starts for EVERY
#    user at logon, restarts if it ever stops, and has no run-time limit. Being
#    admin-created, a standard employee account cannot delete or disable it.
try {
  $action    = New-ScheduledTaskAction -Execute $AppExe
  $trigger   = New-ScheduledTaskTrigger -AtLogOn
  # S-1-5-32-545 = BUILTIN\Users (locale-independent) -> runs in each user's session.
  $principal = New-ScheduledTaskPrincipal -GroupId "S-1-5-32-545" -RunLevel Limited
  $settings  = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
                 -StartWhenAvailable -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) `
                 -ExecutionTimeLimit ([TimeSpan]::Zero)
  Register-ScheduledTask -TaskName "TracklyAgent" -Action $action -Trigger $trigger `
    -Principal $principal -Settings $settings -Force | Out-Null
  Write-Host "Registered auto-start task (runs at every logon, restarts on failure)."
} catch {
  Write-Warning "Could not register scheduled task: $_"
}

# 4. Launch it now (it also auto-starts at every subsequent logon).
if (Test-Path $AppExe) {
  Start-Process -FilePath $AppExe
  Write-Host "Trackly installed and running. It auto-starts at logon and stays running."
} else {
  Write-Warning "Installed, but could not locate Trackly.exe. It will start at next login."
}
