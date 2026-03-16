#!/bin/sh
# docker-entrypoint.sh
#
# 1. Validate required environment variables
# 2. Wait for PostgreSQL to accept connections
# 3. Sync database schema (drizzle-kit push)
# 4. Start the Next.js standalone server
set -e

# ── Banner ────────────────────────────────────────────────────────────
echo ".----------------------------------------------.";
echo "|                                              |";
echo "|       ██╗ ██████╗ ██████╗ ██████╗ ██╗   ██╗  |";
echo "|       ██║██╔═══██╗██╔══██╗██╔══██╗╚██╗ ██╔╝  |";
echo "|       ██║██║   ██║██████╔╝██║  ██║ ╚████╔╝   |";
echo "|  ██   ██║██║   ██║██╔══██╗██║  ██║  ╚██╔╝    |";
echo "|  ╚█████╔╝╚██████╔╝██║  ██║██████╔╝   ██║     |";
echo "|   ╚════╝  ╚═════╝ ╚═╝  ╚═╝╚═════╝    ╚═╝     |";
echo "|                                              |";
echo "'----------------------------------------------'";
echo ""
echo ""
APP_VERSION=$(node -e "process.stdout.write(require('./package.json').version)" 2>/dev/null || echo "unknown")
VERSION_STR="v${APP_VERSION}"
TOTAL_WIDTH=48
STR_LEN=$(printf '%s' "$VERSION_STR" | wc -c | tr -d ' ')
PAD_TOTAL=$((TOTAL_WIDTH - STR_LEN - 2))
PAD_LEFT=$((PAD_TOTAL / 2))
PAD_RIGHT=$((PAD_TOTAL - PAD_LEFT))
LEFT_DASHES=$(printf '%*s' "$PAD_LEFT" '' | tr ' ' '-')
RIGHT_DASHES=$(printf '%*s' "$PAD_RIGHT" '' | tr ' ' '-')
echo "${LEFT_DASHES} ${VERSION_STR} ${RIGHT_DASHES}"
echo ""
echo ""
echo "Found a bug or need help? https://github.com/jordanlambrecht/tracker-tracker"
echo ""
echo ""

# ── Build DATABASE_URL if not provided ──────────────────────────────────
# Users can either set DATABASE_URL directly (external DB) or let us
# construct it from the simpler POSTGRES_* variables (bundled DB).
if [ -z "$DATABASE_URL" ]; then
  if [ -z "$POSTGRES_PASSWORD" ]; then
    echo "tracker-tracker | FATAL: Set either DATABASE_URL or POSTGRES_PASSWORD" >&2
    echo "tracker-tracker |   Generate a password with: openssl rand -base64 24" >&2
    exit 1
  fi
  DB_USER="${POSTGRES_USER:-postgres}"
  DB_NAME="${POSTGRES_DB:-tracker_tracker}"
  DB_HOST="${POSTGRES_HOST:-db}"
  DB_PORT="${POSTGRES_PORT:-5432}"
  ENCODED_PASSWORD=$(node -e "process.stdout.write(encodeURIComponent(process.argv[1]))" "$POSTGRES_PASSWORD")
  DATABASE_URL="postgresql://${DB_USER}:${ENCODED_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}"
  export DATABASE_URL
else
  # Parse host/port from the explicit URL for the TCP check below
  DB_HOST=$(echo "$DATABASE_URL" | sed -n 's|.*@\([^:/]*\).*|\1|p')
  DB_PORT=$(echo "$DATABASE_URL" | sed -n 's|.*:\([0-9]*\)/.*|\1|p')
  DB_HOST="${DB_HOST:-localhost}"
  DB_PORT="${DB_PORT:-5432}"
fi

# ── Validate environment ────────────────────────────────────────────────
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
# changes automatically. --force skips interactive prompts (required in Docker
# where there is no TTY). This means column renames are treated as drop+create
# and destructive changes proceed without confirmation — acceptable because
# the schema in the image is the source of truth for that release.
#
cd /schema-sync
./node_modules/.bin/drizzle-kit push --force --config=drizzle.config.ts
cd /app

# ── Start server ────────────────────────────────────────────────────────
echo "tracker-tracker | Starting server on port ${PORT:-3000}..."
exec node server.js
