import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { fail, handler, ok } from "@/lib/http";

export const dynamic = "force-dynamic";

export const GET = handler(async (req: NextRequest) => {
  const session = requireAdmin(req);
  const admin = await prisma.admin.findUnique({
    where: { id: session.sub },
    select: { id: true, email: true, name: true, role: true, createdAt: true },
  });
  if (!admin) return fail("Account not found", 404);
  return ok(admin);
});
