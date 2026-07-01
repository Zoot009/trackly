import crypto from "node:crypto";
import { env } from "./env";

export interface IceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

/**
 * Build ICE servers for a WebRTC live-view session. Uses coturn's REST-style
 * ephemeral credentials (use-auth-secret): username is an expiry timestamp and
 * the credential is HMAC-SHA1(secret, username), base64-encoded. Falls back to
 * STUN-only when no TURN secret is configured.
 */
export function buildIceServers(ttlSec = 3600): IceServer[] {
  const { turnHost, turnPort, turnSecret } = env;
  const stun: IceServer = { urls: `stun:${turnHost}:${turnPort}` };
  if (!turnSecret) return [stun];

  const username = `${Math.floor(Date.now() / 1000) + ttlSec}:trackly`;
  const credential = crypto.createHmac("sha1", turnSecret).update(username).digest("base64");
  return [
    stun,
    { urls: `turn:${turnHost}:${turnPort}?transport=udp`, username, credential },
    { urls: `turn:${turnHost}:${turnPort}?transport=tcp`, username, credential },
  ];
}
