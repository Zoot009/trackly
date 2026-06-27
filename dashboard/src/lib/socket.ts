"use client";

import { io, type Socket } from "socket.io-client";
import { config } from "./config";
import { getToken } from "@/store/auth";

let socket: Socket | null = null;

/** Lazily create a single shared dashboard socket connection. */
export function getSocket(): Socket {
  if (socket) return socket;
  socket = io(config.socketUrl, {
    path: "/socket.io",
    transports: ["websocket"],
    autoConnect: true,
    auth: { token: getToken(), role: "admin" },
  });
  return socket;
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
}
