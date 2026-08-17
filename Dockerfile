# Dockerfile

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
# Stage 2 — Build the Next.js app
# ---------------------------------------------------------------------------
FROM base AS builder
ARG NEXT_PUBLIC_RELEASE_CHANNEL=stable
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_PUBLIC_RELEASE_CHANNEL=$NEXT_PUBLIC_RELEASE_CHANNEL
# Dummy DATABASE_URL so Next.js can evaluate route modules during build
# (In case DB is never actually queried at build time)
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
RUN pnpm build

# ---------------------------------------------------------------------------
# Stage 3 — Minimal deps for drizzle-kit
# ---------------------------------------------------------------------------
FROM base AS schema-deps
WORKDIR /schema-sync
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# ---------------------------------------------------------------------------
# Stage 4 — Production runner
# ---------------------------------------------------------------------------
FROM node:24-alpine AS runner
RUN apk add --no-cache libc6-compat bash && apk upgrade --no-cache \
    && rm -rf /usr/lib/node_modules /usr/local/lib/node_modules \
    /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

RUN mkdir -p /data/backups /data/logs && chown -R nextjs:nodejs /data

# --- Standalone server ---
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# --- Drizzle schema-sync (for drizzle-kit push at startup) ---
RUN mkdir -p /schema-sync/src/lib
COPY --from=schema-deps /schema-sync/node_modules /schema-sync/node_modules
COPY --from=schema-deps /schema-sync/package.json /schema-sync/
COPY --from=builder /app/drizzle.config.ts /schema-sync/
COPY --from=builder /app/src/lib/db /schema-sync/src/lib/db
COPY --from=builder /app/tsconfig.json /schema-sync/

# --- Changelog (served via /api/changelog) ---
COPY --from=builder /app/CHANGELOG.md ./

# --- Entrypoint ---
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

# --- Emergency master-password recovery ---
#
# The script is copied straight into the runner rather than traced into the
# standalone bundle: .dockerignore excludes scripts/ from the builder's context
# except for this one file, so outputFileTracingIncludes could never see it.
#
# require("argon2") already resolves — argon2 is on Next's builtin
# server-externals list, so the tracer emits /app/node_modules/argon2 for it.
#
# require("postgres") does NOT, and this COPY is why it does. Next bundles
# postgres.js into the server chunks, so nothing named "postgres" exists under
# /app/node_modules; that is the "Cannot find module 'postgres'" that broke a
# real password recovery. Marking it external in next.config.ts does not fix it
# either — see the comment there. So the CLI gets its own complete copy.
#
# COPY dereferences pnpm's symlink into a real directory, and postgres.js has
# zero runtime dependencies, so this one directory is the whole package
# including the cjs/ build that require() needs. The app server is untouched: it
# still uses its bundled copy and never resolves this one.
COPY --from=deps /app/node_modules/postgres /app/node_modules/postgres
COPY --chown=nextjs:nodejs scripts/recover.cjs /app/scripts/recover.cjs

# A real command instead of a path to memorise. /usr/local/bin is on PATH, the
# shim is root-owned 0755 so uid 1001 can execute it, and `docker exec` bypasses
# the entrypoint — so `docker exec -it tracker-tracker-app tt-recover` runs the
# CLI directly with no server side effects.
RUN printf '#!/bin/sh\nexec node /app/scripts/recover.cjs "$@"\n' > /usr/local/bin/tt-recover \
    && chmod 0755 /usr/local/bin/tt-recover

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

ENTRYPOINT ["./docker-entrypoint.sh"]
