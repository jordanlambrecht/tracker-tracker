// src/lib/privacy-db.ts
//
// Functions: createPrivacyMaskSync, scrubSnapshotUsernames
//
// DB-aware privacy operations. Pure helpers (maskUsername, isRedacted) live
// in privacy.ts to keep that module free of I/O dependencies.

import { sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { maskUsername, REDACTED_PREFIX } from "@/lib/privacy"

/**
 * Returns a masking function for a pre-fetched storeUsernames boolean, so a
 * caller that already has appSettings in scope skips the DB round-trip.
 *
 * Fallback convention: pass `true` (store usernames = no masking) when the
 * settings row does not exist, which matches the default column value.
 */
export function createPrivacyMaskSync(
  storeUsernames: boolean
): (val: string | null | undefined) => string | null {
  if (storeUsernames) return (val) => val ?? null
  return (val) => (val ? maskUsername(val) : null)
}

/**
 * Scrubs all non-redacted usernames and groups in tracker snapshots.
 * Called when privacy mode is toggled on with scrubExisting=true.
 *
 * Uses a single batch UPDATE instead of SELECT + per-row UPDATE to avoid
 * N+1 queries. The redacted format is "▓<originalLength>". We use
 * CONCAT('▓', CHAR_LENGTH(column)) and filter out already-redacted rows.
 *
 * Returns the number of rows scrubbed.
 */
export async function scrubSnapshotUsernames(): Promise<number> {
  const prefix = REDACTED_PREFIX
  const result = await db.execute(sql`
    UPDATE tracker_snapshots
    SET
      username = CASE
        WHEN username IS NOT NULL AND username NOT LIKE ${`${prefix}%`}
        THEN CONCAT(${prefix}, CHAR_LENGTH(username))
        ELSE username
      END,
      group_name = CASE
        WHEN group_name IS NOT NULL AND group_name NOT LIKE ${`${prefix}%`}
        THEN CONCAT(${prefix}, CHAR_LENGTH(group_name))
        ELSE group_name
      END
    WHERE
      (username IS NOT NULL AND username NOT LIKE ${`${prefix}%`})
      OR (group_name IS NOT NULL AND group_name NOT LIKE ${`${prefix}%`})
  `)
  return result.count
}
