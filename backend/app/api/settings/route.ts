import { NextRequest } from "next/server";
import { settingsSchema } from "@flowace/shared";
import { requireAdmin } from "@/lib/auth";
import { handler, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function loadSettings() {
  return prisma.settings.upsert({
    where: { id: "global" },
    create: { id: "global" },
    update: {},
    include: { rules: true },
  });
}

export const GET = handler(async (req: NextRequest) => {
  requireAdmin(req);
  return ok(await loadSettings());
});

export const PATCH = handler(async (req: NextRequest) => {
  requireAdmin(req);
  const body = settingsSchema.partial().parse(await req.json());
  const settings = await prisma.settings.update({
    where: { id: "global" },
    data: body,
    include: { rules: true },
  });
  return ok(settings);
});
