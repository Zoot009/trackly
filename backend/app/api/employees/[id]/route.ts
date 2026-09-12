import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { updateEmployeeSchema } from "@flowace/shared";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { fail, handler, ok } from "@/lib/http";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handler(async (req: NextRequest, ctx: Ctx) => {
  requireAdmin(req);
  const { id } = await ctx.params;
  const employee = await prisma.employee.findUnique({
    where: { id },
    include: { devices: true },
  });
  if (!employee) return fail("Employee not found", 404);
  return ok(employee);
});

export const PATCH = handler(async (req: NextRequest, ctx: Ctx) => {
  requireAdmin(req);
  const { id } = await ctx.params;
  const body = updateEmployeeSchema.parse(await req.json());
  try {
    const employee = await prisma.employee.update({ where: { id }, data: body });
    return ok(employee);
  } catch (err) {
    // email is @unique — surface the clash instead of a generic 500.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return fail("An employee with that email already exists", 409);
    }
    throw err;
  }
});

export const DELETE = handler(async (req: NextRequest, ctx: Ctx) => {
  requireAdmin(req);
  const { id } = await ctx.params;

  // Before the cascade wipes the devices, snapshot them as "ghost agents". The
  // agent stays installed and its JWT valid for a year, so it may keep phoning
  // home after removal — the Agents page surfaces those so they get uninstalled.
  const employee = await prisma.employee.findUnique({
    where: { id },
    include: { devices: true },
  });
  if (employee) {
    for (const d of employee.devices) {
      await prisma.ghostAgent
        .upsert({
          where: { deviceId: d.id },
          create: {
            deviceId: d.id,
            employeeName: employee.name,
            employeeEmail: employee.email,
            hostname: d.hostname,
            platform: d.platform,
            agentVersion: d.agentVersion,
            lastSeenAt: d.lastSeen,
          },
          update: { employeeName: employee.name, hostname: d.hostname, removedAt: new Date() },
        })
        .catch(() => {});
    }
  }

  // Hard-delete: removes the employee and cascades to their devices, activity
  // logs, usage aggregates and screenshots (see schema onDelete: Cascade).
  await prisma.employee.delete({ where: { id } });
  return ok({ success: true });
});
