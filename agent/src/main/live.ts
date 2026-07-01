import path from "node:path";
import { app, BrowserWindow, desktopCapturer, ipcMain, session } from "electron";
import { logger } from "./logger";

/**
 * WebRTC live screen share. The agent is headless, so WebRTC (a renderer API)
 * runs in a hidden BrowserWindow created on demand for a live session. The main
 * process relays SDP/ICE between that window and the backend socket.
 */

type Emit = (event: string, data: unknown) => void;

let win: BrowserWindow | null = null;
let displayHandlerSet = false;

function ensureDisplayHandler(): void {
  if (displayHandlerSet) return;
  // Auto-grant the primary screen when the renderer calls getDisplayMedia().
  session.defaultSession.setDisplayMediaRequestHandler((_req, callback) => {
    desktopCapturer
      .getSources({ types: ["screen"] })
      .then((sources) => callback(sources[0] ? { video: sources[0] } : {}))
      .catch(() => callback({}));
  });
  displayHandlerSet = true;
}

export function startLive(sessionId: string, iceServers: unknown, emit: Emit): void {
  stopLive();
  ensureDisplayHandler();

  ipcMain.removeAllListeners("live:offer");
  ipcMain.removeAllListeners("live:ice");
  ipcMain.removeAllListeners("live:error");
  ipcMain.on("live:offer", (_e, sdp) => emit("live:offer", { sessionId, sdp }));
  ipcMain.on("live:ice", (_e, candidate) => emit("live:ice", { sessionId, candidate }));
  ipcMain.on("live:error", (_e, msg) => logger.warn("live renderer error", msg));

  win = new BrowserWindow({
    show: false,
    webPreferences: { nodeIntegration: true, contextIsolation: false },
  });
  win.on("closed", () => {
    win = null;
  });
  void win.loadFile(path.join(app.getAppPath(), "static", "live.html"));
  win.webContents.on("did-finish-load", () => win?.webContents.send("live:init", { iceServers }));
  logger.info("Live session started");
}

export function onAnswer(sdp: unknown): void {
  win?.webContents.send("live:answer", sdp);
}

export function onRemoteIce(candidate: unknown): void {
  win?.webContents.send("live:ice", candidate);
}

export function stopLive(): void {
  if (!win) return;
  try {
    win.webContents.send("live:stop");
    win.destroy();
  } catch {
    /* ignore */
  }
  win = null;
  logger.info("Live session stopped");
}
