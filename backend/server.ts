/**
 * Custom production server for the Flowace backend.
 *
 * Combines:
 *   - Next.js (API route handlers under app/api)
 *   - Socket.IO realtime hub (agents publish, dashboard subscribes)
 *   - Static serving of stored screenshots from the uploads volume
 *
 * Deployed on the VPS behind Nginx. The dashboard (Vercel) talks to this over
 * HTTPS + WSS.
 */
// MUST be first: loads .env into process.env before any env/prisma read.
import "./src/lib/load-env";
import { createServer } from "node:http";
import { parse } from "node:url";
import path from "node:path";
import { promises as fs } from "node:fs";
import { createReadStream } from "node:fs";
import next from "next";
import { Server as SocketServer } from "socket.io";
import { env } from "./src/lib/env";
import { registerIo, DASHBOARD_ROOM } from "./src/lib/realtime";
import { verifyAdminToken, verifyAgentToken } from "./src/lib/auth";
import { registerAgentGateway } from "./src/realtime/agentGateway";

const dev = env.nodeEnv !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

const MIME: Record<string, string> = {
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
};

async function serveUpload(reqUrl: string, res: import("http").ServerResponse): Promise<boolean> {
  // /uploads/screenshots/<key>
  const rel = decodeURIComponent(reqUrl.replace(/^\/uploads\/screenshots\//, ""));
  if (rel.includes("..")) {
    res.statusCode = 400;
    res.end("bad path");
    return true;
  }
  const abs = path.join(env.uploadsDir, rel);
  try {
    const stat = await fs.stat(abs);
    if (!stat.isFile()) return false;
    res.setHeader("Content-Type", MIME[path.extname(abs)] ?? "application/octet-stream");
    res.setHeader("Cache-Control", "private, max-age=86400");
    createReadStream(abs).pipe(res);
    return true;
  } catch {
    res.statusCode = 404;
    res.end("not found");
    return true;
  }
}

async function main() {
  await app.prepare();

  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url ?? "", true);
    if (parsedUrl.pathname?.startsWith("/uploads/screenshots/")) {
      void serveUpload(parsedUrl.pathname, res);
      return;
    }
    void handle(req, res, parsedUrl);
  });

  const io = new SocketServer(server, {
    cors: { origin: env.corsOrigins, credentials: true },
    path: "/socket.io",
  });

  // Authenticate every socket. Dashboards join the dashboard room; agents are
  // handled by the agent gateway.
  io.use((socket, nextFn) => {
    const { token, role } = socket.handshake.auth as { token?: string; role?: string };
    try {
      if (role === "agent" && token) {
        const payload = verifyAgentToken(token);
        socket.data.agent = payload;
        return nextFn();
      }
      if (token) {
        const payload = verifyAdminToken(token);
        socket.data.admin = payload;
        return nextFn();
      }
      return nextFn(new Error("unauthorized"));
    } catch {
      return nextFn(new Error("unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    if (socket.data.admin) {
      socket.join(DASHBOARD_ROOM);
    } else if (socket.data.agent) {
      registerAgentGateway(io, socket);
    }
  });

  registerIo(io);

  server.listen(env.port, () => {
    console.log(`> Trackly backend ready on http://localhost:${env.port} (${env.nodeEnv})`);
  });
}

main().catch((err) => {
  console.error("Fatal: failed to start backend", err);
  process.exit(1);
});
