import { NextRequest } from "next/server";
import { deleteScreenshotsSchema } from "@flowace/shared";
import { requireAdmin } from "@/lib/auth";
import { handler, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { pruneOldScreenshots } from "@/lib/storage";

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

/** Delete one or more screenshots: the DB rows and the image files on disk. */
export const DELETE = handler(async (req: NextRequest) => {
  requireAdmin(req);
  const { ids } = deleteScreenshotsSchema.parse(await req.json());

  const shots = await prisma.screenshot.findMany({
    where: { id: { in: ids } },
    select: { id: true, storageKey: true, employeeId: true },
  });
  if (shots.length === 0) return ok({ deleted: 0 });

  // Rows first, files second: if a file removal fails, the leftover is an
  // invisible orphan on disk rather than a broken tile in the dashboard.
  await prisma.screenshot.deleteMany({ where: { id: { in: shots.map((s) => s.id) } } });
  await pruneOldScreenshots(shots.map((s) => s.storageKey)).catch((err) => {
    console.error("[screenshots] file removal failed after row delete", err);
  });

  // Each affected employee's lastScreenshotUrl may now point at a deleted file;
  // repoint it at their newest remaining screenshot (or clear it).
  for (const employeeId of new Set(shots.map((s) => s.employeeId))) {
    const latest = await prisma.screenshot.findFirst({
      where: { employeeId },
      orderBy: { capturedAt: "desc" },
      select: { thumbnailUrl: true },
    });
    await prisma.employee
      .update({ where: { id: employeeId }, data: { lastScreenshotUrl: latest?.thumbnailUrl ?? null } })
      .catch(() => {});
  }

  return ok({ deleted: shots.length });
});
