import { Productivity } from "@prisma/client";
import { prisma } from "../lib/prisma";

/** Per-employee productivity breakdown for a specific day, plus a trailing
 * daily series for charts. All time values are seconds unless suffixed Hours. */

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

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

export async function getEmployeeStats(
  employeeId: string,
  dateStr: string,
  days = 7,
): Promise<EmployeeStats> {
  const day = startOfUtcDay(new Date(`${dateStr}T00:00:00.000Z`));
  const dayEnd = new Date(day.getTime() + 24 * 60 * 60 * 1000);
  const rangeStart = new Date(day.getTime() - (days - 1) * 24 * 60 * 60 * 1000);

  const [appAgg, webAgg, worked, idle, appByDay, webByDay, activityByDay, windowAgg] = await Promise.all([
    prisma.applicationUsage.groupBy({
      by: ["appName", "productivity"],
      where: { employeeId, date: day },
      _sum: { totalSeconds: true },
    }),
    prisma.websiteUsage.groupBy({
      by: ["domain", "productivity"],
      where: { employeeId, date: day },
      _sum: { totalSeconds: true },
    }),
    prisma.activityLog.aggregate({
      where: { employeeId, state: "ACTIVE", startedAt: { gte: day, lt: dayEnd } },
      _sum: { durationSec: true },
    }),
    prisma.activityLog.aggregate({
      where: { employeeId, state: "IDLE", startedAt: { gte: day, lt: dayEnd } },
      _sum: { durationSec: true },
    }),
    prisma.applicationUsage.groupBy({
      by: ["date", "productivity"],
      where: { employeeId, date: { gte: rangeStart, lt: dayEnd } },
      _sum: { totalSeconds: true },
    }),
    prisma.websiteUsage.groupBy({
      by: ["date", "productivity"],
      where: { employeeId, date: { gte: rangeStart, lt: dayEnd } },
      _sum: { totalSeconds: true },
    }),
    prisma.$queryRawUnsafe<{ day: string; state: string; seconds: bigint }[]>(
      `SELECT to_char(date_trunc('day', "startedAt"), 'YYYY-MM-DD') AS day,
              "state"::text AS state,
              SUM("durationSec")::bigint AS seconds
       FROM "activity_logs"
       WHERE "employeeId" = $1 AND "startedAt" >= $2 AND "startedAt" < $3
       GROUP BY 1, 2 ORDER BY 1`,
      employeeId,
      rangeStart,
      dayEnd,
    ),
    // Window / tab titles for the selected day (e.g. "YouTube - <video>").
    prisma.activityLog.groupBy({
      by: ["windowTitle"],
      where: {
        employeeId,
        state: "ACTIVE",
        startedAt: { gte: day, lt: dayEnd },
        windowTitle: { not: null },
      },
      _sum: { durationSec: true },
    }),
  ]);

  // Selected-day productivity totals.
  const prod = { PRODUCTIVE: 0, UNPRODUCTIVE: 0, NEUTRAL: 0 };
  for (const row of [...appAgg, ...webAgg]) prod[row.productivity] += row._sum.totalSeconds ?? 0;

  const workedSeconds = worked._sum.durationSec ?? 0;
  const idleSeconds = idle._sum.durationSec ?? 0;
  const totalForPercent = workedSeconds + idleSeconds;

  const topApps = appAgg
    .map((a) => ({ name: a.appName, seconds: a._sum.totalSeconds ?? 0, productivity: a.productivity }))
    .sort((a, b) => b.seconds - a.seconds)
    .slice(0, 10);
  const topWebsites = webAgg
    .map((w) => ({ domain: w.domain, seconds: w._sum.totalSeconds ?? 0, productivity: w.productivity }))
    .sort((a, b) => b.seconds - a.seconds)
    .slice(0, 10);
  const topWindows = windowAgg
    .map((w) => ({ title: w.windowTitle ?? "", seconds: w._sum.durationSec ?? 0 }))
    .filter((w) => w.title)
    .sort((a, b) => b.seconds - a.seconds)
    .slice(0, 15);

  // Build the trailing daily series (one row per day in range).
  const dayKey = (d: Date) => d.toISOString().slice(0, 10);
  const series = new Map<string, EmployeeStats["daily"][number]>();
  for (let i = 0; i < days; i++) {
    const d = new Date(rangeStart.getTime() + i * 24 * 60 * 60 * 1000);
    series.set(dayKey(d), { day: dayKey(d), activeHours: 0, idleHours: 0, productiveHours: 0, unproductiveHours: 0 });
  }
  for (const row of activityByDay) {
    const entry = series.get(row.day);
    if (!entry) continue;
    if (row.state === "ACTIVE") entry.activeHours = toHours(Number(row.seconds));
    else entry.idleHours = toHours(Number(row.seconds));
  }
  for (const row of [...appByDay, ...webByDay]) {
    const entry = series.get(dayKey(row.date));
    if (!entry) continue;
    const h = toHours(row._sum.totalSeconds ?? 0);
    if (row.productivity === Productivity.PRODUCTIVE) entry.productiveHours += h;
    else if (row.productivity === Productivity.UNPRODUCTIVE) entry.unproductiveHours += h;
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
