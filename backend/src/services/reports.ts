import { Productivity } from "@prisma/client";
import { ReportType, type ReportSummary, type Productivity as SharedProductivity } from "@flowace/shared";

// Prisma's Productivity enum is value-identical to the shared one but nominally
// distinct; this normalises it for the shared ReportSummary contract.
const toShared = (p: Productivity) => p as unknown as SharedProductivity;
import { prisma } from "../lib/prisma";

export function resolveRange(type: ReportType, ref = new Date()): { start: Date; end: Date } {
  const end = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), ref.getUTCDate() + 1));
  const start = new Date(end);
  if (type === ReportType.DAILY) start.setUTCDate(end.getUTCDate() - 1);
  else if (type === ReportType.WEEKLY) start.setUTCDate(end.getUTCDate() - 7);
  else start.setUTCMonth(end.getUTCMonth() - 1);
  return { start, end };
}

export async function generateReport(
  type: ReportType,
  employeeId: string | null,
  ref = new Date(),
): Promise<ReportSummary> {
  const { start, end } = resolveRange(type, ref);
  const empWhere = employeeId ? { employeeId } : {};

  const [worked, idle, appUsage, webUsage] = await Promise.all([
    prisma.activityLog.aggregate({
      where: { ...empWhere, state: "ACTIVE", startedAt: { gte: start, lt: end } },
      _sum: { durationSec: true },
    }),
    prisma.activityLog.aggregate({
      where: { ...empWhere, state: "IDLE", startedAt: { gte: start, lt: end } },
      _sum: { durationSec: true },
    }),
    prisma.applicationUsage.groupBy({
      by: ["appName", "productivity"],
      where: { ...empWhere, date: { gte: start, lt: end } },
      _sum: { totalSeconds: true },
    }),
    prisma.websiteUsage.groupBy({
      by: ["domain", "productivity"],
      where: { ...empWhere, date: { gte: start, lt: end } },
      _sum: { totalSeconds: true },
    }),
  ]);

  let productiveSeconds = 0;
  let unproductiveSeconds = 0;
  for (const row of [...appUsage, ...webUsage]) {
    const s = row._sum.totalSeconds ?? 0;
    if (row.productivity === Productivity.PRODUCTIVE) productiveSeconds += s;
    else if (row.productivity === Productivity.UNPRODUCTIVE) unproductiveSeconds += s;
  }

  const topApps = appUsage
    .map((a) => ({ name: a.appName, seconds: a._sum.totalSeconds ?? 0, productivity: toShared(a.productivity) }))
    .sort((a, b) => b.seconds - a.seconds)
    .slice(0, 10);

  const topWebsites = webUsage
    .map((w) => ({ domain: w.domain, seconds: w._sum.totalSeconds ?? 0, productivity: toShared(w.productivity) }))
    .sort((a, b) => b.seconds - a.seconds)
    .slice(0, 10);

  return {
    type,
    rangeStart: start.toISOString(),
    rangeEnd: end.toISOString(),
    employeeId,
    workedSeconds: worked._sum.durationSec ?? 0,
    idleSeconds: idle._sum.durationSec ?? 0,
    productiveSeconds,
    unproductiveSeconds,
    topApps,
    topWebsites,
  };
}
