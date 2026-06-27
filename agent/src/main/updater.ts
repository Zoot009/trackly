import { app } from "electron";
import { autoUpdater } from "electron-updater";
import { logger } from "./logger";

/**
 * Silent auto-updates for the headless agent.
 *
 * Because the agent never "quits" on its own (no UI, runs forever), the usual
 * install-on-quit strategy would never fire — so when an update finishes
 * downloading we apply it immediately with quitAndInstall(), which swaps in the
 * new version and relaunches the agent hidden. Checks run shortly after boot
 * and every few hours, pulling from the `publish` URL in package.json.
 */
export function initAutoUpdater(): void {
  // Skip in dev (no packaged app / no update feed).
  if (!app.isPackaged) {
    logger.info("Auto-updater disabled in development");
    return;
  }

  autoUpdater.logger = logger;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("update-available", (info) => logger.info(`Update available: ${info.version}`));
  autoUpdater.on("error", (err) => logger.warn("Updater error", err));

  autoUpdater.on("update-downloaded", (info) => {
    logger.info(`Update ${info.version} downloaded — installing and restarting`);
    // isSilent = true, forceRunAfter = true → reinstall silently and relaunch.
    setTimeout(() => autoUpdater.quitAndInstall(true, true), 3_000);
  });

  const check = () => {
    autoUpdater.checkForUpdates().catch((err) => logger.debug("Update check failed", err));
  };

  setTimeout(check, 30_000);
  setInterval(check, 4 * 60 * 60 * 1000);
}
