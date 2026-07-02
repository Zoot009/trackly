import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { handler, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { getRules, classifyApp, classifyDomain } from "@/lib/rules";

export const dynamic = "force-dynamic";

/** Distinct apps + websites actually seen (last 30 days, all employees) with
 * their CURRENT classification, so the admin can see what's Productive / Neutral
 * / Unproductive and tune the rules. */
export const GET = handler(async (req: NextRequest) => {
  requireAdmin(req);
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [appAgg, webAgg, rules] = await Promise.all([
    prisma.applicationUsage.groupBy({
      by: ["appName"],
      where: { date: { gte: since } },
      _sum: { totalSeconds: true },
    }),
    prisma.websiteUsage.groupBy({
      by: ["domain"],
      where: { date: { gte: since } },
      _sum: { totalSeconds: true },
    }),
    getRules(),
  ]);

  const apps = appAgg
    .map((a) => ({ name: a.appName, seconds: a._sum.totalSeconds ?? 0, productivity: classifyApp(a.appName, rules) }))
    .sort((a, b) => b.seconds - a.seconds)
    .slice(0, 100);
  const websites = webAgg
    .map((w) => ({ name: w.domain, seconds: w._sum.totalSeconds ?? 0, productivity: classifyDomain(w.domain, rules) }))
    .sort((a, b) => b.seconds - a.seconds)
    .slice(0, 100);

  return ok({ apps, websites });
});
