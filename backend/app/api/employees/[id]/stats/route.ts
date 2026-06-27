import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { handler, ok } from "@/lib/http";
import { getEmployeeStats } from "@/services/employee";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handler(async (req: NextRequest, ctx: Ctx) => {
  requireAdmin(req);
  const { id } = await ctx.params;
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date") ?? new Date().toISOString().slice(0, 10);
  const days = Math.min(30, Math.max(1, Number(searchParams.get("days") ?? 7)));
  return ok(await getEmployeeStats(id, date, days));
});
