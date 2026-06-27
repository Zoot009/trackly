import { NextRequest } from "next/server";
import type { AgentConfigPayload } from "@flowace/shared";
import { requireAgent } from "@/lib/auth";
import { handler, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export const GET = handler(async (req: NextRequest) => {
  requireAgent(req);
  const settings = await prisma.settings.findUnique({ where: { id: "global" } });
  const config: AgentConfigPayload = {
    screenshotIntervalSec: settings?.screenshotIntervalSec ?? 300,
    idleTimeoutSec: settings?.idleTimeoutSec ?? 180,
    screenshotQuality: settings?.screenshotQuality ?? 70,
    monitoringEnabled: settings?.monitoringEnabled ?? true,
  };
  return ok(config);
});
