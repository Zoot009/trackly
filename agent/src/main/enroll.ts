import os from "node:os";
import path from "node:path";
import { app, BrowserWindow, ipcMain } from "electron";
import { config } from "./config";
import { registerDevice } from "./api";
import { logger } from "./logger";

/** Register this device with the backend and persist the issued token. */
export async function enrollWithToken(token: string): Promise<void> {
  const res = await registerDevice(token, {
    hostname: os.hostname(),
    platform: process.platform,
    osVersion: os.release(),
    agentVersion: app.getVersion(),
  });
  config.set("token", res.token);
  config.set("deviceId", res.deviceId);
  config.set("employeeId", res.employeeId);
  config.set("employeeName", res.employeeName);
  config.set("enrolledToken", token);
  logger.info(`Enrolled as ${res.employeeName} (${res.employeeId})`);
}

/**
 * Interactive fallback: shows the enrollment window. Only used when no
 * provisioning token is available (e.g. manual installs / development).
 */
export function runEnrollment(): Promise<void> {
  return new Promise((resolve) => {
    const win = new BrowserWindow({
      width: 460,
      height: 460,
      resizable: false,
      title: "Trackly",
      webPreferences: {
        preload: path.join(app.getAppPath(), "static", "preload.js"),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    void win.loadFile(path.join(app.getAppPath(), "static", "enroll.html"));

    ipcMain.handle("flowace:server-url", () => config.get("serverUrl"));

    ipcMain.handle("flowace:enroll", async (_evt, token: string) => {
      try {
        await enrollWithToken(token);
        ipcMain.removeHandler("flowace:enroll");
        ipcMain.removeHandler("flowace:server-url");
        win.close();
        resolve();
        return { ok: true };
      } catch (err) {
        return { ok: false, message: err instanceof Error ? err.message : "Enrollment failed" };
      }
    });

    win.on("closed", () => {
      if (!config.isEnrolled()) app.quit();
    });
  });
}
