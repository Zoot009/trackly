/** Small pure helpers shared across apps. */

export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${s}s`;
}

export function secondsToHours(totalSeconds: number): number {
  return Math.round((totalSeconds / 3600) * 100) / 100;
}

/** Activity percentage from worked vs idle time, clamped to 0-100. */
export function activityPercent(workedSeconds: number, idleSeconds: number): number {
  const total = workedSeconds + idleSeconds;
  if (total <= 0) return 0;
  return Math.round((workedSeconds / total) * 100);
}

/** Extract a bare domain from a URL. Returns null for anything that isn't a real
 * domain (e.g. window-title fragments like "portal" or "Settings"), so those
 * don't pollute website usage. */
export function extractDomain(input: string | null | undefined): string | null {
  if (!input) return null;
  try {
    const raw = input.trim();
    const url = raw.includes("://") ? raw : `https://${raw}`;
    const host = new URL(url).hostname.replace(/^www\./, "");
    // Require a dot + a letter TLD (e.g. example.com) — rejects bare words.
    if (!/\.[a-z]{2,}$/i.test(host)) return null;
    return host;
  } catch {
    return null;
  }
}

/** Build the canonical storage key for a screenshot. */
export function screenshotKey(employeeId: string, capturedAt: Date): string {
  const year = capturedAt.getUTCFullYear();
  const month = String(capturedAt.getUTCMonth() + 1).padStart(2, "0");
  const file = `${capturedAt.getTime()}.webp`;
  return `${employeeId}/${year}/${month}/${file}`;
}
