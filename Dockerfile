# Dockerfile
#
# Multi-stage build for Tracker Tracker.
# Stages: deps (install) → builder (compile) → runner (serve)

# ---------------------------------------------------------------------------
# Base
# ---------------------------------------------------------------------------
FROM node:20.11-alpine AS base

# ---------------------------------------------------------------------------
# Stage 1 — Install dependencies
# python3/make/g++ are required for argon2 (native C++ addon)
# libc6-compat provides glibc shims some native modules expect on Alpine
# ---------------------------------------------------------------------------
FROM base AS deps
RUN apk add --no-cache python3 make g++ libc6-compat
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable pnpm && pnpm install --frozen-lockfile

# ---------------------------------------------------------------------------
# Stage 2 — Build the Next.js application
# ---------------------------------------------------------------------------
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN corepack enable pnpm && pnpm build

# ---------------------------------------------------------------------------
# Stage 3 — Production runner
# ---------------------------------------------------------------------------
FROM base AS runner
RUN apk add --no-cache libc6-compat
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Persistent volume mount point for scheduled backups
RUN mkdir -p /data/backups /data/logs && chown -R nextjs:nodejs /data

# --- Application files ---
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./
COPY --from=builder /app/next.config.ts ./

# --- Drizzle schema-sync files (for drizzle-kit push at startup) ---
COPY --from=builder /app/drizzle.config.ts ./
COPY --from=builder /app/src/lib/db ./src/lib/db
COPY --from=builder /app/tsconfig.json ./

# --- Entrypoint ---
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

ENTRYPOINT ["./docker-entrypoint.sh"]
