import { EmployeeStatus, Productivity } from "@prisma/client";
import type { DashboardStats } from "@flowace/shared";
import { extractDomain } from "@flowace/shared";
import { prisma } from "../lib/prisma";
import { getRules, classifyApp, classifyDomain } from "../lib/rules";
import { getWorkHours, workHoursClause } from "../lib/workHours";

function startOfUtcDay(d = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const today = startOfUtcDay();
  const wh = await getWorkHours();

  // Worked hours + productivity from activity_logs (windowed to work hours), so
  // the dashboard agrees with the employees list + detail page.
  const [counts, rows, rules] = await Promise.all([
    prisma.employee.groupBy({ by: ["status"], _count: { _all: true }, where: { active: true } }),
    prisma.$queryRawUnsafe<{ state: string; app: string; site: string; seconds: bigint }[]>(
      `SELECT "state"::text AS state, COALESCE("appName", '') AS app,
              COALESCE("website", '') AS site, SUM("durationSec")::bigint AS seconds
       FROM "activity_logs"
       WHERE "startedAt" >= $1 AND ${workHoursClause("startedAt", wh)}
       GROUP BY 1, 2, 3`,
      today,
    ),
    getRules(),
  ]);

  const byStatus = (s: EmployeeStatus) =>
    counts.find((c) => c.status === s)?._count._all ?? 0;

  const online = byStatus(EmployeeStatus.ONLINE);
  const idle = byStatus(EmployeeStatus.IDLE);
  const offline = byStatus(EmployeeStatus.OFFLINE);
  const total = online + idle + offline;

  let activeSeconds = 0;
  const prodSeconds = { PRODUCTIVE: 0, UNPRODUCTIVE: 0, NEUTRAL: 0 };
  for (const row of rows) {
    if (row.state !== "ACTIVE") continue;
    const sec = Number(row.seconds);
    activeSeconds += sec;
    const domain = extractDomain(row.site);
    const cls = domain ? classifyDomain(domain, rules) : row.app ? classifyApp(row.app, rules) : "NEUTRAL";
    prodSeconds[cls] += sec;
  }
  const prodTotal =
    prodSeconds.PRODUCTIVE + prodSeconds.UNPRODUCTIVE + prodSeconds.NEUTRAL || 1;

  const pct = (n: number) => Math.round((n / prodTotal) * 100);

  return {
    totalEmployees: total,
    onlineEmployees: online,
    offlineEmployees: offline,
    activeEmployees: online, // ONLINE == actively working
    idleEmployees: idle,
    totalHoursToday: Math.round((activeSeconds / 3600) * 10) / 10,
    productivePercent: pct(prodSeconds[Productivity.PRODUCTIVE]),
    unproductivePercent: pct(prodSeconds[Productivity.UNPRODUCTIVE]),
    neutralPercent: pct(prodSeconds[Productivity.NEUTRAL]),
  };
}
