#!/bin/sh
# docker-entrypoint.sh
#
# 1. Validate required environment variables
# 2. Wait for PostgreSQL to accept connections
# 3. Sync database schema (drizzle-kit push)
# 4. Start the Next.js standalone server
set -e

# ── Validate environment ────────────────────────────────────────────────
if [ -z "$DATABASE_URL" ]; then
  echo "tracker-tracker | FATAL: DATABASE_URL is not set" >&2
  exit 1
fi

if [ -z "$SESSION_SECRET" ]; then
  echo "tracker-tracker | FATAL: SESSION_SECRET is not set." >&2
  echo "tracker-tracker |   Generate one with: openssl rand -base64 48" >&2
  exit 1
fi

SECRET_LEN=$(printf '%s' "$SESSION_SECRET" | wc -c)
if [ "$SECRET_LEN" -lt 32 ]; then
  echo "tracker-tracker | FATAL: SESSION_SECRET must be at least 32 characters (got $SECRET_LEN)." >&2
  echo "tracker-tracker |   Generate one with: openssl rand -base64 48" >&2
  exit 1
fi

# ── Wait for PostgreSQL ─────────────────────────────────────────────────
echo "tracker-tracker | Waiting for database..."

# Parse host and port from DATABASE_URL for a lightweight TCP check.
# The postgres package is bundled into server chunks by Turbopack and isn't
# available as a standalone require(), so we use a raw TCP probe instead.
DB_HOST=$(echo "$DATABASE_URL" | sed -n 's|.*@\([^:/]*\).*|\1|p')
DB_PORT=$(echo "$DATABASE_URL" | sed -n 's|.*:\([0-9]*\)/.*|\1|p')
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"

until node -e "
  const net = require('net');
  const s = new net.Socket();
  s.setTimeout(3000);
  s.connect(${DB_PORT}, '${DB_HOST}', () => { s.destroy(); process.exit(0); });
  s.on('error', () => process.exit(1));
  s.on('timeout', () => { s.destroy(); process.exit(1); });
" 2>/dev/null; do
  sleep 2
done

# ── Sync schema ─────────────────────────────────────────────────────────
echo "tracker-tracker | Database ready. Syncing schema..."

# drizzle-kit push is schema-first: reads src/lib/db/schema.ts and applies
# non-destructive changes (CREATE TABLE, ADD COLUMN) automatically.
# Destructive changes (DROP COLUMN) prompt for confirmation — in Docker
# (no TTY) this causes the container to fail, which is the correct behavior:
# users should review destructive migrations before applying them.
#
# drizzle-kit lives in an isolated node_modules tree (node_modules_drizzle)
# because pnpm's symlink store makes cherry-picking from the main deps fragile.
NODE_PATH=./node_modules_drizzle node ./node_modules_drizzle/.bin/drizzle-kit push

# ── Start server ────────────────────────────────────────────────────────
echo "tracker-tracker | Starting server on port ${PORT:-3000}..."
exec node server.js
