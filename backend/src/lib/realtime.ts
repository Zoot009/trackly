import type { Server as SocketServer } from "socket.io";
import {
  SOCKET_EVENTS,
  type LiveActivityPayload,
  type LiveScreenshotPayload,
  type LiveStatusPayload,
  type LiveFeedPayload,
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

export { DASHBOARD_ROOM };
