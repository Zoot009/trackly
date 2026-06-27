"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Admin } from "@flowace/shared";

interface AuthState {
  token: string | null;
  admin: Pick<Admin, "id" | "email" | "name" | "role"> | null;
  setSession: (token: string, admin: AuthState["admin"]) => void;
  clear: () => void;
}

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      admin: null,
      setSession: (token, admin) => set({ token, admin }),
      clear: () => set({ token: null, admin: null }),
    }),
    { name: "flowace-auth" },
  ),
);

/** Read the token outside React (for the fetch client). */
export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("flowace-auth");
    return raw ? (JSON.parse(raw).state?.token ?? null) : null;
  } catch {
    return null;
  }
}
