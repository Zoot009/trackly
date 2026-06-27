import { io, type Socket } from "socket.io-client";
import {
  SOCKET_EVENTS,
  EmployeeStatus,
  ActivityState,
  activityPercent,
  type AgentConfigPayload,
  type HeartbeatPayload,
  type LiveActivityPayload,
} from "@flowace/shared";
import type { CachedSample } from "./db";
import { config } from "./config";
import { logger } from "./logger";

/**
 * Maintains a resilient socket connection to the backend. Publishes heartbeats
 * and live activity; receives config pushes. Auto-reconnects with backoff
 * (handled by socket.io) — offline samples are still cached locally by the
 * tracker pipeline regardless of socket state.
 */
export class AgentSocket {
  private socket: Socket | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;

  connect(onConfig: (cfg: AgentConfigPayload) => void): void {
    const token = config.get("token");
    if (!token) return;

    this.socket = io(config.get("serverUrl"), {
      path: "/socket.io",
      transports: ["websocket"],
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 30_000,
      auth: { token, role: "agent" },
    });

    this.socket.on("connect", () => {
      logger.info("Socket connected");
      this.sendHeartbeat(EmployeeStatus.ONLINE);
    });
    this.socket.on("disconnect", (reason) => logger.warn(`Socket disconnected: ${reason}`));
    this.socket.on("connect_error", (err) => logger.debug("Socket connect_error", err.message));
    this.socket.on(SOCKET_EVENTS.AGENT_CONFIG, (cfg: AgentConfigPayload) => {
      logger.info("Received config from server");
      onConfig(cfg);
    });

    this.startHeartbeat();
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => this.sendHeartbeat(EmployeeStatus.ONLINE), 30_000);
  }

  sendHeartbeat(status: EmployeeStatus): void {
    if (!this.socket?.connected) return;
    const payload: HeartbeatPayload = {
      deviceId: config.get("deviceId") ?? "",
      employeeId: config.get("employeeId") ?? "",
      status,
      timestamp: new Date().toISOString(),
    };
    this.socket.emit(SOCKET_EVENTS.AGENT_HEARTBEAT, payload);
  }

  /** Publish a live activity sample (best-effort; ignored when offline). */
  publishActivity(sample: Omit<CachedSample, "id">): void {
    if (!this.socket?.connected) return;
    const payload: LiveActivityPayload = {
      employeeId: config.get("employeeId") ?? "",
      deviceId: config.get("deviceId") ?? "",
      state: sample.state,
      currentApp: sample.appName,
      windowTitle: sample.windowTitle,
      currentWebsite: sample.website,
      activityPercent:
        sample.state === ActivityState.ACTIVE
          ? activityPercent(15, Math.min(15, sample.idleSeconds))
          : 0,
      idleSeconds: sample.idleSeconds,
      timestamp: sample.endedAt,
    };
    this.socket.emit(SOCKET_EVENTS.AGENT_ACTIVITY, payload);
  }

  disconnect(): void {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.sendHeartbeat(EmployeeStatus.OFFLINE);
    this.socket?.disconnect();
    this.socket = null;
  }

  get connected(): boolean {
    return this.socket?.connected ?? false;
  }
}
