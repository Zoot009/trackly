import { config } from "./config";
import { getActiveWindowInfo } from "./activeWindow";

/**
 * True when the current foreground window matches a configured private-app
 * pattern (case-insensitive substring against the app name AND window title, so
 * e.g. "whatsapp" also catches WhatsApp Web in a browser tab). When true,
 * screenshots are skipped and live view is blacked out.
 */
export function isScreenPrivate(): boolean {
  const list = config.get("privateApps") ?? [];
  if (!list.length) return false;
  const info = getActiveWindowInfo();
  if (!info) return false;
  const haystack = `${info.application} ${info.title}`.toLowerCase();
  return list.some((p) => {
    const pat = (p ?? "").trim().toLowerCase();
    return pat.length > 0 && haystack.includes(pat);
  });
}
