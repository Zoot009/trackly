import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { handler, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Purge a ghost-agent record (use once the machine is confirmed uninstalled). */
export const DELETE = handler(async (req: NextRequest, ctx: Ctx) => {
  requireAdmin(req);
  const { id } = await ctx.params;
  await prisma.ghostAgent.delete({ where: { id } }).catch(() => {});
  return ok({ success: true });
});
