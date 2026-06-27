"use client";

import { useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import { getSocket } from "@/lib/socket";

/** Subscribe to a socket event for the component's lifetime and expose the
 * live connection status. Handlers are kept in a ref so re-renders don't
 * re-bind listeners. */
export function useLiveSocket<T>(event: string, onEvent: (payload: T) => void) {
  const [connected, setConnected] = useState(false);
  const handler = useRef(onEvent);
  handler.current = onEvent;

  useEffect(() => {
    const socket: Socket = getSocket();
    const wrapped = (payload: T) => handler.current(payload);

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on(event, wrapped);
    setConnected(socket.connected);

    return () => {
      socket.off(event, wrapped);
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
    };
  }, [event]);

  return { connected };
}
