import { app } from "electron";
import type { AgentConfigPayload } from "@flowace/shared";
import { logger } from "./logger";
import { config } from "./config";
import { initDb, insertSample, insertScreenshot } from "./db";
import { ActivityTracker } from "./tracker";
import { captureScreenshot } from "./screenshot";
import { AgentSocket } from "./socket";
import { SyncWorker } from "./sync";
import { runEnrollment, enrollWithToken } from "./enroll";
import { readProvision, clearProvision } from "./provision";
import { fetchConfig } from "./api";
import { initAutoUpdater } from "./updater";

// Run headless in the background — no dock icon on macOS.
if (process.platform === "darwin") app.dock?.hide();

// Single-instance lock: a second launch just exits.
if (!app.requestSingleInstanceLock()) {
  app.quit();
}

let tracker: ActivityTracker | null = null;
let socket: AgentSocket | null = null;
let sync: SyncWorker | null = null;
let screenshotTimer: NodeJS.Timeout | null = null;

/** Configure the agent to launch automatically at OS login. */
function enableAutoLaunch(): void {
  app.setLoginItemSettings({
    openAtLogin: true,
    openAsHidden: true,
    args: ["--hidden"],
  });
}

function applyConfig(cfg: AgentConfigPayload): void {
  config.applyServerConfig(cfg);
  rescheduleScreenshots();
}

function rescheduleScreenshots(): void {
  if (screenshotTimer) clearInterval(screenshotTimer);
  const intervalMs = Math.max(30, config.get("screenshotIntervalSec")) * 1000;
  screenshotTimer = setInterval(async () => {
    const shot = await captureScreenshot();
    if (shot) {
      insertScreenshot(shot.filePath, shot.capturedAt);
      void sync?.flush();
    }
  }, intervalMs);
}

async function startMonitoring(): Promise<void> {
  initDb();

  // Pull latest config (falls back to cached values when offline).
  const remoteConfig = await fetchConfig();
  if (remoteConfig) config.applyServerConfig(remoteConfig);

  socket = new AgentSocket();
  socket.connect(applyConfig);

  sync = new SyncWorker();
  sync.start();
  void sync.flush();

  tracker = new ActivityTracker();
  tracker.on("sample", (sample) => {
    insertSample(sample); // cache-first (works offline)
    socket?.publishActivity(sample); // best-effort live update
  });
  tracker.start();

  rescheduleScreenshots();

  // Headless: no tray, no window, no dock icon. The agent runs entirely in the
  // background. It remains a normal installed program (visible in the OS app
  // list / Task Manager and uninstallable) — we do not hide the process.
  initAutoUpdater();
  logger.info("Trackly agent monitoring started (headless)");
}

app.on("second-instance", () => logger.info("Second instance blocked"));

/**
 * Enroll the device. Zero-touch first: if the installer provisioned a token
 * (env var or ~/.trackly/provision.json) we enroll silently with no UI. Only
 * when no token is present do we fall back to the manual enrollment window.
 */
async function ensureEnrolled(): Promise<boolean> {
  if (config.isEnrolled()) return true;

  const provision = await readProvision();
  if (provision?.enrollmentToken) {
    if (provision.serverUrl) config.set("serverUrl", provision.serverUrl);
    try {
      await enrollWithToken(provision.enrollmentToken);
      await clearProvision();
      return true;
    } catch (err) {
      logger.warn("Silent enrollment failed; will retry on next launch", err);
      // No interactive prompt in a provisioned (silent) deployment.
      return false;
    }
  }

  // Manual fallback (development / hand installs).
  await runEnrollment();
  return config.isEnrolled();
}

app.whenReady().then(async () => {
  enableAutoLaunch();
  if (await ensureEnrolled()) {
    await startMonitoring();
  }
});

// Keep running in the background even with no windows open (do not quit).
app.on("window-all-closed", () => {
  /* intentionally empty: the agent lives in the tray */
});

app.on("before-quit", () => {
  tracker?.stop();
  sync?.stop();
  if (screenshotTimer) clearInterval(screenshotTimer);
  socket?.disconnect();
});
