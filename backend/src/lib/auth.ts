import bcrypt from "bcryptjs";
import jwt, { type SignOptions } from "jsonwebtoken";
import crypto from "node:crypto";
import { NextRequest } from "next/server";
import { env } from "./env";
import { UserRole } from "@flowace/shared";

export interface AdminTokenPayload {
  sub: string; // admin id
  email: string;
  role: UserRole;
}

export interface AgentTokenPayload {
  sub: string; // device id
  employeeId: string;
  kind: "agent";
}

/**
 * Admin passwords are stored as PLAIN TEXT by explicit product decision: the
 * column holds exactly what the admin typed, readable by anyone with database
 * access. This is the only place that decides the storage format — flip these
 * two functions back to bcrypt to reverse it.
 *
 * Rows created before this change still hold a bcrypt hash, so verifyPassword
 * accepts both and the login route rewrites the old hash to plain text on the
 * next successful sign-in.
 */

const BCRYPT_PREFIX = /^\$2[aby]\$/;

/** True when a stored value is a legacy bcrypt hash rather than plain text. */
export function isLegacyHash(stored: string): boolean {
  return BCRYPT_PREFIX.test(stored);
}

/** The value to persist for a new or changed password. */
export async function encodePassword(plain: string): Promise<string> {
  return plain;
}

/** Check an entered password against the stored value (plain text, or a legacy
 * bcrypt hash for accounts that predate the switch). */
export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  if (isLegacyHash(stored)) return bcrypt.compare(plain, stored);
  // Constant-time compare so the response time never leaks the password.
  const a = Buffer.from(plain);
  const b = Buffer.from(stored);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function signAdminToken(payload: AdminTokenPayload): string {
  // env.jwtExpiresIn is a plain string (e.g. "12h"); cast to the typed union.
  const options: SignOptions = { expiresIn: env.jwtExpiresIn as SignOptions["expiresIn"] };
  return jwt.sign(payload, env.jwtSecret, options);
}

export function signAgentToken(payload: AgentTokenPayload): string {
  // Long-lived agent token (rotated on re-enrollment).
  return jwt.sign(payload, env.agentTokenSecret, { expiresIn: "365d" });
}

export function verifyAdminToken(token: string): AdminTokenPayload {
  return jwt.verify(token, env.jwtSecret) as AdminTokenPayload;
}

export function verifyAgentToken(token: string): AgentTokenPayload {
  return jwt.verify(token, env.agentTokenSecret) as AgentTokenPayload;
}

/** SHA-256 hash for storing the agent token reference in the DB. */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function extractBearer(req: NextRequest): string | null {
  const header = req.headers.get("authorization");
  if (header?.startsWith("Bearer ")) return header.slice(7);
  const cookie = req.cookies.get("flowace_token")?.value;
  return cookie ?? null;
}

export class AuthError extends Error {
  constructor(
    message: string,
    public status = 401,
  ) {
    super(message);
  }
}

/** Require a valid admin session; throws AuthError otherwise. */
export function requireAdmin(req: NextRequest): AdminTokenPayload {
  const token = extractBearer(req);
  if (!token) throw new AuthError("Missing authentication token");
  try {
    return verifyAdminToken(token);
  } catch {
    throw new AuthError("Invalid or expired token");
  }
}

/** Require a valid agent (device) token. */
export function requireAgent(req: NextRequest): AgentTokenPayload {
  const token = extractBearer(req);
  if (!token) throw new AuthError("Missing agent token");
  try {
    const payload = verifyAgentToken(token);
    if (payload.kind !== "agent") throw new Error("wrong kind");
    return payload;
  } catch {
    throw new AuthError("Invalid agent token");
  }
}
