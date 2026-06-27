import { NextRequest, NextResponse } from "next/server";

/**
 * CORS for the API. The dashboard runs on a different origin (localhost:3000 in
 * dev, Vercel in prod) and uses credentialed fetches, so we must echo the
 * specific allowed origin (never "*") and allow credentials. Preflight OPTIONS
 * requests are answered here directly.
 */

// Comma-separated list of allowed origins (CORS_ORIGIN), plus localhost in dev.
function allowedOrigins(): string[] {
  const fromEnv = (process.env.CORS_ORIGIN ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  const defaults = ["http://localhost:3000"];
  return Array.from(new Set([...fromEnv, ...defaults]));
}

function corsHeaders(origin: string | null): Headers {
  const headers = new Headers();
  const allowed = allowedOrigins();
  if (origin && allowed.includes(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Vary", "Origin");
    headers.set("Access-Control-Allow-Credentials", "true");
    headers.set("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    headers.set("Access-Control-Max-Age", "86400");
  }
  return headers;
}

export function middleware(req: NextRequest) {
  const origin = req.headers.get("origin");
  const cors = corsHeaders(origin);

  // Answer preflight immediately.
  if (req.method === "OPTIONS") {
    return new NextResponse(null, { status: 204, headers: cors });
  }

  const res = NextResponse.next();
  cors.forEach((value, key) => res.headers.set(key, value));
  return res;
}

export const config = {
  matcher: "/api/:path*",
};
