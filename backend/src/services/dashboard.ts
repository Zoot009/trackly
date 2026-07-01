import { EmployeeStatus, Productivity } from "@prisma/client";
import type { DashboardStats } from "@flowace/shared";
import { prisma } from "../lib/prisma";
import { getRules, classifyApp, classifyDomain } from "../lib/rules";

function startOfUtcDay(d = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const today = startOfUtcDay();

  const [counts, appUsage, webUsage, workedAgg, rules] = await Promise.all([
    prisma.employee.groupBy({ by: ["status"], _count: { _all: true }, where: { active: true } }),
    prisma.applicationUsage.groupBy({
      by: ["appName"],
      where: { date: today },
      _sum: { totalSeconds: true },
    }),
    prisma.websiteUsage.groupBy({
      by: ["domain"],
      where: { date: today },
      _sum: { totalSeconds: true },
    }),
    prisma.activityLog.aggregate({
      where: { startedAt: { gte: today }, state: "ACTIVE" },
      _sum: { durationSec: true },
    }),
    getRules(),
  ]);

  const byStatus = (s: EmployeeStatus) =>
    counts.find((c) => c.status === s)?._count._all ?? 0;

  const online = byStatus(EmployeeStatus.ONLINE);
  const idle = byStatus(EmployeeStatus.IDLE);
  const offline = byStatus(EmployeeStatus.OFFLINE);
  const total = online + idle + offline;

  const prodSeconds = { PRODUCTIVE: 0, UNPRODUCTIVE: 0, NEUTRAL: 0 };
  for (const row of appUsage) prodSeconds[classifyApp(row.appName, rules)] += row._sum.totalSeconds ?? 0;
  for (const row of webUsage) prodSeconds[classifyDomain(row.domain, rules)] += row._sum.totalSeconds ?? 0;
  const prodTotal =
    prodSeconds.PRODUCTIVE + prodSeconds.UNPRODUCTIVE + prodSeconds.NEUTRAL || 1;

  const pct = (n: number) => Math.round((n / prodTotal) * 100);

  return {
    totalEmployees: total,
    onlineEmployees: online,
    offlineEmployees: offline,
    activeEmployees: online, // ONLINE == actively working
    idleEmployees: idle,
    totalHoursToday: Math.round(((workedAgg._sum.durationSec ?? 0) / 3600) * 10) / 10,
    productivePercent: pct(prodSeconds[Productivity.PRODUCTIVE]),
    unproductivePercent: pct(prodSeconds[Productivity.UNPRODUCTIVE]),
    neutralPercent: pct(prodSeconds[Productivity.NEUTRAL]),
  };
}
