#!/bin/sh
# docker-entrypoint.sh
#
# 1. Wait for PostgreSQL to accept connections
# 2. Sync database schema (drizzle-kit push)
# 3. Start the Next.js server
set -e

echo "tracker-tracker | Waiting for database..."

# Poll until Postgres accepts a connection (uses the postgres driver already
# installed in node_modules — no need for psql on the image).
until node -e "
  const postgres = require('postgres');
  const sql = postgres(process.env.DATABASE_URL, { connect_timeout: 3 });
  sql\`SELECT 1\`.then(() => sql.end().then(() => process.exit(0)))
    .catch(() => process.exit(1));
" 2>/dev/null; do
  sleep 2
done

echo "tracker-tracker | Database ready. Syncing schema..."

# drizzle-kit push is schema-first: reads src/lib/db/schema.ts and applies
# non-destructive changes (CREATE TABLE, ADD COLUMN) automatically.
# Destructive changes (DROP COLUMN) prompt for confirmation — in Docker
# (no TTY) this causes the container to fail, which is the correct behavior:
# users should review destructive migrations before applying them.
npx drizzle-kit push

echo "tracker-tracker | Starting server on port ${PORT:-3000}..."
exec npx next start -p "${PORT:-3000}" -H "${HOSTNAME:-0.0.0.0}"
