import Store from "electron-store";

/**
 * Persistent agent configuration (token, identifiers, server URL and the
 * monitoring config last pushed by the server). Stored encrypted-at-rest by
 * electron-store under the OS user profile.
 */
interface AgentConfigShape {
  serverUrl: string;
  token: string | null;
  deviceId: string | null;
  employeeId: string | null;
  employeeName: string | null;
  // The enrollment (provision) token we last registered with — lets us detect
  // a reinstall for a different employee and re-enroll instead of staying stale.
  enrolledToken: string | null;
  // Last known monitoring config from the server.
  screenshotIntervalSec: number;
  idleTimeoutSec: number;
  screenshotQuality: number;
  monitoringEnabled: boolean;
}

const store = new Store<AgentConfigShape>({
  name: "trackly-agent",
  encryptionKey: "trackly-agent-at-rest",
  defaults: {
    serverUrl: process.env.TRACKLY_SERVER_URL ?? "http://localhost:4000",
    token: null,
    deviceId: null,
    employeeId: null,
    employeeName: null,
    enrolledToken: null,
    screenshotIntervalSec: 300,
    idleTimeoutSec: 180,
    screenshotQuality: 70,
    monitoringEnabled: true,
  },
});

export const config = {
  get: <K extends keyof AgentConfigShape>(key: K): AgentConfigShape[K] => store.get(key),
  set: <K extends keyof AgentConfigShape>(key: K, value: AgentConfigShape[K]): void =>
    store.set(key, value),
  isEnrolled: (): boolean => Boolean(store.get("token") && store.get("deviceId")),
  applyServerConfig: (cfg: {
    screenshotIntervalSec: number;
    idleTimeoutSec: number;
    screenshotQuality: number;
    monitoringEnabled: boolean;
  }): void => {
    store.set("screenshotIntervalSec", cfg.screenshotIntervalSec);
    store.set("idleTimeoutSec", cfg.idleTimeoutSec);
    store.set("screenshotQuality", cfg.screenshotQuality);
    store.set("monitoringEnabled", cfg.monitoringEnabled);
  },
};

export type { AgentConfigShape };
