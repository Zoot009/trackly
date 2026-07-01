import { EventEmitter } from "node:events";
import { powerMonitor } from "electron";
import { ActivityState, extractDomain } from "@flowace/shared";
import type { CachedSample } from "./db";
import { config } from "./config";
import { logger } from "./logger";
import { getActiveWindowInfo } from "./activeWindow";

/**
 * Samples the foreground window + input activity on a fixed cadence and emits
 * discrete activity samples. Keystrokes are NOT recorded — only counts. Idle is
 * derived from the OS idle timer so it works even when input hooks are absent.
 */
export class ActivityTracker extends EventEmitter {
  private timer: NodeJS.Timeout | null = null;
  private keyboardCount = 0;
  private mouseCount = 0;
  private lastSampleAt = new Date();
  private readonly cadenceMs = 15_000;
  private uiohook: typeof import("uiohook-napi").uIOhook | null = null;

  start(): void {
    this.attachInputHook();
    this.lastSampleAt = new Date();
    this.timer = setInterval(() => void this.sample(), this.cadenceMs);
    logger.info("ActivityTracker started");
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    try {
      this.uiohook?.stop();
    } catch {
      /* ignore */
    }
  }

  /** Best-effort global input counter. Falls back gracefully if the native
   * module is unavailable on the host. */
  private attachInputHook(): void {
    try {
      const { uIOhook } = require("uiohook-napi") as typeof import("uiohook-napi");
      this.uiohook = uIOhook;
      uIOhook.on("keydown", () => (this.keyboardCount += 1));
      uIOhook.on("mousedown", () => (this.mouseCount += 1));
      uIOhook.on("wheel", () => (this.mouseCount += 1));
      uIOhook.start();
      logger.info("Input hook attached");
    } catch (err) {
      logger.warn("Input hook unavailable; idle detection still active", err);
    }
  }

  private async sample(): Promise<void> {
    if (!config.get("monitoringEnabled")) return;

    const idleTimeoutSec = config.get("idleTimeoutSec");
    const idleSeconds = powerMonitor.getSystemIdleTime();
    const state = idleSeconds >= idleTimeoutSec ? ActivityState.IDLE : ActivityState.ACTIVE;

    let appName: string | null = null;
    let windowTitle: string | null = null;
    let website: string | null = null;

    try {
      const win = getActiveWindowInfo();
      if (win) {
        appName = win.application || null;
        windowTitle = win.title || null;
        // No URL from the native API; infer the domain from the window title.
        website = extractDomain(windowTitle);
      }
    } catch (err) {
      logger.debug("active-window sample failed", err);
    }

    const now = new Date();
    const sample: Omit<CachedSample, "id"> = {
      state,
      appName,
      windowTitle,
      website,
      keyboardCount: this.keyboardCount,
      mouseCount: this.mouseCount,
      idleSeconds: state === ActivityState.IDLE ? idleSeconds : 0,
      startedAt: this.lastSampleAt.toISOString(),
      endedAt: now.toISOString(),
    };

    // Reset window-local counters.
    this.keyboardCount = 0;
    this.mouseCount = 0;
    this.lastSampleAt = now;

    this.emit("sample", sample);
  }
}
