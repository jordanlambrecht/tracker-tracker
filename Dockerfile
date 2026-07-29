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
#
# `--prod` is load-bearing for image CVE count, not just size: the runner copies
# this node_modules in for the startup `drizzle-kit push`, so a full install
# shipped vitest/vite/jsdom/undici/typescript into production and Trivy flagged
# every one of them. drizzle-kit, drizzle-orm and postgres all live in
# `dependencies`, and drizzle-kit vendors its own esbuild/tsx, so the schema push
# has everything it needs. drizzle.config.ts already guards its `dotenv` require
# in a try/catch for exactly this case.
#
# The `prepare` script is stripped because it runs husky, a devDependency that
# `--prod` (correctly) does not install. Removing a script does not affect the
# `--frozen-lockfile` check, which compares dependency specifiers only.
# ---------------------------------------------------------------------------
FROM base AS schema-deps
WORKDIR /schema-sync
COPY package.json pnpm-lock.yaml ./
RUN node -e "const fs=require('fs');const p=JSON.parse(fs.readFileSync('package.json','utf8'));delete p.scripts.prepare;fs.writeFileSync('package.json',JSON.stringify(p,null,2))" \
    && pnpm install --frozen-lockfile --prod

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

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

ENTRYPOINT ["./docker-entrypoint.sh"]
