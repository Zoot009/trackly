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

# 3. Locate the installed exe (electron-builder's per-user folder name can vary).
$AppExe = Get-ChildItem (Join-Path $env:LOCALAPPDATA "Programs") -Recurse -Filter "Trackly.exe" `
  -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty FullName

# Best-effort firewall rule for WebRTC live view (ignored without admin).
if ($AppExe) {
  try {
    New-NetFirewallRule -DisplayName "Trackly Agent (In)" -Direction Inbound -Program $AppExe `
      -Action Allow -Profile Any -ErrorAction SilentlyContinue | Out-Null
  } catch { }
}

# 4. Register a per-user Scheduled Task (no admin needed) so the agent starts at
#    logon, restarts if it stops, and runs independently of any terminal. Then
#    start it. Falls back to a plain launch if the task can't be created.
$started = $false
if ($AppExe -and (Test-Path $AppExe)) {
  try {
    $action    = New-ScheduledTaskAction -Execute $AppExe
    $trigger   = New-ScheduledTaskTrigger -AtLogOn
    $principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" `
                   -LogonType Interactive -RunLevel Limited
    $settings  = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
                   -StartWhenAvailable -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) `
                   -ExecutionTimeLimit ([TimeSpan]::Zero)
    Register-ScheduledTask -TaskName "TracklyAgent" -Action $action -Trigger $trigger `
      -Principal $principal -Settings $settings -Force | Out-Null
    Start-ScheduledTask -TaskName "TracklyAgent"
    $started = $true
    Write-Host "Trackly installed. Auto-starts at logon, restarts on failure, runs in the background."
  } catch {
    Write-Warning "Could not register task ($_). Falling back to a direct launch."
  }
  if (-not $started) { Start-Process -FilePath $AppExe }
} else {
  Write-Warning "Installed, but could not locate Trackly.exe. It will start at next login."
}
