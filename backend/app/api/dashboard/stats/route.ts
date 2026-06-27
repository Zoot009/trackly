import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { handler, ok } from "@/lib/http";
import { getDashboardStats } from "@/services/dashboard";

export const dynamic = "force-dynamic";

export const GET = handler(async (req: NextRequest) => {
  requireAdmin(req);
  return ok(await getDashboardStats());
});
