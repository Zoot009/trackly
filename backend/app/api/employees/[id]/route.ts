import { NextRequest } from "next/server";
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
  const employee = await prisma.employee.update({ where: { id }, data: body });
  return ok(employee);
});

export const DELETE = handler(async (req: NextRequest, ctx: Ctx) => {
  requireAdmin(req);
  const { id } = await ctx.params;
  // Hard-delete: removes the employee and cascades to their devices, activity
  // logs, usage aggregates and screenshots (see schema onDelete: Cascade).
  await prisma.employee.delete({ where: { id } });
  return ok({ success: true });
});
