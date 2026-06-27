import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import { logger } from "./logger";

/**
 * Zero-touch provisioning. The one-line installer drops a small JSON file
 * (or sets env vars) containing the backend URL and a per-employee enrollment
 * token, so the agent can enroll itself silently with no user interaction.
 *
 * Provision file (user-level, no admin needed): ~/.trackly/provision.json
 *   { "serverUrl": "https://api.example.com", "enrollmentToken": "..." }
 */
export interface Provision {
  serverUrl?: string;
  enrollmentToken?: string;
}

/**
 * Candidate provision locations, in priority order. Machine-wide paths come
 * first so an admin / MDM (per-machine install) can drop the file where any
 * logged-in user's agent will find it; the user-level path is the fallback for
 * per-user (self-service) installs.
 */
export function provisionPaths(): string[] {
  const userLevel = path.join(os.homedir(), ".trackly", "provision.json");
  if (process.platform === "win32") {
    const programData = process.env.PROGRAMDATA ?? "C:\\ProgramData";
    return [path.join(programData, "Trackly", "provision.json"), userLevel];
  }
  if (process.platform === "darwin") {
    return ["/Library/Application Support/Trackly/provision.json", userLevel];
  }
  return ["/etc/trackly/provision.json", userLevel];
}

/** Read provisioning data: env vars take precedence, then the machine-wide /
 * user-level files. */
export async function readProvision(): Promise<Provision | null> {
  const envToken = process.env.TRACKLY_TOKEN;
  const envServer = process.env.TRACKLY_SERVER ?? process.env.TRACKLY_SERVER_URL;
  if (envToken) {
    return { enrollmentToken: envToken, serverUrl: envServer };
  }

  for (const p of provisionPaths()) {
    try {
      const parsed = JSON.parse(await fs.readFile(p, "utf8")) as Provision;
      if (parsed.enrollmentToken) return parsed;
    } catch {
      /* try next location */
    }
  }
  return null;
}

/** Remove the provision file(s) once enrollment succeeds (token is single-use). */
export async function clearProvision(): Promise<void> {
  for (const p of provisionPaths()) {
    await fs.rm(p, { force: true }).catch((err) => logger.debug(`Failed to clear ${p}`, err));
  }
}
