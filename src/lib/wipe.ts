// src/lib/wipe.ts
//
// Functions: getProgressiveLockoutMs, recordFailedAttempt, resetFailedAttempts, scrubAndDeleteAll

import { randomBytes } from "node:crypto"
import { eq, sql } from "drizzle-orm"
import { db } from "@/lib/db"
import {
  appSettings,
  clientSnapshots,
  clientUptimeBuckets,
  downloadClients,
  tagGroupMembers,
  tagGroups,
  trackerRoles,
  trackerSnapshots,
  trackers,
} from "@/lib/db/schema"
import { stopScheduler } from "@/lib/scheduler"

const WIPE_MESSAGE = "Too many failed attempts. All data has been deleted."

export function getProgressiveLockoutMs(attemptCount: number): number {
  if (attemptCount >= 20) return 3_600_000 // 1 hour
  if (attemptCount >= 15) return 900_000 // 15 minutes
  if (attemptCount >= 10) return 120_000 // 2 minutes
  if (attemptCount >= 5) return 30_000 // 30 seconds
  return 0
}

export async function recordFailedAttempt(
  settingsId: number,
  threshold: number | null
): Promise<boolean> {
  const [updated] = await db
    .update(appSettings)
    .set({ failedLoginAttempts: sql`${appSettings.failedLoginAttempts} + 1` })
    .where(eq(appSettings.id, settingsId))
    .returning({ failedLoginAttempts: appSettings.failedLoginAttempts })

  const lockoutMs = getProgressiveLockoutMs(updated.failedLoginAttempts)
  if (lockoutMs > 0) {
    await db
      .update(appSettings)
      .set({ lockedUntil: new Date(Date.now() + lockoutMs) })
      .where(eq(appSettings.id, settingsId))
  }

  if (threshold && threshold > 0 && updated.failedLoginAttempts >= threshold) {
    await scrubAndDeleteAll()
    return true
  }
  return false
}

export async function resetFailedAttempts(settingsId: number): Promise<void> {
  await db
    .update(appSettings)
    .set({ failedLoginAttempts: 0, lockedUntil: null })
    .where(eq(appSettings.id, settingsId))
}

export { WIPE_MESSAGE }

function randomHex(bytes: number): string {
  return randomBytes(bytes).toString("hex")
}

export async function scrubAndDeleteAll(): Promise<void> {
  // 1. Stop scheduler (zero-fills encryption key)
  stopScheduler()

  // 2. Scrub sensitive columns with random data before deletion
  await db.update(trackerSnapshots).set({
    username: randomHex(16),
    group: randomHex(16),
  })

  await db.update(trackers).set({
    encryptedApiToken: randomHex(64),
    name: randomHex(8),
    baseUrl: randomHex(16),
    lastError: null,
    qbtTag: null,
  })

  await db.update(trackerRoles).set({
    roleName: randomHex(8),
    notes: null,
  })

  await db.update(appSettings).set({
    passwordHash: randomHex(32),
    encryptionSalt: randomHex(32),
    username: null,
    totpSecret: null,
    totpBackupCodes: null,
    encryptedProxyPassword: null,
  })

  // Scrub download client credentials
  await db.update(downloadClients).set({
    encryptedUsername: randomHex(64),
    encryptedPassword: randomHex(64),
    name: randomHex(8),
    host: randomHex(16),
    lastError: null,
  })

  // 3. Delete all rows (child tables first due to FK constraints)
  await db.delete(clientUptimeBuckets)
  await db.delete(clientSnapshots)
  await db.delete(trackerSnapshots)
  await db.delete(trackerRoles)
  await db.delete(tagGroupMembers)
  await db.delete(tagGroups)
  await db.delete(downloadClients)
  await db.delete(trackers)
  await db.delete(appSettings)
  // backupHistory intentionally preserved — allows restore after nuke

  // 4. VACUUM FULL to rewrite table files
  await db.execute(sql`VACUUM FULL client_uptime_buckets`)
  await db.execute(sql`VACUUM FULL client_snapshots`)
  await db.execute(sql`VACUUM FULL tracker_snapshots`)
  await db.execute(sql`VACUUM FULL tracker_roles`)
  await db.execute(sql`VACUUM FULL tag_group_members`)
  await db.execute(sql`VACUUM FULL tag_groups`)
  await db.execute(sql`VACUUM FULL download_clients`)
  await db.execute(sql`VACUUM FULL trackers`)
  await db.execute(sql`VACUUM FULL app_settings`)
  await db.execute(sql`VACUUM FULL backup_history`)
}
