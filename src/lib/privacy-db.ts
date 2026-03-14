// src/lib/privacy-db.ts
//
// Functions: createPrivacyMask, scrubSnapshotUsernames
//
// DB-aware privacy operations. Pure helpers (maskUsername, isRedacted) live
// in privacy.ts to keep that module free of I/O dependencies.

import { sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { appSettings } from "@/lib/db/schema"
import { isRedacted, maskUsername, REDACTED_PREFIX } from "@/lib/privacy"

/**
 * Fetches the current privacy setting and returns a masking function.
 * When privacy mode is on (storeUsernames=false), the returned function
 * replaces plaintext values with redacted markers. When off, values
 * pass through unchanged. Already-redacted values are never double-masked.
 */
export async function createPrivacyMask(): Promise<(value: string | null | undefined) => string | null> {
  const [settings] = await db
    .select({ storeUsernames: appSettings.storeUsernames })
    .from(appSettings)
    .limit(1)
  const privacyMode = settings ? !settings.storeUsernames : false

  return (value: string | null | undefined): string | null => {
    if (!value) return null
    if (!privacyMode || isRedacted(value)) return value
    return maskUsername(value)
  }
}

/**
 * Scrubs all non-redacted usernames and groups in tracker snapshots.
 * Called when privacy mode is toggled on with scrubExisting=true.
 *
 * Uses a single batch UPDATE instead of SELECT + per-row UPDATE to avoid
 * N+1 queries. The redacted format is "▓<originalLength>" — we use
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
  return (result as { rowCount?: number }).rowCount ?? 0
}
