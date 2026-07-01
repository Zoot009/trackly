import type { ActivityState, EmployeeStatus } from "./enums";

/**
 * Socket.IO event contracts shared between the backend server, the desktop
 * agent (publisher) and the dashboard (subscriber).
 */

export const SOCKET_EVENTS = {
  // agent -> server
  AGENT_HEARTBEAT: "agent:heartbeat",
  AGENT_ACTIVITY: "agent:activity",
  AGENT_SCREENSHOT: "agent:screenshot",

  // server -> dashboard
  LIVE_ACTIVITY: "live:activity",
  LIVE_STATUS: "live:status",
  LIVE_SCREENSHOT: "live:screenshot",
  LIVE_FEED: "live:feed",

  // server -> agent
  AGENT_CONFIG: "agent:config",
  AGENT_COMMAND: "agent:command",
} as const;

export interface HeartbeatPayload {
  deviceId: string;
  employeeId: string;
  status: EmployeeStatus;
  timestamp: string;
}

export interface LiveActivityPayload {
  employeeId: string;
  deviceId: string;
  state: ActivityState;
  currentApp: string | null;
  windowTitle: string | null;
  currentWebsite: string | null;
  activityPercent: number;
  idleSeconds: number;
  timestamp: string;
}

export interface LiveStatusPayload {
  employeeId: string;
  status: EmployeeStatus;
  lastSeen: string;
}

export interface LiveScreenshotPayload {
  employeeId: string;
  screenshotId: string;
  url: string;
  thumbnailUrl: string;
  capturedAt: string;
}

export interface LiveFeedPayload {
  id: string;
  employeeId: string;
  employeeName: string;
  message: string;
  timestamp: string;
}

/** Configuration the server pushes to a connected agent. */
export interface AgentConfigPayload {
  screenshotIntervalSec: number;
  idleTimeoutSec: number;
  screenshotQuality: number; // 1-100 (WebP quality)
  monitoringEnabled: boolean;
  // App-name patterns to treat as private: screenshots skipped + live view
  // blacked out while one of these is the foreground window.
  privateApps: string[];
}
