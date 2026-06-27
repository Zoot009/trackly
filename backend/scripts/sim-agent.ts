/**
 * Local agent simulator. Behaves like the real Trackly desktop agent over the
 * network — registers a device, opens the realtime socket, streams activity +
 * heartbeats, and uploads periodic screenshots — so the full live pipeline can
 * be tested locally without building Electron + native modules.
 *
 * Usage:
 *   npx tsx scripts/sim-agent.ts                 # auto-picks the first employee
 *   SIM_TOKEN=<enrollmentToken> npx tsx scripts/sim-agent.ts
 *   SIM_SERVER=http://localhost:4000 SIM_COUNT=3 npx tsx scripts/sim-agent.ts
 */
import sharp from "sharp";
import { io } from "socket.io-client";
import { SOCKET_EVENTS, ActivityState, EmployeeStatus } from "@flowace/shared";

const SERVER = process.env.SIM_SERVER ?? "http://localhost:4000";
const ADMIN_EMAIL = process.env.SIM_ADMIN_EMAIL ?? "admin@flowace.dev";
const ADMIN_PASS = process.env.SIM_ADMIN_PASSWORD ?? "admin12345";
const COUNT = Math.max(1, Number(process.env.SIM_COUNT ?? 1));

const APPS = [
  { app: "Visual Studio Code", site: "github.com", window: "src/index.ts — flowace" },
  { app: "Google Chrome", site: "stackoverflow.com", window: "How to center a div — Stack Overflow" },
  { app: "Slack", site: null, window: "#engineering — Slack" },
  { app: "Figma", site: "figma.com", window: "Dashboard v3 — Figma" },
  { app: "YouTube", site: "youtube.com", window: "Lofi beats — YouTube" },
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

async function adminToken(): Promise<string> {
  const res = await fetch(`${SERVER}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASS }),
  });
  if (!res.ok) throw new Error(`admin login failed (${res.status})`);
  return (await res.json()).data.token as string;
}

async function enrollmentTokens(): Promise<{ token: string; name: string }[]> {
  if (process.env.SIM_TOKEN) return [{ token: process.env.SIM_TOKEN, name: "(provided)" }];
  const jwt = await adminToken();
  const res = await fetch(`${SERVER}/api/employees`, { headers: { Authorization: `Bearer ${jwt}` } });
  const employees = (await res.json()).data as { enrollmentToken: string; name: string }[];
  if (!employees.length) throw new Error("no active employees — seed the DB first");
  return employees.slice(0, COUNT).map((e) => ({ token: e.enrollmentToken, name: e.name }));
}

async function makeScreenshot(label: string): Promise<Buffer> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720">
    <rect width="100%" height="100%" fill="#0a0a0a"/>
    <text x="50%" y="48%" fill="#fafafa" font-size="44" font-family="sans-serif" text-anchor="middle">Trackly demo screen</text>
    <text x="50%" y="56%" fill="#a3a3a3" font-size="24" font-family="sans-serif" text-anchor="middle">${label}</text>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function runAgent(enrollmentToken: string, label: string): Promise<void> {
  // 1. Register the device.
  const reg = await fetch(`${SERVER}/api/agent/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      enrollmentToken,
      hostname: `sim-${Math.floor(Math.random() * 1000)}`,
      platform: "linux",
      osVersion: "6.x",
      agentVersion: "1.0.0-sim",
    }),
  });
  if (!reg.ok) throw new Error(`register failed (${reg.status})`);
  const { token, deviceId, employeeId, employeeName } = (await reg.json()).data;
  console.log(`[${employeeName}] registered device ${deviceId}`);

  // 2. Connect the realtime socket as an agent.
  const socket = io(SERVER, {
    path: "/socket.io",
    transports: ["websocket"],
    auth: { token, role: "agent" },
  });

  socket.on("connect", () => {
    console.log(`[${employeeName}] socket connected`);
    socket.emit(SOCKET_EVENTS.AGENT_HEARTBEAT, {
      deviceId,
      employeeId,
      status: EmployeeStatus.ONLINE,
      timestamp: new Date().toISOString(),
    });
  });
  socket.on("connect_error", (e) => console.error(`[${employeeName}] socket error:`, e.message));

  // 3. Stream activity every 3s.
  setInterval(() => {
    const a = pick(APPS);
    const idle = Math.random() < 0.2;
    socket.emit(SOCKET_EVENTS.AGENT_ACTIVITY, {
      employeeId,
      deviceId,
      state: idle ? ActivityState.IDLE : ActivityState.ACTIVE,
      currentApp: a.app,
      windowTitle: a.window,
      currentWebsite: a.site,
      activityPercent: idle ? 0 : 70 + Math.floor(Math.random() * 30),
      idleSeconds: idle ? 120 : 0,
      timestamp: new Date().toISOString(),
    });
  }, 3000);

  // 4. Heartbeat every 15s.
  setInterval(() => {
    socket.emit(SOCKET_EVENTS.AGENT_HEARTBEAT, {
      deviceId,
      employeeId,
      status: EmployeeStatus.ONLINE,
      timestamp: new Date().toISOString(),
    });
  }, 15000);

  // 5. Upload a screenshot every 20s (and once shortly after start).
  const upload = async () => {
    try {
      const buf = await makeScreenshot(`${label} · ${new Date().toLocaleTimeString()}`);
      const form = new FormData();
      form.append("file", new Blob([buf], { type: "image/png" }), "screen.png");
      form.append("capturedAt", new Date().toISOString());
      const res = await fetch(`${SERVER}/api/agent/screenshot`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      console.log(`[${employeeName}] screenshot upload: ${res.status}`);
    } catch (e) {
      console.error(`[${employeeName}] screenshot failed:`, e);
    }
  };
  setTimeout(upload, 4000);
  setInterval(upload, 20000);
}

(async () => {
  console.log(`Trackly agent simulator → ${SERVER}`);
  const tokens = await enrollmentTokens();
  for (const t of tokens) await runAgent(t.token, t.name);
  console.log(`Simulating ${tokens.length} agent(s). Open the dashboard → Live Activity. Ctrl+C to stop.`);
})().catch((e) => {
  console.error("simulator failed:", e);
  process.exit(1);
});
