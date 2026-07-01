import { Productivity } from "@prisma/client";
import { ReportType, type ReportSummary, type Productivity as SharedProductivity } from "@flowace/shared";
import { prisma } from "../lib/prisma";
import { getRules, classifyApp, classifyDomain } from "../lib/rules";

// Prisma's Productivity enum is value-identical to the shared one but nominally
// distinct; this normalises it for the shared ReportSummary contract.
const toShared = (p: Productivity) => p as unknown as SharedProductivity;

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

  const [worked, idle, appUsage, webUsage, rules] = await Promise.all([
    prisma.activityLog.aggregate({
      where: { ...empWhere, state: "ACTIVE", startedAt: { gte: start, lt: end } },
      _sum: { durationSec: true },
    }),
    prisma.activityLog.aggregate({
      where: { ...empWhere, state: "IDLE", startedAt: { gte: start, lt: end } },
      _sum: { durationSec: true },
    }),
    prisma.applicationUsage.groupBy({
      by: ["appName"],
      where: { ...empWhere, date: { gte: start, lt: end } },
      _sum: { totalSeconds: true },
    }),
    prisma.websiteUsage.groupBy({
      by: ["domain"],
      where: { ...empWhere, date: { gte: start, lt: end } },
      _sum: { totalSeconds: true },
    }),
    getRules(),
  ]);

  let productiveSeconds = 0;
  let unproductiveSeconds = 0;
  const tally = (p: Productivity, s: number) => {
    if (p === Productivity.PRODUCTIVE) productiveSeconds += s;
    else if (p === Productivity.UNPRODUCTIVE) unproductiveSeconds += s;
  };

  const topApps = appUsage
    .map((a) => {
      const seconds = a._sum.totalSeconds ?? 0;
      const productivity = classifyApp(a.appName, rules);
      tally(productivity, seconds);
      return { name: a.appName, seconds, productivity: toShared(productivity) };
    })
    .sort((a, b) => b.seconds - a.seconds)
    .slice(0, 10);

  const topWebsites = webUsage
    .map((w) => {
      const seconds = w._sum.totalSeconds ?? 0;
      const productivity = classifyDomain(w.domain, rules);
      tally(productivity, seconds);
      return { domain: w.domain, seconds, productivity: toShared(productivity) };
    })
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
