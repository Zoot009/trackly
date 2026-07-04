import { prisma } from "./prisma";

/**
 * Global work-hours window. Activity outside it is not counted anywhere (list,
 * dashboard, employee detail, reports, analytics) so the numbers agree across
 * screens. A whole-day window (00:00 → 23:59) means no filtering.
 *
 * NOTE: this is a single GLOBAL window for the whole team (by admin choice), so
 * anyone working outside it shows no data. Per-employee shifts drive attendance
 * separately.
 */
export interface WorkHours {
  tz: string;
  start: string; // "HH:mm"
  end: string; // "HH:mm"
  active: boolean; // false when the window covers the whole day (no filtering)
}

const sanitizeTz = (tz: string): string => (/^[A-Za-z0-9_+\-/]+$/.test(tz) ? tz : "UTC");
const sanitizeHm = (t: string): string => (/^\d{2}:\d{2}$/.test(t) ? t : "00:00");

export async function getWorkHours(): Promise<WorkHours> {
  const s = await prisma.settings.findUnique({ where: { id: "global" } });
  const tz = sanitizeTz(s?.timezone || "UTC");
  const start = sanitizeHm(s?.workdayStart || "00:00");
  const end = sanitizeHm(s?.workdayEnd || "23:59");
  // Whole-day sentinel → don't filter.
  const active = !(start === "00:00" && (end === "23:59" || end === "00:00"));
  return { tz, start, end, active };
}

/**
 * A SQL boolean fragment that is true when the LOCAL time-of-day of `col` falls
 * within the work-hours window. Returns "TRUE" when filtering is inactive.
 * tz/start/end are sanitized above, so inlining them is injection-safe.
 */
export function workHoursClause(col: string, wh: WorkHours): string {
  if (!wh.active) return "TRUE";
  const local = `(("${col}" AT TIME ZONE 'UTC' AT TIME ZONE '${wh.tz}')::time)`;
  if (wh.start < wh.end) {
    return `(${local} >= '${wh.start}'::time AND ${local} < '${wh.end}'::time)`;
  }
  // Overnight window (end <= start): evening OR early-morning.
  return `(${local} >= '${wh.start}'::time OR ${local} < '${wh.end}'::time)`;
}
