import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { handler, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export const GET = handler(async (req: NextRequest) => {
  requireAdmin(req);
  const { searchParams } = new URL(req.url);
  const employeeId = searchParams.get("employeeId") ?? undefined;
  const date = searchParams.get("date"); // YYYY-MM-DD
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const pageSize = Math.min(100, Number(searchParams.get("pageSize") ?? 48));

  let capturedAt: { gte: Date; lt: Date } | undefined;
  if (date) {
    const start = new Date(`${date}T00:00:00.000Z`);
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    capturedAt = { gte: start, lt: end };
  }

  const where = { ...(employeeId ? { employeeId } : {}), ...(capturedAt ? { capturedAt } : {}) };

  const [rows, total] = await Promise.all([
    prisma.screenshot.findMany({
      where,
      orderBy: { capturedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { employee: { select: { name: true, department: true } } },
    }),
    prisma.screenshot.count({ where }),
  ]);

  return ok({ data: rows, total, page, pageSize });
});
