import crypto from "node:crypto";
import type { Server as SocketServer, Socket } from "socket.io";
import { buildIceServers } from "../lib/turn";

/**
 * WebRTC signaling relay for live screen viewing. The admin (viewer) starts a
 * session; the agent (employee machine) is the offerer/sender. We relay SDP +
 * ICE between the two through Socket.IO. Agents join room `agent:<employeeId>`
 * (see agentGateway) so we can reach a specific machine.
 */

interface Session {
  adminSocketId: string;
  employeeId: string;
}

const sessions = new Map<string, Session>();
const agentRoom = (employeeId: string) => `agent:${employeeId}`;

export function registerLiveSignaling(io: SocketServer, socket: Socket): void {
  const isAdmin = Boolean(socket.data.admin);
  const isAgent = Boolean(socket.data.agent);

  if (isAdmin) {
    // Viewer asks to watch an employee's screen.
    socket.on("live:start", ({ employeeId }: { employeeId: string }) => {
      if (!employeeId) return;
      const sessionId = crypto.randomUUID();
      sessions.set(sessionId, { adminSocketId: socket.id, employeeId });
      const iceServers = buildIceServers();
      socket.emit("live:config", { sessionId, iceServers });
      io.to(agentRoom(employeeId)).emit("live:start", { sessionId, iceServers });
    });

    socket.on("live:answer", ({ sessionId, sdp }: { sessionId: string; sdp: unknown }) => {
      const s = sessions.get(sessionId);
      if (s) io.to(agentRoom(s.employeeId)).emit("live:answer", { sessionId, sdp });
    });

    socket.on("live:ice", ({ sessionId, candidate }: { sessionId: string; candidate: unknown }) => {
      const s = sessions.get(sessionId);
      if (s) io.to(agentRoom(s.employeeId)).emit("live:ice", { sessionId, candidate });
    });

    socket.on("live:stop", ({ sessionId }: { sessionId: string }) => {
      const s = sessions.get(sessionId);
      if (s) io.to(agentRoom(s.employeeId)).emit("live:stop", { sessionId });
      sessions.delete(sessionId);
    });

    socket.on("disconnect", () => {
      for (const [id, s] of sessions) {
        if (s.adminSocketId === socket.id) {
          io.to(agentRoom(s.employeeId)).emit("live:stop", { sessionId: id });
          sessions.delete(id);
        }
      }
    });
  }

  if (isAgent) {
    // Agent (sender) returns its offer + ICE to the viewer that started it.
    socket.on("live:offer", ({ sessionId, sdp }: { sessionId: string; sdp: unknown }) => {
      const s = sessions.get(sessionId);
      if (s) io.to(s.adminSocketId).emit("live:offer", { sessionId, sdp });
    });

    socket.on("live:ice", ({ sessionId, candidate }: { sessionId: string; candidate: unknown }) => {
      const s = sessions.get(sessionId);
      if (s) io.to(s.adminSocketId).emit("live:ice", { sessionId, candidate });
    });
  }
}
