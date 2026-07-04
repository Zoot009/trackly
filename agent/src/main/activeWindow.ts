import { logger } from "./logger";

/**
 * Foreground-window lookup via @paymoapp/active-window (prebuilt N-API addon).
 * Loaded lazily and tolerant of failure. Shared by the activity tracker and the
 * privacy check.
 */
export interface WindowInfo {
  title: string;
  application: string;
}

let mod: { getActiveWindow(): WindowInfo } | null = null;
let tried = false;

export function getActiveWindowInfo(): WindowInfo | null {
  if (!tried) {
    tried = true;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const m = require("@paymoapp/active-window");
      const AW = m.default ?? m.ActiveWindow ?? m;
      AW.initialize();
      // macOS: window TITLES are gated behind Screen Recording access inside the
      // native lib — getWindowTitle() returns "" until requestPermissions() has
      // set its internal hasScreenCaptureAccess flag (via CGPreflightScreenCapture
      // Access). Without this call titles are always null, so title-based privacy
      // matches (e.g. WhatsApp Web in a browser tab) never fire. Titles come from
      // CGWindowListCopyWindowInfo (a direct query) — NO run loop pumping, so this
      // does not disturb the screen-capture pipeline the way osxRunLoop did.
      if (process.platform === "darwin") {
        try {
          AW.requestPermissions?.();
        } catch {
          /* best-effort permission registration */
        }
      }
      mod = AW;
    } catch (err) {
      logger.warn("active-window unavailable; app/window name will be omitted", err);
      mod = null;
    }
  }
  try {
    return mod ? mod.getActiveWindow() : null;
  } catch {
    return null;
  }
}
