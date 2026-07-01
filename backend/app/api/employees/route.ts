import { NextRequest } from "next/server";
import { createEmployeeSchema } from "@flowace/shared";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { created, handler, ok } from "@/lib/http";
import { getRules, classifyApp, classifyDomain } from "@/lib/rules";

export const dynamic = "force-dynamic";

const startOfUtcDay = () => {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
};

export const GET = handler(async (req: NextRequest) => {
  requireAdmin(req);
  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search")?.trim();
  const department = searchParams.get("department")?.trim();
  const status = searchParams.get("status")?.trim();

  const employees = await prisma.employee.findMany({
    where: {
      active: true,
      ...(department ? { department } : {}),
      ...(status ? { status: status as never } : {}),
      ...(search
        ? { OR: [{ name: { contains: search, mode: "insensitive" } }, { email: { contains: search, mode: "insensitive" } }] }
        : {}),
    },
    orderBy: [{ status: "asc" }, { name: "asc" }],
    include: { _count: { select: { devices: true } } },
  });

  // Per-employee worked/idle + productive/unproductive seconds for today.
  const today = startOfUtcDay();
  const [agg, appUsage, webUsage, rules] = await Promise.all([
    prisma.activityLog.groupBy({
      by: ["employeeId", "state"],
      where: { startedAt: { gte: today } },
      _sum: { durationSec: true },
    }),
    prisma.applicationUsage.groupBy({
      by: ["employeeId", "appName"],
      where: { date: today },
      _sum: { totalSeconds: true },
    }),
    prisma.websiteUsage.groupBy({
      by: ["employeeId", "domain"],
      where: { date: today },
      _sum: { totalSeconds: true },
    }),
    getRules(),
  ]);

  // Classify each usage row live with the current rules.
  const classified = [
    ...appUsage.map((u) => ({ employeeId: u.employeeId, productivity: classifyApp(u.appName, rules), seconds: u._sum.totalSeconds ?? 0 })),
    ...webUsage.map((u) => ({ employeeId: u.employeeId, productivity: classifyDomain(u.domain, rules), seconds: u._sum.totalSeconds ?? 0 })),
  ];
  const usageFor = (employeeId: string, productivity: "PRODUCTIVE" | "UNPRODUCTIVE") =>
    classified
      .filter((u) => u.employeeId === employeeId && u.productivity === productivity)
      .reduce((sum, u) => sum + u.seconds, 0);

  const data = employees.map((e) => {
    const worked = agg.find((a) => a.employeeId === e.id && a.state === "ACTIVE")?._sum.durationSec ?? 0;
    const idle = agg.find((a) => a.employeeId === e.id && a.state === "IDLE")?._sum.durationSec ?? 0;
    return {
      ...e,
      lastSeen: e.lastSeen?.toISOString() ?? null,
      createdAt: e.createdAt.toISOString(),
      todayWorkedSeconds: worked,
      todayIdleSeconds: idle,
      todayProductiveSeconds: usageFor(e.id, "PRODUCTIVE"),
      todayUnproductiveSeconds: usageFor(e.id, "UNPRODUCTIVE"),
      enrolled: e._count.devices > 0,
    };
  });

  return ok(data);
});

export const POST = handler(async (req: NextRequest) => {
  requireAdmin(req);
  const body = createEmployeeSchema.parse(await req.json());
  const employee = await prisma.employee.create({ data: body });
  return created(employee);
});
