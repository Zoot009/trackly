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
    # Machine-wide provisioning + binary + autostart (all root-owned so a
    # standard employee account can't remove it).
    mkdir -p /opt/trackly /etc/trackly /etc/xdg/autostart
    cat > /etc/trackly/provision.json <<EOF
{ "serverUrl": "$SERVER", "enrollmentToken": "$TOKEN" }
EOF
    chmod 644 /etc/trackly/provision.json

    # Download the AppImage and EXTRACT it rather than running it directly:
    # Ubuntu 22.04+ (and others) ship without libfuse2, so a direct AppImage run
    # fails with "dlopen(): error loading libfuse.so.2". `--appimage-extract`
    # is handled by the AppImage runtime itself and needs no FUSE.
    TMP="$(mktemp -d)"
    curl -fsSL "$DOWNLOAD_BASE/downloads/Trackly.AppImage" -o "$TMP/Trackly.AppImage"
    chmod +x "$TMP/Trackly.AppImage"
    ( cd "$TMP" && ./Trackly.AppImage --appimage-extract >/dev/null )
    rm -rf /opt/trackly/app
    mv "$TMP/squashfs-root" /opt/trackly/app
    rm -rf "$TMP"

    # Electron's sandbox helper must be setuid root to run under a normal (non-
    # root) user account; we're root during install, so set it. Without this the
    # agent aborts with "The SUID sandbox helper binary is not configured
    # correctly". Then make the app world-readable/executable for every user.
    if [ -f /opt/trackly/app/chrome-sandbox ]; then
      chown root:root /opt/trackly/app/chrome-sandbox
      chmod 4755 /opt/trackly/app/chrome-sandbox
    fi
    chmod -R a+rX /opt/trackly/app

    # System-wide autostart (applies to all users; removable only by root). Force
    # the X11 backend — screen capture / active-window / idle all use X11.
    cat > /etc/xdg/autostart/trackly.desktop <<EOF
[Desktop Entry]
Type=Application
Name=Trackly
Exec=env APPDIR=/opt/trackly/app ELECTRON_OZONE_PLATFORM_HINT=x11 /opt/trackly/app/AppRun
X-GNOME-Autostart-enabled=true
NoDisplay=true
EOF
    chmod 644 /etc/xdg/autostart/trackly.desktop

    # Stop any already-running instance so a re-run (the Linux update path)
    # swaps in the freshly-extracted build instead of losing the single-instance
    # lock race to the old one.
    pkill -f "/opt/trackly/app/" 2>/dev/null || true

    # Launch now for the invoking desktop user (best-effort, detached) so
    # monitoring starts immediately instead of waiting for the next login.
    if [ -n "${SUDO_USER:-}" ] && [ "$SUDO_USER" != "root" ]; then
      UID_N="$(id -u "$SUDO_USER")"
      nohup sudo -u "$SUDO_USER" \
        DISPLAY="${DISPLAY:-:0}" \
        XDG_RUNTIME_DIR="/run/user/$UID_N" \
        APPDIR=/opt/trackly/app \
        ELECTRON_OZONE_PLATFORM_HINT=x11 \
        /opt/trackly/app/AppRun >/dev/null 2>&1 &
    fi
    ;;

  *)
    echo "Unsupported OS: $OS" >&2
    exit 1
    ;;
esac

echo "Trackly installed system-wide. It starts automatically at login."
