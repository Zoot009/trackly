import { NextRequest } from "next/server";
import { createEmployeeSchema, extractDomain } from "@flowace/shared";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { created, handler, ok } from "@/lib/http";
import { getRules, classifyApp, classifyDomain } from "@/lib/rules";
import { getWorkHours, workHoursClause } from "@/lib/workHours";

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

  // Per-employee worked/idle + productive/unproductive seconds for today, from
  // activity_logs so the global work-hours window applies (the daily rollup
  // tables carry no time-of-day, so they can't be windowed). Consistent with the
  // dashboard + employee-detail computation.
  const today = startOfUtcDay();
  const wh = await getWorkHours();
  const [rows, rules] = await Promise.all([
    prisma.$queryRawUnsafe<{ employeeId: string; state: string; app: string; site: string; seconds: bigint }[]>(
      `SELECT "employeeId", "state"::text AS state, COALESCE("appName", '') AS app,
              COALESCE("website", '') AS site, SUM("durationSec")::bigint AS seconds
       FROM "activity_logs"
       WHERE "startedAt" >= $1 AND ${workHoursClause("startedAt", wh)}
       GROUP BY 1, 2, 3, 4`,
      today,
    ),
    getRules(),
  ]);

  const stats = new Map<string, { worked: number; idle: number; prod: number; unprod: number }>();
  for (const r of rows) {
    const sec = Number(r.seconds);
    const s = stats.get(r.employeeId) ?? { worked: 0, idle: 0, prod: 0, unprod: 0 };
    if (r.state === "IDLE") {
      s.idle += sec;
    } else if (r.state === "ACTIVE") {
      s.worked += sec;
      const domain = extractDomain(r.site);
      const cls = domain ? classifyDomain(domain, rules) : r.app ? classifyApp(r.app, rules) : "NEUTRAL";
      if (cls === "PRODUCTIVE") s.prod += sec;
      else if (cls === "UNPRODUCTIVE") s.unprod += sec;
    }
    stats.set(r.employeeId, s);
  }

  const data = employees.map((e) => {
    const s = stats.get(e.id) ?? { worked: 0, idle: 0, prod: 0, unprod: 0 };
    return {
      ...e,
      lastSeen: e.lastSeen?.toISOString() ?? null,
      createdAt: e.createdAt.toISOString(),
      todayWorkedSeconds: s.worked,
      todayIdleSeconds: s.idle,
      todayProductiveSeconds: s.prod,
      todayUnproductiveSeconds: s.unprod,
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
