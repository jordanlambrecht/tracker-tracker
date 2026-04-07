// src/lib/db/ensure-indexes.ts
//
// Creates covering indexes that can't be expressed in Drizzle's schema DSL.
// Called once per server start. PostgreSQL's IF NOT EXISTS makes this idempotent.

import { sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { errMsg } from "@/lib/error-utils"
import { log } from "@/lib/logger"

const g = globalThis as typeof globalThis & { __indexesEnsured?: boolean }

/**
 * Creates a covering index on tracker_snapshots that enables index-only scans
 * for the selectDistinctOn + date_trunc query in getSnapshotsForTracker.
 *
 * Without this, PostgreSQL scans all raw rows (potentially millions after years
 * of polling) to compute hourly/daily buckets. With the covering index, it reads
 * the index instead of visiting heap pages.
 *
 * The INCLUDE columns match snapshotColumns in server-data.ts. If snapshotColumns
 * changes, this index should be updated to match.
 */
export async function ensureIndexes(): Promise<void> {
  if (g.__indexesEnsured) return

  try {
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_snapshots_tracker_polled_covering
      ON tracker_snapshots (tracker_id, polled_at)
      INCLUDE (
        uploaded_bytes, downloaded_bytes, ratio, buffer_bytes,
        seeding_count, leeching_count, seedbonus, hit_and_runs,
        required_ratio, warned, freeleech_tokens, share_score,
        username, group_name
      )
    `)
    g.__indexesEnsured = true
    log.debug("Covering index on tracker_snapshots verified")
  } catch (err) {
    // Non-fatal. The app works without the covering index, just slower for
    // long-range chart queries. Log and continue.
    log.warn(
      { error: errMsg(err) },
      "Failed to create covering index on tracker_snapshots — chart queries may be slow for long ranges"
    )
  }
}
