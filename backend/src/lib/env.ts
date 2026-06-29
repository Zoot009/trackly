/** Validated environment configuration. Fails fast on boot if misconfigured. */

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: required("DATABASE_URL", "postgresql://flowace:flowace@localhost:5432/flowace"),
  jwtSecret: required("JWT_SECRET", "dev-insecure-secret-change-me"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "12h",
  agentTokenSecret: required("AGENT_TOKEN_SECRET", "dev-agent-secret-change-me"),
  uploadsDir: process.env.UPLOADS_DIR ?? "./uploads/screenshots",
  publicBaseUrl: process.env.PUBLIC_BASE_URL ?? "http://localhost:4000",
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:3000",
  // Parsed list form for Socket.IO (which needs an array for multiple origins).
  corsOrigins: (process.env.CORS_ORIGIN ?? "http://localhost:3000")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),
  isProd: (process.env.NODE_ENV ?? "development") === "production",
} as const;
