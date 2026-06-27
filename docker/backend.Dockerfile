# syntax=docker/dockerfile:1
# Multi-stage build for the Flowace backend (Next.js API + Socket.IO server).
FROM node:22-bookworm-slim AS base
WORKDIR /app
ENV NODE_ENV=production
# sharp + better-sqlite3 build prerequisites
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl python3 make g++ ca-certificates && rm -rf /var/lib/apt/lists/*

# ---- deps ----
FROM base AS deps
COPY package.json package-lock.json* ./
COPY shared/package.json ./shared/
COPY backend/package.json ./backend/
RUN npm install --workspaces --include-workspace-root --no-audit --no-fund

# ---- build ----
FROM deps AS build
ENV NODE_ENV=development
COPY tsconfig.base.json ./
COPY shared ./shared
COPY backend ./backend
RUN npm run build:shared
RUN npm run prisma:generate --workspace backend
RUN npm run build --workspace backend

# ---- runtime ----
FROM base AS runtime
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/shared/dist ./shared/dist
COPY --from=build /app/shared/package.json ./shared/package.json
COPY --from=build /app/backend/.next ./backend/.next
COPY --from=build /app/backend/dist ./backend/dist
COPY --from=build /app/backend/public ./backend/public
COPY --from=build /app/backend/node_modules/.prisma ./backend/node_modules/.prisma
COPY --from=build /app/backend/prisma ./backend/prisma
COPY --from=build /app/backend/package.json ./backend/package.json
COPY --from=build /app/package.json ./package.json

WORKDIR /app/backend
EXPOSE 4000
# Run migrations then start the custom server.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
