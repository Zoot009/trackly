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
      // macOS: getActiveWindow() only returns fresh data when the native run
      // loop is pumped. 'get' pumps it on every call. Without this, results are
      // stale/empty on mac — so app tracking AND the private-app (WhatsApp)
      // privacy blackout silently fail. No-op on Windows/Linux.
      AW.initialize(process.platform === "darwin" ? { osxRunLoop: "get" } : undefined);
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
