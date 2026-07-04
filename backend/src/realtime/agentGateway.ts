import type { Server as SocketServer, Socket } from "socket.io";
import type { EmployeeStatus as DbEmployeeStatus, ActivityState as DbActivityState } from "@prisma/client";
import {
  SOCKET_EVENTS,
  EmployeeStatus,
  ActivityState,
  type HeartbeatPayload,
  type LiveActivityPayload,
} from "@flowace/shared";
import { buildAgentConfig } from "../lib/agentConfig";
import type { AgentTokenPayload } from "../lib/auth";
import { prisma } from "../lib/prisma";
import { updateLiveSnapshot } from "../services/activity";
import { emitLiveActivity, emitLiveStatus, emitLiveFeed } from "../lib/realtime";

// The shared socket enums and the generated Prisma enums carry identical string
// values but are nominally distinct types. We use the shared enums everywhere
// (they back the socket contract) and cast only at the Prisma write boundary.
const asDbStatus = (s: EmployeeStatus) => s as unknown as DbEmployeeStatus;
const asDbActivity = (s: ActivityState) => s as unknown as DbActivityState;

/**
 * Wires a connected agent socket to the realtime pipeline:
 *   - pushes current config on connect
 *   - relays heartbeats + live activity to the dashboard room
 *   - marks the employee offline on disconnect
 */
export function registerAgentGateway(_io: SocketServer, socket: Socket): void {
  const agent = socket.data.agent as AgentTokenPayload;
  const { employeeId, sub: deviceId } = agent;

  // Join a per-employee room so live-view signaling can reach this machine,
  // plus a global room so settings changes can be pushed to all agents live.
  void socket.join(`agent:${employeeId}`);
  void socket.join("agents");

  void sendConfig(socket);

  // A deleted employee's agent keeps a valid JWT for a year, so it can still
  // connect. Record it as a ghost so the Agents page shows it's "removed but
  // still reporting" and can be uninstalled.
  void recordGhostIfOrphaned(employeeId, deviceId, new Date());

  socket.on(SOCKET_EVENTS.AGENT_HEARTBEAT, async (payload: HeartbeatPayload) => {
    const lastSeen = new Date();
    try {
      await prisma.device.update({ where: { id: deviceId }, data: { lastSeen } });
      await prisma.employee.update({
        where: { id: employeeId },
        data: { status: asDbStatus(payload.status), lastSeen },
      });
      emitLiveStatus({ employeeId, status: payload.status, lastSeen: lastSeen.toISOString() });
    } catch {
      // device/employee gone → ghost agent still phoning home (guarded below).
      await recordGhostIfOrphaned(employeeId, deviceId, lastSeen);
    }
  });

  socket.on(SOCKET_EVENTS.AGENT_ACTIVITY, async (payload: LiveActivityPayload) => {
    const status =
      payload.state === ActivityState.IDLE ? EmployeeStatus.IDLE : EmployeeStatus.ONLINE;
    await updateLiveSnapshot(employeeId, {
      status: asDbStatus(status),
      currentApp: payload.currentApp,
      currentWebsite: payload.currentWebsite,
      currentActivity: asDbActivity(payload.state),
      lastSeen: new Date(),
    }).catch(() => {});
    emitLiveActivity({ ...payload, employeeId, deviceId });
  });

  socket.on("disconnect", async () => {
    const lastSeen = new Date();
    await prisma.employee
      .update({
        where: { id: employeeId },
        data: { status: asDbStatus(EmployeeStatus.OFFLINE), lastSeen },
      })
      .catch(() => {});
    emitLiveStatus({ employeeId, status: EmployeeStatus.OFFLINE, lastSeen: lastSeen.toISOString() });

    const emp = await prisma.employee.findUnique({ where: { id: employeeId } }).catch(() => null);
    if (emp) {
      emitLiveFeed({
        id: `${deviceId}-${lastSeen.getTime()}`,
        employeeId,
        employeeName: emp.name,
        message: "went offline",
        timestamp: lastSeen.toISOString(),
      });
    }
  });
}

async function sendConfig(socket: Socket): Promise<void> {
  const config = await buildAgentConfig().catch(() => null);
  if (config) socket.emit(SOCKET_EVENTS.AGENT_CONFIG, config);
}

/**
 * If the connecting agent's employee no longer exists, it's a "ghost" — deleted
 * from the dashboard but still installed and reporting. Record/bump it so the
 * Agents page can flag it. Guarded by an existence check so a transient DB error
 * on a live employee never creates a spurious ghost.
 */
async function recordGhostIfOrphaned(
  employeeId: string,
  deviceId: string,
  when: Date,
): Promise<void> {
  const emp = await prisma.employee
    .findUnique({ where: { id: employeeId }, select: { id: true } })
    .catch(() => "unknown" as const);
  if (emp !== null) return; // employee exists (or we couldn't tell) → not a ghost
  await prisma.ghostAgent
    .upsert({
      where: { deviceId },
      create: {
        deviceId,
        employeeName: "(removed)",
        hostname: "(unknown)",
        platform: "(unknown)",
        lastSeenAt: when,
      },
      update: { lastSeenAt: when },
    })
    .catch(() => {});
}
