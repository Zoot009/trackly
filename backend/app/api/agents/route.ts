import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { handler, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// An agent counts as online if it has heartbeat within this window (heartbeat
// cadence is ~30s).
const ONLINE_MS = 2 * 60 * 1000;

/**
 * Every agent talking to the backend:
 *   - `agents`: live agents (device linked to an existing employee), online/offline
 *   - `ghosts`: agents whose employee was deleted but that may still be phoning
 *     home. `stillReporting` = seen since removal and within the online window —
 *     these are machines that still need the agent uninstalled.
 */
export const GET = handler(async (req: NextRequest) => {
  requireAdmin(req);
  const now = Date.now();

  const [devices, ghosts] = await Promise.all([
    prisma.device.findMany({
      include: { employee: { select: { id: true, name: true, email: true, status: true } } },
      orderBy: { lastSeen: "desc" },
    }),
    prisma.ghostAgent.findMany({ orderBy: { lastSeenAt: "desc" } }),
  ]);

  const agents = devices.map((d) => ({
    deviceId: d.id,
    employeeId: d.employeeId,
    employeeName: d.employee?.name ?? "—",
    employeeEmail: d.employee?.email ?? null,
    hostname: d.hostname,
    platform: d.platform,
    agentVersion: d.agentVersion,
    lastSeen: d.lastSeen ? d.lastSeen.toISOString() : null,
    online: d.lastSeen ? now - d.lastSeen.getTime() < ONLINE_MS : false,
  }));

  const ghostRows = ghosts.map((g) => ({
    id: g.id,
    deviceId: g.deviceId,
    employeeName: g.employeeName,
    employeeEmail: g.employeeEmail,
    hostname: g.hostname,
    platform: g.platform,
    agentVersion: g.agentVersion,
    removedAt: g.removedAt.toISOString(),
    lastSeenAt: g.lastSeenAt ? g.lastSeenAt.toISOString() : null,
    // Phoned home AFTER being removed, and recently → still active on a machine.
    stillReporting: !!g.lastSeenAt && g.lastSeenAt > g.removedAt && now - g.lastSeenAt.getTime() < ONLINE_MS,
  }));

  return ok({ agents, ghosts: ghostRows });
});
