import { Productivity, type RuleType } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { classify } from "../lib/productivity";
import { extractDomain } from "@flowace/shared";

/** Per-employee productivity breakdown for a specific day, plus a trailing
 * daily series for charts. Everything is derived from raw activity logs and
 * scoped to the configured workday window in the configured timezone, so
 * "worked hours" reflect the real work day. Time values are seconds. */

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
const LOCAL = `("startedAt" AT TIME ZONE 'UTC' AT TIME ZONE $2)`;

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
  const settings = await prisma.settings.findUnique({ where: { id: "global" } });
  const tz = settings?.timezone || "UTC";
  const wStart = settings?.workdayStart || "00:00";
  const wEnd = settings?.workdayEnd || "23:59";
  const rangeStartDate = addDaysStr(dateStr, -(days - 1));

  const ruleRows = await prisma.productivityRule.findMany({ where: { settingsId: "global" } });
  const rules = ruleRows.map((r) => ({ pattern: r.pattern, type: r.type, productivity: r.productivity }));

  const [dayRows, seriesRows] = await Promise.all([
    // Selected-day breakdown within the workday window.
    prisma.$queryRawUnsafe<
      { app: string; title: string; site: string; state: string; seconds: bigint }[]
    >(
      `SELECT COALESCE("appName", '') AS app,
              COALESCE("windowTitle", '') AS title,
              COALESCE("website", '') AS site,
              "state"::text AS state,
              SUM("durationSec")::bigint AS seconds
       FROM "activity_logs"
       WHERE "employeeId" = $1
         AND ${LOCAL}::date = $3::date
         AND ${LOCAL}::time >= $4::time
         AND ${LOCAL}::time <  $5::time
       GROUP BY 1, 2, 3, 4`,
      employeeId,
      tz,
      dateStr,
      wStart,
      wEnd,
    ),
    // Trailing per-day active/idle series within the workday window.
    prisma.$queryRawUnsafe<{ day: string; state: string; seconds: bigint }[]>(
      `SELECT to_char(${LOCAL}::date, 'YYYY-MM-DD') AS day,
              "state"::text AS state,
              SUM("durationSec")::bigint AS seconds
       FROM "activity_logs"
       WHERE "employeeId" = $1
         AND ${LOCAL}::date >= $3::date
         AND ${LOCAL}::date <= $4::date
         AND ${LOCAL}::time >= $5::time
         AND ${LOCAL}::time <  $6::time
       GROUP BY 1, 2`,
      employeeId,
      tz,
      rangeStartDate,
      dateStr,
      wStart,
      wEnd,
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
    topApps,
    topWebsites,
    topWindows,
    daily: Array.from(series.values()),
  };
}
