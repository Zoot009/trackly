import type { Server as SocketServer } from "socket.io";
import {
  SOCKET_EVENTS,
  type LiveActivityPayload,
  type LiveScreenshotPayload,
  type LiveStatusPayload,
  type LiveFeedPayload,
  type AgentConfigPayload,
} from "@flowace/shared";

/**
 * Thin wrapper around the Socket.IO server so route handlers can broadcast
 * realtime updates to the dashboard without holding a direct reference.
 * The instance is registered once from server.ts.
 */

let io: SocketServer | null = null;

export function registerIo(server: SocketServer): void {
  io = server;
}

const DASHBOARD_ROOM = "dashboard";
const AGENTS_ROOM = "agents";

/** Push fresh config to every connected agent (e.g. after settings change), so
 * changes like private apps / screenshot interval apply live without a restart. */
export function pushAgentConfig(cfg: AgentConfigPayload): void {
  io?.to(AGENTS_ROOM).emit(SOCKET_EVENTS.AGENT_CONFIG, cfg);
}

export function emitLiveActivity(payload: LiveActivityPayload): void {
  io?.to(DASHBOARD_ROOM).emit(SOCKET_EVENTS.LIVE_ACTIVITY, payload);
}

export function emitLiveStatus(payload: LiveStatusPayload): void {
  io?.to(DASHBOARD_ROOM).emit(SOCKET_EVENTS.LIVE_STATUS, payload);
}

export function emitLiveScreenshot(payload: LiveScreenshotPayload): void {
  io?.to(DASHBOARD_ROOM).emit(SOCKET_EVENTS.LIVE_SCREENSHOT, payload);
}

export function emitLiveFeed(payload: LiveFeedPayload): void {
  io?.to(DASHBOARD_ROOM).emit(SOCKET_EVENTS.LIVE_FEED, payload);
}

export { DASHBOARD_ROOM, AGENTS_ROOM };
