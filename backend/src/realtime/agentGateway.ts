import type { Server as SocketServer, Socket } from "socket.io";
import type { EmployeeStatus as DbEmployeeStatus, ActivityState as DbActivityState } from "@prisma/client";
import {
  SOCKET_EVENTS,
  EmployeeStatus,
  ActivityState,
  type HeartbeatPayload,
  type LiveActivityPayload,
  type AgentConfigPayload,
} from "@flowace/shared";
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

  // Join a per-employee room so live-view signaling can reach this machine.
  void socket.join(`agent:${employeeId}`);

  void sendConfig(socket);

  socket.on(SOCKET_EVENTS.AGENT_HEARTBEAT, async (payload: HeartbeatPayload) => {
    const lastSeen = new Date();
    await prisma.device.update({ where: { id: deviceId }, data: { lastSeen } }).catch(() => {});
    await prisma.employee
      .update({ where: { id: employeeId }, data: { status: asDbStatus(payload.status), lastSeen } })
      .catch(() => {});
    emitLiveStatus({ employeeId, status: payload.status, lastSeen: lastSeen.toISOString() });
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
  const settings = await prisma.settings.findUnique({ where: { id: "global" } }).catch(() => null);
  const config: AgentConfigPayload = {
    screenshotIntervalSec: settings?.screenshotIntervalSec ?? 300,
    idleTimeoutSec: settings?.idleTimeoutSec ?? 180,
    screenshotQuality: settings?.screenshotQuality ?? 70,
    monitoringEnabled: settings?.monitoringEnabled ?? true,
    privateApps: settings?.privateApps ?? [],
  };
  socket.emit(SOCKET_EVENTS.AGENT_CONFIG, config);
}
