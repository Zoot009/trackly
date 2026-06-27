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

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
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
