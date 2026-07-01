import type { AgentConfigPayload } from "@flowace/shared";
import { prisma } from "./prisma";

/** Build the config payload the agents apply (screenshot cadence, idle timeout,
 * quality, monitoring toggle, private apps). Single source used by the socket
 * push, the HTTP config route, and the on-connect send. */
export async function buildAgentConfig(): Promise<AgentConfigPayload> {
  const s = await prisma.settings.findUnique({ where: { id: "global" } });
  return {
    screenshotIntervalSec: s?.screenshotIntervalSec ?? 300,
    idleTimeoutSec: s?.idleTimeoutSec ?? 180,
    screenshotQuality: s?.screenshotQuality ?? 70,
    monitoringEnabled: s?.monitoringEnabled ?? true,
    privateApps: s?.privateApps ?? [],
  };
}
