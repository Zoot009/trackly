import { Productivity, type RuleType } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { classify } from "../lib/productivity";
import { extractDomain } from "@flowace/shared";
import { getWorkHours, workHoursClause } from "../lib/workHours";

/** Per-employee productivity + attendance for one shift-day, plus a trailing
 * daily series. Activity is grouped by the employee's SHIFT (not calendar day),
 * so a night shift (e.g. 20:00→06:00) that crosses midnight counts as one day.
 * Work totals cover the whole shift-day; the shift is the attendance reference
 * (arrival / departure / late / overtime). Times are seconds unless noted. */

const toHours = (s: number) => Math.round((s / 3600) * 10) / 10;

export interface EmployeeStats {
  date: string;
  summary: {
    workedSeconds: number;
    idleSeconds: number;
    productiveSeconds: number;
    unproductiveSeconds: number;
    neutralSeconds: number;
    activityPercent: number;
  };
  attendance: {
    arrival: string | null; // local "HH:mm" of first activity
    departure: string | null; // local "HH:mm" of last activity
    shiftStart: string;
    shiftEnd: string;
    overnight: boolean;
    timezone: string;
    lateMinutes: number;
    overtimeMinutes: number;
  };
  topApps: { name: string; seconds: number; productivity: Productivity }[];
  topWebsites: { domain: string; seconds: number; productivity: Productivity }[];
  topWindows: { title: string; seconds: number }[];
  daily: { day: string; activeHours: number; idleHours: number; productiveHours: number; unproductiveHours: number }[];
}

// $2 = timezone, $3 = shiftStart ("HH:mm"). Local wall-clock, and the shift-day
// (the calendar date the shift STARTED — shifts everything back by shiftStart).
const LOCAL = (col: string) => `("${col}" AT TIME ZONE 'UTC' AT TIME ZONE $2)`;
const SHIFTDAY = (col: string) => `((${LOCAL(col)}) - $3::interval)::date`;

function addDaysStr(dateStr: string, delta: number): string {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

export async function getEmployeeStats(
  employeeId: string,
  dateStr: string,
  days = 7,
): Promise<EmployeeStats> {
  const [settings, employee, wh] = await Promise.all([
    prisma.settings.findUnique({ where: { id: "global" } }),
    prisma.employee.findUnique({ where: { id: employeeId }, select: { shiftStart: true, shiftEnd: true } }),
    getWorkHours(),
  ]);
  const tz = settings?.timezone || "UTC";
  const shiftStart = employee?.shiftStart || "09:00";
  const shiftEnd = employee?.shiftEnd || "18:00";
  const overnight = shiftEnd <= shiftStart;
  const rangeStartDate = addDaysStr(dateStr, -(days - 1));

  const ruleRows = await prisma.productivityRule.findMany({ where: { settingsId: "global" } });
  const rules = ruleRows.map((r) => ({ pattern: r.pattern, type: r.type, productivity: r.productivity }));

  const [dayRows, seriesRows, attendanceRows] = await Promise.all([
    // Selected-day breakdown over the UTC calendar day, windowed to the global
    // work hours (same filter the employees table + dashboard use, so Worked/
    // Idle match exactly).
    prisma.$queryRawUnsafe<{ app: string; title: string; site: string; state: string; seconds: bigint }[]>(
      `SELECT COALESCE("appName", '') AS app, COALESCE("windowTitle", '') AS title,
              COALESCE("website", '') AS site, "state"::text AS state, SUM("durationSec")::bigint AS seconds
       FROM "activity_logs"
       WHERE "employeeId" = $1 AND "startedAt" >= $2::date AND "startedAt" < ($2::date + interval '1 day')
             AND ${workHoursClause("startedAt", wh)}
       GROUP BY 1, 2, 3, 4`,
      employeeId,
      dateStr,
    ),
    // Trailing per-day active/idle series (UTC days).
    prisma.$queryRawUnsafe<{ day: string; state: string; seconds: bigint }[]>(
      `SELECT to_char(date_trunc('day', "startedAt"), 'YYYY-MM-DD') AS day, "state"::text AS state,
              SUM("durationSec")::bigint AS seconds
       FROM "activity_logs"
       WHERE "employeeId" = $1 AND "startedAt" >= $2::date AND "startedAt" < ($3::date + interval '1 day')
       GROUP BY 1, 2`,
      employeeId,
      rangeStartDate,
      dateStr,
    ),
    // Arrival / departure + late / overtime vs the shift (handles overnight).
    prisma.$queryRawUnsafe<
      { arrival: string | null; departure: string | null; late_seconds: bigint | null; overtime_seconds: bigint | null }[]
    >(
      `SELECT to_char(MIN(${LOCAL("startedAt")}), 'HH24:MI') AS arrival,
              to_char(MAX(${LOCAL("endedAt")}), 'HH24:MI') AS departure,
              EXTRACT(EPOCH FROM (MIN(${LOCAL("startedAt")}) - ($4::date + $3::interval)))::bigint AS late_seconds,
              EXTRACT(EPOCH FROM (MAX(${LOCAL("endedAt")}) - ($4::date + $5::interval
                + CASE WHEN $5::interval <= $3::interval THEN interval '1 day' ELSE interval '0 day' END)))::bigint AS overtime_seconds
       FROM "activity_logs"
       WHERE "employeeId" = $1 AND "state" = 'ACTIVE' AND ${SHIFTDAY("startedAt")} = $4::date`,
      employeeId,
      tz,
      shiftStart,
      dateStr,
      shiftEnd,
    ),
  ]);

  let workedSeconds = 0;
  let idleSeconds = 0;
  const appMap = new Map<string, number>();
  const siteMap = new Map<string, number>();
  const windowMap = new Map<string, number>();

  for (const row of dayRows) {
    const seconds = Number(row.seconds);
    if (row.state === "IDLE") {
      idleSeconds += seconds;
      continue;
    }
    if (row.state !== "ACTIVE") continue;
    workedSeconds += seconds;
    if (row.app) appMap.set(row.app, (appMap.get(row.app) ?? 0) + seconds);
    if (row.title) windowMap.set(row.title, (windowMap.get(row.title) ?? 0) + seconds);
    const domain = extractDomain(row.site);
    if (domain) siteMap.set(domain, (siteMap.get(domain) ?? 0) + seconds);
  }

  const prod = { PRODUCTIVE: 0, UNPRODUCTIVE: 0, NEUTRAL: 0 };
  const topApps = [...appMap.entries()]
    .map(([name, seconds]) => {
      const productivity = classify("APP" as RuleType, name, rules);
      prod[productivity] += seconds;
      return { name, seconds, productivity };
    })
    .sort((a, b) => b.seconds - a.seconds)
    .slice(0, 10);
  const topWebsites = [...siteMap.entries()]
    .map(([domain, seconds]) => {
      const productivity = classify("WEBSITE" as RuleType, domain, rules);
      prod[productivity] += seconds;
      return { domain, seconds, productivity };
    })
    .sort((a, b) => b.seconds - a.seconds)
    .slice(0, 10);
  const topWindows = [...windowMap.entries()]
    .map(([title, seconds]) => ({ title, seconds }))
    .sort((a, b) => b.seconds - a.seconds)
    .slice(0, 15);

  const totalForPercent = workedSeconds + idleSeconds;

  const att = attendanceRows[0];
  const lateMinutes = att?.late_seconds != null ? Math.max(0, Math.round(Number(att.late_seconds) / 60)) : 0;
  const overtimeMinutes =
    att?.overtime_seconds != null ? Math.max(0, Math.round(Number(att.overtime_seconds) / 60)) : 0;

  const series = new Map<string, EmployeeStats["daily"][number]>();
  for (let i = 0; i < days; i++) {
    const key = addDaysStr(rangeStartDate, i);
    series.set(key, { day: key, activeHours: 0, idleHours: 0, productiveHours: 0, unproductiveHours: 0 });
  }
  for (const row of seriesRows) {
    const entry = series.get(row.day);
    if (!entry) continue;
    if (row.state === "ACTIVE") entry.activeHours = toHours(Number(row.seconds));
    else if (row.state === "IDLE") entry.idleHours = toHours(Number(row.seconds));
  }

  return {
    date: dateStr,
    summary: {
      workedSeconds,
      idleSeconds,
      productiveSeconds: prod.PRODUCTIVE,
      unproductiveSeconds: prod.UNPRODUCTIVE,
      neutralSeconds: prod.NEUTRAL,
      activityPercent: totalForPercent > 0 ? Math.round((workedSeconds / totalForPercent) * 100) : 0,
    },
    attendance: {
      arrival: att?.arrival ?? null,
      departure: att?.departure ?? null,
      shiftStart,
      shiftEnd,
      overnight,
      timezone: tz,
      lateMinutes,
      overtimeMinutes,
    },
    topApps,
    topWebsites,
    topWindows,
    daily: Array.from(series.values()),
  };
}
