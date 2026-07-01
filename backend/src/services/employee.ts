import { Productivity, type RuleType } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { classify } from "../lib/productivity";
import { extractDomain } from "@flowace/shared";

/** Per-employee productivity breakdown for a specific day, plus a trailing
 * daily series for charts. Work totals cover the whole (local) day so late
 * arrivals and overtime are never lost; the configured workday is used only as
 * an attendance reference (arrival / departure / late / overtime). Times are
 * seconds unless noted. */

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
    workdayStart: string;
    workdayEnd: string;
    timezone: string;
    lateMinutes: number; // arrived after workdayStart
    overtimeMinutes: number; // worked past workdayEnd
  };
  topApps: { name: string; seconds: number; productivity: Productivity }[];
  topWebsites: { domain: string; seconds: number; productivity: Productivity }[];
  topWindows: { title: string; seconds: number }[];
  daily: {
    day: string;
    activeHours: number;
    idleHours: number;
    productiveHours: number;
    unproductiveHours: number;
  }[];
}

// Local wall-clock of a UTC-stored timestamp, in the configured timezone.
const LOCAL = (col: string) => `("${col}" AT TIME ZONE 'UTC' AT TIME ZONE $2)`;

function addDaysStr(dateStr: string, delta: number): string {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

const toMin = (hm: string | null): number | null => {
  if (!hm || !/^\d{1,2}:\d{2}/.test(hm)) return null;
  const [h, m] = hm.split(":");
  return Number(h) * 60 + Number(m);
};

export async function getEmployeeStats(
  employeeId: string,
  dateStr: string,
  days = 7,
): Promise<EmployeeStats> {
  const settings = await prisma.settings.findUnique({ where: { id: "global" } });
  const tz = settings?.timezone || "UTC";
  const workdayStart = settings?.workdayStart || "09:00";
  const workdayEnd = settings?.workdayEnd || "18:00";
  const rangeStartDate = addDaysStr(dateStr, -(days - 1));

  const ruleRows = await prisma.productivityRule.findMany({ where: { settingsId: "global" } });
  const rules = ruleRows.map((r) => ({ pattern: r.pattern, type: r.type, productivity: r.productivity }));

  const [dayRows, seriesRows, attendanceRows] = await Promise.all([
    // Selected-day breakdown across the whole local day.
    prisma.$queryRawUnsafe<
      { app: string; title: string; site: string; state: string; seconds: bigint }[]
    >(
      `SELECT COALESCE("appName", '') AS app,
              COALESCE("windowTitle", '') AS title,
              COALESCE("website", '') AS site,
              "state"::text AS state,
              SUM("durationSec")::bigint AS seconds
       FROM "activity_logs"
       WHERE "employeeId" = $1 AND ${LOCAL("startedAt")}::date = $3::date
       GROUP BY 1, 2, 3, 4`,
      employeeId,
      tz,
      dateStr,
    ),
    // Trailing per-day active/idle series.
    prisma.$queryRawUnsafe<{ day: string; state: string; seconds: bigint }[]>(
      `SELECT to_char(${LOCAL("startedAt")}::date, 'YYYY-MM-DD') AS day,
              "state"::text AS state,
              SUM("durationSec")::bigint AS seconds
       FROM "activity_logs"
       WHERE "employeeId" = $1
         AND ${LOCAL("startedAt")}::date >= $3::date
         AND ${LOCAL("startedAt")}::date <= $4::date
       GROUP BY 1, 2`,
      employeeId,
      tz,
      rangeStartDate,
      dateStr,
    ),
    // Arrival / departure = first / last active moment of the local day.
    prisma.$queryRawUnsafe<{ arrival: string | null; departure: string | null }[]>(
      `SELECT to_char(MIN(${LOCAL("startedAt")}), 'HH24:MI') AS arrival,
              to_char(MAX(${LOCAL("endedAt")}), 'HH24:MI') AS departure
       FROM "activity_logs"
       WHERE "employeeId" = $1 AND "state" = 'ACTIVE' AND ${LOCAL("startedAt")}::date = $3::date`,
      employeeId,
      tz,
      dateStr,
    ),
  ]);

  // Aggregate the selected day.
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

  // Attendance vs the configured shift.
  const arrival = attendanceRows[0]?.arrival ?? null;
  const departure = attendanceRows[0]?.departure ?? null;
  const arrMin = toMin(arrival);
  const depMin = toMin(departure);
  const startMin = toMin(workdayStart) ?? 0;
  const endMin = toMin(workdayEnd) ?? 24 * 60;
  const lateMinutes = arrMin !== null ? Math.max(0, arrMin - startMin) : 0;
  const overtimeMinutes = depMin !== null ? Math.max(0, depMin - endMin) : 0;

  // Trailing daily series (active vs idle hours per local day).
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
    attendance: { arrival, departure, workdayStart, workdayEnd, timezone: tz, lateMinutes, overtimeMinutes },
    topApps,
    topWebsites,
    topWindows,
    daily: Array.from(series.values()),
  };
}
