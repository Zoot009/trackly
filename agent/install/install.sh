#!/usr/bin/env bash
# Trackly agent — macOS / Linux installer (machine-wide / admin).
#
# Installs system-wide so a standard (non-admin) employee account can't remove
# it. Requires root — the command from the dashboard includes `sudo`. When
# pushed by an MDM (Jamf / Kandji / config-management) it runs as root with no
# prompt.
#
# Usage:
#   curl -fsSL https://YOUR_VPS_DOMAIN/install.sh | \
#     sudo TRACKLY_TOKEN="<enrollment-token>" TRACKLY_SERVER="https://api.yourdomain.com" bash

set -euo pipefail

DOWNLOAD_BASE="https://tracker.zootcloud.com"
SERVER="${TRACKLY_SERVER:-$DOWNLOAD_BASE}"
TOKEN="${TRACKLY_TOKEN:-}"

if [ -z "$TOKEN" ]; then
  echo "ERROR: TRACKLY_TOKEN is not set. Copy the install command from the Trackly dashboard." >&2
  exit 1
fi

if [ "$(id -u)" -ne 0 ]; then
  echo "ERROR: run with sudo (machine-wide install). Use the command from the dashboard — it includes sudo." >&2
  exit 1
fi

OS="$(uname -s)"
case "$OS" in
  Darwin)
    # Machine-wide provisioning (readable by every user's agent).
    mkdir -p "/Library/Application Support/Trackly"
    cat > "/Library/Application Support/Trackly/provision.json" <<EOF
{ "serverUrl": "$SERVER", "enrollmentToken": "$TOKEN" }
EOF

    # Install the app to /Applications (root-owned → user can't delete it).
    DMG="$(mktemp -d)/Trackly.dmg"
    curl -fsSL "$DOWNLOAD_BASE/downloads/Trackly.dmg" -o "$DMG"
    MOUNT="$(hdiutil attach "$DMG" -nobrowse -quiet | tail -1 | awk '{ $1=$2=""; sub(/^  */,""); print }')"
    rm -rf "/Applications/Trackly.app"
    cp -R "$MOUNT/Trackly.app" "/Applications/"
    hdiutil detach "$MOUNT" -quiet || true

    # LaunchAgent runs the app for each user at login (admin-installed → the
    # employee can't unload/remove it without admin rights).
    cat > "/Library/LaunchAgents/com.trackly.agent.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>com.trackly.agent</string>
  <key>ProgramArguments</key>
  <array><string>/Applications/Trackly.app/Contents/MacOS/Trackly</string></array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
</dict></plist>
EOF
    chown root:wheel "/Library/LaunchAgents/com.trackly.agent.plist"
    chmod 644 "/Library/LaunchAgents/com.trackly.agent.plist"
    open -a "/Applications/Trackly.app" || true
    ;;

  Linux)
    # Machine-wide provisioning + binary + autostart (all root-owned).
    mkdir -p /opt/trackly /etc/trackly /etc/xdg/autostart
    cat > /etc/trackly/provision.json <<EOF
{ "serverUrl": "$SERVER", "enrollmentToken": "$TOKEN" }
EOF
    curl -fsSL "$DOWNLOAD_BASE/downloads/Trackly.AppImage" -o /opt/trackly/Trackly.AppImage
    chmod 755 /opt/trackly/Trackly.AppImage

    # System-wide autostart (applies to all users; removable only by root).
    cat > /etc/xdg/autostart/trackly.desktop <<EOF
[Desktop Entry]
Type=Application
Name=Trackly
Exec=/opt/trackly/Trackly.AppImage
X-GNOME-Autostart-enabled=true
NoDisplay=true
EOF
    chmod 644 /etc/xdg/autostart/trackly.desktop
    nohup /opt/trackly/Trackly.AppImage >/dev/null 2>&1 &
    ;;

  *)
    echo "Unsupported OS: $OS" >&2
    exit 1
    ;;
esac

echo "Trackly installed system-wide. It starts automatically at login."
