import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AuthError } from "./auth";

/** Consistent JSON envelope + centralised error handling for route handlers. */

export function ok<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json({ data }, init);
}

export function created<T>(data: T): NextResponse {
  return NextResponse.json({ data }, { status: 201 });
}

export function fail(message: string, status = 400, details?: unknown): NextResponse {
  return NextResponse.json({ error: { message, details } }, { status });
}

/** Wrap an async route handler so thrown errors become clean JSON responses. */
export function handler<Args extends unknown[]>(
  fn: (...args: Args) => Promise<NextResponse>,
) {
  return async (...args: Args): Promise<NextResponse> => {
    try {
      return await fn(...args);
    } catch (err) {
      if (err instanceof AuthError) return fail(err.message, err.status);
      if (err instanceof ZodError) {
        return fail("Validation failed", 422, err.flatten());
      }
      console.error("[api] unhandled error", err);
      return fail("Internal server error", 500);
    }
  };
}
