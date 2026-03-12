# Dockerfile
#
# Multi-stage build for Tracker Tracker.
# Stages: deps → builder → runner
#
# Uses Next.js standalone output for minimal image size (~150MB vs ~1GB).

# ---------------------------------------------------------------------------
# Base
# ---------------------------------------------------------------------------
FROM node:24-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate

# ---------------------------------------------------------------------------
# Stage 1 — Install dependencies
# python3/make/g++ are required for argon2 (native C++ addon)
# libc6-compat provides glibc shims some native modules expect on Alpine
# ---------------------------------------------------------------------------
FROM base AS deps
RUN apk add --no-cache python3 make g++ libc6-compat
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# ---------------------------------------------------------------------------
# Stage 2 — Build the Next.js application
# ---------------------------------------------------------------------------
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Dummy DATABASE_URL so Next.js can evaluate route modules during build
# (the DB is never actually queried at build time)
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
RUN pnpm build

# ---------------------------------------------------------------------------
# Stage 3 — Production runner
# ---------------------------------------------------------------------------
FROM node:24-alpine AS runner
RUN apk add --no-cache libc6-compat
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Persistent volume mount points for scheduled backups and logs
RUN mkdir -p /data/backups /data/logs && chown -R nextjs:nodejs /data

# --- Standalone server (traced dependencies only — much smaller than full node_modules) ---
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# --- Drizzle schema-sync (for drizzle-kit push at startup) ---
# Next.js standalone doesn't trace drizzle-kit. Install it directly into
# /app/node_modules (merges with standalone's traced deps).
COPY --from=builder /app/drizzle.config.ts ./
COPY --from=builder /app/src/lib/db ./src/lib/db
COPY --from=builder /app/tsconfig.json ./
RUN cd /app && npm install --no-audit --no-fund --legacy-peer-deps \
    drizzle-kit drizzle-orm postgres dotenv esbuild 2>&1 | tail -1

# --- Changelog (served via /api/changelog) ---
COPY --from=builder /app/CHANGELOG.md ./

# --- Entrypoint ---
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

ENTRYPOINT ["./docker-entrypoint.sh"]
