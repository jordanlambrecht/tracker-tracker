#!/usr/bin/env bash
# scripts/upgrade-pg17-to-18.sh
#
# One-command PostgreSQL 17 → 18 migration for Tracker Tracker.
# Uses only official Docker images. No third-party dependencies.
#
# Usage:
#   ./scripts/upgrade-pg17-to-18.sh
#
# What it does:
#   1. Stops the running stack
#   2. Starts a temporary PG17 container against the existing volume
#   3. Dumps the entire database via pg_dumpall
#   4. Stops the temporary container
#   5. Backs up the old volume, then removes it
#   6. Starts PG18 via docker compose (fresh initdb)
#   7. Restores the dump
#   8. Runs ANALYZE for fresh planner stats
#   9. Pushes Drizzle schema (new indexes)
#   10. Starts the full stack
#
# Works regardless of whether docker-compose.yml currently points to PG17 or PG18.
# Safe to re-run: exits early if already on PG18+.
# The old volume backup (pgdata_17_backup) is preserved until you manually remove it.

set -euo pipefail

# ── Colors ───────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

info()  { echo -e "${CYAN}[INFO]${NC}  $*"; }
ok()    { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
die()   { echo -e "${RED}[ERROR]${NC} $*" >&2; exit 1; }

# ── Pre-flight ───────────────────────────────────

cd "$(dirname "$0")/.." || die "Could not find project root"

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

PG_USER="${POSTGRES_USER:-postgres}"
PG_PASS="${POSTGRES_PASSWORD:-}"
DB_CONTAINER="tracker-tracker-db"
TEMP_CONTAINER="tt-pg17-dump"
DUMP_FILE="$(pwd)/.pg17-backup.sql"

if [ -z "$PG_PASS" ]; then
  die "POSTGRES_PASSWORD is not set. Check your .env file."
fi

info "Checking Docker is running..."
docker info >/dev/null 2>&1 || die "Docker is not running. Start Docker and try again."

# ── Find the volume ──────────────────────────────

PGVOL=$(docker volume ls --filter name=pgdata --format '{{.Name}}' | head -1)
if [ -z "$PGVOL" ]; then
  die "Could not find a Docker volume matching 'pgdata'. Is this a fresh install? No migration needed."
fi
info "Found volume: ${PGVOL}"

# ── Check if already on PG18+ ────────────────────
# Try to detect version from a running container first, then via a temp container.

CURRENT_MAJOR=0

if docker ps --format '{{.Names}}' | grep -q "^${DB_CONTAINER}$"; then
  CURRENT_VERSION=$(docker exec "$DB_CONTAINER" psql -U "$PG_USER" -tAc "SHOW server_version_num;" 2>/dev/null || echo "0")
  CURRENT_MAJOR=$(( CURRENT_VERSION / 10000 ))
fi

# If we couldn't get the version (container not running or crashing), check PG_VERSION file in the volume
if [ "$CURRENT_MAJOR" -eq 0 ]; then
  CURRENT_MAJOR=$(docker run --rm -v "${PGVOL}:/data:ro" alpine cat /data/PG_VERSION 2>/dev/null || echo "0")
fi

if [ "$CURRENT_MAJOR" -ge 18 ]; then
  ok "Already on PostgreSQL ${CURRENT_MAJOR}. Nothing to do."
  exit 0
fi

if [ "$CURRENT_MAJOR" -eq 0 ]; then
  die "Could not determine PostgreSQL version from volume '${PGVOL}'. Is the volume empty?"
fi

ok "Detected PostgreSQL ${CURRENT_MAJOR} data. Proceeding with upgrade to 18."

# ── Confirmation ─────────────────────────────────

echo ""
echo -e "${YELLOW}This will:${NC}"
echo "  1. Stop the running stack"
echo "  2. Dump your database"
echo "  3. Remove the old volume (a backup copy is kept)"
echo "  4. Restore into a fresh PostgreSQL 18 instance"
echo ""
read -rp "Continue? [y/N] " CONFIRM
if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
  info "Aborted."
  exit 0
fi

# ── Stop existing stack ──────────────────────────

info "Stopping existing stack..."
docker compose down 2>/dev/null || true

# Clean up any leftover temp container from a previous failed run
docker rm -f "$TEMP_CONTAINER" 2>/dev/null || true

# ── Dump via standalone PG17 container ───────────
# This works regardless of what docker-compose.yml says.

info "Starting temporary PG17 container for dump..."
docker run -d \
  --name "$TEMP_CONTAINER" \
  -e POSTGRES_USER="$PG_USER" \
  -e POSTGRES_PASSWORD="$PG_PASS" \
  -e PGDATA=/var/lib/postgresql/data \
  -v "${PGVOL}:/var/lib/postgresql/data" \
  postgres:17-alpine >/dev/null

info "Waiting for PG17 to become ready..."
RETRIES=0
MAX_RETRIES=30
until docker exec "$TEMP_CONTAINER" pg_isready -U "$PG_USER" >/dev/null 2>&1; do
  RETRIES=$((RETRIES + 1))
  if [ "$RETRIES" -ge "$MAX_RETRIES" ]; then
    docker rm -f "$TEMP_CONTAINER" >/dev/null 2>&1 || true
    die "PG17 temp container did not become ready. Check: docker logs ${TEMP_CONTAINER}"
  fi
  sleep 2
done

info "Dumping database with pg_dumpall..."
touch "$DUMP_FILE"
chmod 600 "$DUMP_FILE"
docker exec "$TEMP_CONTAINER" pg_dumpall -U "$PG_USER" > "$DUMP_FILE"

DUMP_LINES=$(wc -l < "$DUMP_FILE")
if [ "$DUMP_LINES" -lt 10 ]; then
  docker rm -f "$TEMP_CONTAINER" >/dev/null 2>&1 || true
  die "Dump looks empty (${DUMP_LINES} lines). Aborting — volume not modified."
fi
ok "Dump complete: ${DUMP_LINES} lines → $(du -h "$DUMP_FILE" | cut -f1)"

info "Stopping temporary PG17 container..."
docker rm -f "$TEMP_CONTAINER" >/dev/null

# ── Volume backup ────────────────────────────────

info "Backing up volume to pgdata_17_backup..."
docker volume create pgdata_17_backup >/dev/null 2>&1 || true
docker run --rm \
  -v "${PGVOL}:/from:ro" \
  -v pgdata_17_backup:/to \
  alpine sh -c "cp -a /from/. /to/"
ok "Volume backed up."

# ── Remove old volume + start PG18 ──────────────

info "Removing old volume (PG18 will initdb fresh)..."
docker volume rm "$PGVOL" >/dev/null

info "Starting PG18 via docker compose..."
docker compose up -d "$DB_CONTAINER"

info "Waiting for PG18 to become ready..."
RETRIES=0
until docker exec "$DB_CONTAINER" pg_isready -U "$PG_USER" >/dev/null 2>&1; do
  RETRIES=$((RETRIES + 1))
  if [ "$RETRIES" -ge "$MAX_RETRIES" ]; then
    die "PG18 did not become ready after ${MAX_RETRIES} attempts. Check: docker logs ${DB_CONTAINER}"
  fi
  sleep 2
done
ok "PG18 is ready."

# ── Restore ──────────────────────────────────────

info "Restoring dump into PG18..."
# pg_dumpall includes CREATE ROLE for the default user, which already exists.
# The "already exists" errors are harmless.
docker exec -i "$DB_CONTAINER" psql -U "$PG_USER" < "$DUMP_FILE" 2>&1 \
  | grep -v "already exists" \
  | grep -v "^CREATE ROLE$" \
  | grep -v "^ALTER ROLE$" \
  || true
ok "Restore complete."

# ── Post-restore ─────────────────────────────────

info "Running ANALYZE for fresh planner statistics..."
docker exec "$DB_CONTAINER" psql -U "$PG_USER" -d tracker_tracker -c "ANALYZE;" >/dev/null
ok "Statistics refreshed."

# ── Verify ───────────────────────────────────────

NEW_VERSION=$(docker exec "$DB_CONTAINER" psql -U "$PG_USER" -tAc "SHOW server_version;" 2>/dev/null)
ROW_COUNT=$(docker exec "$DB_CONTAINER" psql -U "$PG_USER" -d tracker_tracker -tAc "SELECT count(*) FROM tracker_snapshots;" 2>/dev/null || echo "?")

ok "PostgreSQL version: ${NEW_VERSION}"
ok "tracker_snapshots rows: ${ROW_COUNT}"

# ── Pre-push data conversion ─────────────────────
# Column types changed: cachedTorrents text→jsonb, crossSeedTags text→text[].
# drizzle-kit push can't auto-cast these — convert BEFORE the push.

info "Converting cachedTorrents from text to jsonb..."
docker exec "$DB_CONTAINER" psql -U "$PG_USER" -d tracker_tracker -c "
  ALTER TABLE download_clients
    ALTER COLUMN cached_torrents TYPE jsonb USING cached_torrents::jsonb;
" >/dev/null 2>&1 || warn "cachedTorrents conversion failed (may already be jsonb)"

info "Converting crossSeedTags from JSON text to PG array format..."
# PG doesn't allow subqueries in USING expressions, so we use a temp column swap.
docker exec "$DB_CONTAINER" psql -U "$PG_USER" -d tracker_tracker -c "
  ALTER TABLE download_clients ADD COLUMN cross_seed_tags_new text[] DEFAULT '{}';
" >/dev/null 2>&1 || true
docker exec "$DB_CONTAINER" psql -U "$PG_USER" -d tracker_tracker -c "
  UPDATE download_clients SET cross_seed_tags_new = CASE
    WHEN cross_seed_tags IS NULL OR cross_seed_tags = '[]' THEN '{}'::text[]
    ELSE (SELECT array_agg(elem) FROM jsonb_array_elements_text(cross_seed_tags::jsonb) AS elem)
  END;
" >/dev/null 2>&1 || true
docker exec "$DB_CONTAINER" psql -U "$PG_USER" -d tracker_tracker -c "
  ALTER TABLE download_clients DROP COLUMN cross_seed_tags;
  ALTER TABLE download_clients RENAME COLUMN cross_seed_tags_new TO cross_seed_tags;
" >/dev/null 2>&1 || warn "crossSeedTags conversion failed (may already be text[])"

# ── Schema push (new indexes) ────────────────────

info "Pushing Drizzle schema (applies new indexes + column type changes)..."
if command -v pnpm >/dev/null 2>&1; then
  pnpm drizzle-kit push 2>&1 || warn "drizzle-kit push failed. Run it manually: pnpm drizzle-kit push"
else
  warn "pnpm not found. Run manually: pnpm drizzle-kit push"
fi

# ── Rebuild indexes ──────────────────────────────
# Run AFTER drizzle-kit push so the new indexes exist.
# Each REINDEX must be a separate psql call (CONCURRENTLY cannot run inside a transaction).

info "Rebuilding indexes for optimal PG18 storage layout..."
for IDX in idx_snapshots_polled_brin idx_snapshots_tracker_polled idx_client_snapshots_client_polled idx_tracker_roles_tracker_id; do
  docker exec "$DB_CONTAINER" psql -U "$PG_USER" -d tracker_tracker \
    -c "REINDEX INDEX CONCURRENTLY ${IDX};" >/dev/null 2>&1 || true
done
ok "Indexes rebuilt."

# ── Start full stack ─────────────────────────────

info "Starting the full stack..."
docker compose up -d
ok "Full stack is up."

# ── Cleanup instructions ─────────────────────────

echo ""
echo -e "${GREEN}════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  Migration complete: PostgreSQL 17 → 18${NC}"
echo -e "${GREEN}════════════════════════════════════════════════${NC}"
echo ""
echo "  Your data has been migrated. Verify the app works at:"
echo "    curl http://localhost:3000/api/health"
echo ""
echo "  Once confirmed, clean up:"
echo "    rm ${DUMP_FILE}"
echo "    docker volume rm pgdata_17_backup"
echo ""
