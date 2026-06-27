import { loadEnvConfig } from "@next/env";

/**
 * Side-effect module: loads .env files into process.env exactly like Next.js
 * does. The custom server (server.ts) runs outside Next's auto-loading, so this
 * must be imported FIRST — before any module that reads process.env (env.ts,
 * prisma.ts) — otherwise secrets/DB URL fall back to defaults and JWTs signed
 * by the API routes won't verify in the socket layer.
 */
loadEnvConfig(process.cwd());
