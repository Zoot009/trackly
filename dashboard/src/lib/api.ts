"use client";

import { config } from "./config";
import { getToken, useAuth } from "@/store/auth";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public details?: unknown,
  ) {
    super(message);
  }
}

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  raw?: boolean; // when true, body is sent as-is (e.g. FormData)
}

/** Typed fetch wrapper. Attaches the admin bearer token and unwraps the
 * `{ data }` envelope returned by the backend. */
export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const token = getToken();
  const headers = new Headers(options.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let body: BodyInit | undefined;
  if (options.body !== undefined) {
    if (options.raw) {
      body = options.body as BodyInit;
    } else {
      headers.set("Content-Type", "application/json");
      body = JSON.stringify(options.body);
    }
  }

  const res = await fetch(`${config.apiUrl}${path}`, {
    ...options,
    headers,
    body,
    credentials: "include",
  });

  if (res.status === 401 && typeof window !== "undefined") {
    useAuth.getState().clear();
    if (!window.location.pathname.startsWith("/login")) {
      window.location.href = "/login";
    }
  }

  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(json?.error?.message ?? "Request failed", res.status, json?.error?.details);
  }
  return json?.data as T;
}

export const apiClient = {
  get: <T>(path: string) => api<T>(path),
  post: <T>(path: string, body?: unknown) => api<T>(path, { method: "POST", body }),
  patch: <T>(path: string, body?: unknown) => api<T>(path, { method: "PATCH", body }),
  delete: <T>(path: string) => api<T>(path, { method: "DELETE" }),
};
