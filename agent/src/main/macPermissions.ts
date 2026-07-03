import { systemPreferences, desktopCapturer, shell } from "electron";
import { logger } from "./logger";

/**
 * macOS TCC permissions. Screenshots + window titles need **Screen Recording**;
 * the active-window lookup benefits from **Accessibility**. Neither can be
 * granted programmatically — macOS forces a user action — so we trigger the
 * system prompts and, when not yet granted, open the relevant Privacy pane so
 * the user can enable Trackly.
 *
 * IMPORTANT: after the user grants Screen Recording, macOS only honors it once
 * the app is **relaunched**. The LaunchAgent (or an auto-update relaunch) covers
 * that; during manual testing, quit and reopen the app after allowing it.
 *
 * No-op on non-darwin platforms.
 */
export async function ensureMacPermissions(): Promise<void> {
  if (process.platform !== "darwin") return;

  // Accessibility — passing `true` prompts the user / opens the Privacy pane.
  try {
    const trusted = systemPreferences.isTrustedAccessibilityClient(true);
    logger.info(`macOS Accessibility trusted: ${trusted}`);
  } catch (err) {
    logger.debug("Accessibility check failed", err);
  }

  // Screen Recording — there is no direct "ask" API. Attempting a capture makes
  // macOS register the app in the Screen Recording list and show the one-time
  // prompt; if it's still not granted we open the pane so the user can toggle it.
  try {
    const status = systemPreferences.getMediaAccessStatus("screen");
    logger.info(`macOS Screen Recording status: ${status}`);
    if (status !== "granted") {
      await desktopCapturer
        .getSources({ types: ["screen"], thumbnailSize: { width: 1, height: 1 } })
        .catch(() => {});
      await shell
        .openExternal("x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture")
        .catch(() => {});
      logger.warn(
        "Screen Recording not granted — opened System Settings. Enable Trackly there, then relaunch the app.",
      );
    }
  } catch (err) {
    logger.debug("Screen Recording check failed", err);
  }
}
