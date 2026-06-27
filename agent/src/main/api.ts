import { promises as fs } from "node:fs";
import type {
  ActivityBatchInput,
  AgentConfigPayload,
  RegisterDeviceInput,
} from "@flowace/shared";
import { config } from "./config";
import { logger } from "./logger";

function authHeaders(): Record<string, string> {
  const token = config.get("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export interface RegisterResponse {
  token: string;
  deviceId: string;
  employeeId: string;
  employeeName: string;
}

/** Enroll this device using the employee's enrollment token. */
export async function registerDevice(
  enrollmentToken: string,
  meta: Omit<RegisterDeviceInput, "enrollmentToken">,
): Promise<RegisterResponse> {
  const res = await fetch(`${config.get("serverUrl")}/api/agent/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ enrollmentToken, ...meta }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error?.message ?? `Registration failed (${res.status})`);
  }
  return (await res.json()).data as RegisterResponse;
}

/** Upload a batch of activity samples. Returns true on success. */
export async function uploadActivity(batch: ActivityBatchInput): Promise<boolean> {
  try {
    const res = await fetch(`${config.get("serverUrl")}/api/agent/activity`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(batch),
    });
    return res.ok;
  } catch (err) {
    logger.warn("uploadActivity failed", err);
    return false;
  }
}

/** Upload a screenshot file (multipart). Returns true on success. */
export async function uploadScreenshot(filePath: string, capturedAt: string): Promise<boolean> {
  try {
    const buffer = await fs.readFile(filePath);
    const form = new FormData();
    form.append("file", new Blob([buffer], { type: "image/webp" }), "screenshot.webp");
    form.append("capturedAt", capturedAt);

    const res = await fetch(`${config.get("serverUrl")}/api/agent/screenshot`, {
      method: "POST",
      headers: { ...authHeaders() },
      body: form,
    });
    return res.ok;
  } catch (err) {
    logger.warn("uploadScreenshot failed", err);
    return false;
  }
}

/** Pull the latest monitoring config. */
export async function fetchConfig(): Promise<AgentConfigPayload | null> {
  try {
    const res = await fetch(`${config.get("serverUrl")}/api/agent/config`, { headers: authHeaders() });
    if (!res.ok) return null;
    return (await res.json()).data as AgentConfigPayload;
  } catch {
    return null;
  }
}
