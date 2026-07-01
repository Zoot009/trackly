import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { handler, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { getRules, classifyApp, classifyDomain } from "@/lib/rules";

export const dynamic = "force-dynamic";

/** Aggregated analytics for charts: app/website usage, productivity split and
 * active vs idle hours across the trailing N days. */
export const GET = handler(async (req: NextRequest) => {
  requireAdmin(req);
  const { searchParams } = new URL(req.url);
  const days = Math.min(90, Math.max(1, Number(searchParams.get("days") ?? 7)));
  const employeeId = searchParams.get("employeeId");
  const empWhere = employeeId && employeeId !== "all" ? { employeeId } : {};

  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - days + 1));

  const [appUsage, webUsage, dailyActivity, rules] = await Promise.all([
    prisma.applicationUsage.groupBy({
      by: ["appName"],
      where: { ...empWhere, date: { gte: start } },
      _sum: { totalSeconds: true },
    }),
    prisma.websiteUsage.groupBy({
      by: ["domain"],
      where: { ...empWhere, date: { gte: start } },
      _sum: { totalSeconds: true },
    }),
    prisma.$queryRawUnsafe<{ day: string; state: string; seconds: bigint }[]>(
      `SELECT to_char(date_trunc('day', "startedAt"), 'YYYY-MM-DD') AS day,
              "state"::text AS state,
              SUM("durationSec")::bigint AS seconds
       FROM "activity_logs"
       WHERE "startedAt" >= $1 ${employeeId && employeeId !== "all" ? 'AND "employeeId" = $2' : ""}
       GROUP BY 1, 2 ORDER BY 1`,
      start,
      ...(employeeId && employeeId !== "all" ? [employeeId] : []),
    ),
    getRules(),
  ]);

  const topApps = appUsage
    .map((a) => ({ name: a.appName, seconds: a._sum.totalSeconds ?? 0, productivity: classifyApp(a.appName, rules) }))
    .sort((a, b) => b.seconds - a.seconds)
    .slice(0, 8);

  const topWebsites = webUsage
    .map((w) => ({ domain: w.domain, seconds: w._sum.totalSeconds ?? 0, productivity: classifyDomain(w.domain, rules) }))
    .sort((a, b) => b.seconds - a.seconds)
    .slice(0, 8);

  const byDay = new Map<string, { day: string; activeHours: number; idleHours: number }>();
  for (const row of dailyActivity) {
    const entry = byDay.get(row.day) ?? { day: row.day, activeHours: 0, idleHours: 0 };
    const hours = Math.round((Number(row.seconds) / 3600) * 10) / 10;
    if (row.state === "ACTIVE") entry.activeHours = hours;
    else entry.idleHours = hours;
    byDay.set(row.day, entry);
  }

  const productivity = { PRODUCTIVE: 0, UNPRODUCTIVE: 0, NEUTRAL: 0 };
  for (const a of appUsage) productivity[classifyApp(a.appName, rules)] += a._sum.totalSeconds ?? 0;
  for (const w of webUsage) productivity[classifyDomain(w.domain, rules)] += w._sum.totalSeconds ?? 0;

  return ok({
    topApps,
    topWebsites,
    activeByDay: Array.from(byDay.values()),
    productivity,
  });
});
