// src/lib/nuke.ts

import { randomBytes } from "node:crypto"
import { clearAppLivenessState } from "@/lib/app-liveness"
import { db } from "@/lib/db"
import {
  appCoverageGaps,
  appLiveness,
  appSettings,
  clientSnapshots,
  clientUptimeBuckets,
  dismissedAlerts,
  downloadClients,
  notificationDeliveryState,
  notificationTargets,
  tagGroupMembers,
  tagGroups,
  torrentDailyCheckpoints,
  trackerDailyCheckpoints,
  trackerRoles,
  trackerSnapshots,
  trackers,
} from "@/lib/db/schema"
import { stopScheduler } from "@/lib/scheduler"

function randomHex(bytes: number): string {
  return randomBytes(bytes).toString("hex")
}

export async function scrubAndDeleteAll(): Promise<void> {
  stopScheduler()

  await db.transaction(async (tx) => {
    await tx.update(trackerSnapshots).set({
      username: randomHex(16),
      group: randomHex(16),
    })

    await tx.update(trackers).set({
      encryptedApiToken: randomHex(64),
      // NULL, not randomHex. This column's invariant is NULL-or-ciphertext, and
      // a random hex blob is neither: it is truthy, so it would slip past the
      // `if (row.encryptedCredentials)` guards and reach decrypt(). The token
      // column above is NOT NULL and so has no such option; this one does, and
      // NULL is already its designed "no vault" state. Overwriting buys nothing
      // anyway — the rows are deleted at the bottom of this same transaction.
      encryptedCredentials: null,
      name: randomHex(8),
      baseUrl: randomHex(16),
      lastError: null,
      qbtTag: null,
    })

    await tx.update(trackerRoles).set({
      roleName: randomHex(8),
      notes: null,
    })

    await tx.update(appSettings).set({
      passwordHash: randomHex(32),
      encryptionSalt: randomHex(32),
      encryptedSchedulerKey: null,
      username: null,
      totpSecret: null,
      totpBackupCodes: null,
      encryptedProxyPassword: null,
      encryptedBackupPassword: null,
    })

    await tx.update(downloadClients).set({
      encryptedUsername: randomHex(64),
      encryptedPassword: randomHex(64),
      encryptedApiKey: randomHex(64),
      name: randomHex(8),
      host: randomHex(16),
      lastError: null,
    })

    await tx.update(notificationTargets).set({
      encryptedConfig: randomHex(64),
      name: randomHex(8),
      lastDeliveryError: null,
    })

    await tx.delete(dismissedAlerts)
    // Both liveness tables go: they describe when THIS install was collecting,
    // and nothing of that install survives a nuke. The next boot re-establishes
    // firstSeenAt as a fresh floor rather than banding the gap back to the old
    // install's last heartbeat.
    await tx.delete(appCoverageGaps)
    await tx.delete(appLiveness)
    await tx.delete(clientUptimeBuckets)
    await tx.delete(torrentDailyCheckpoints)
    await tx.delete(trackerDailyCheckpoints)
    await tx.delete(clientSnapshots)
    await tx.delete(trackerSnapshots)
    await tx.delete(trackerRoles)
    await tx.delete(tagGroupMembers)
    await tx.delete(tagGroups)
    await tx.delete(notificationDeliveryState)
    await tx.delete(notificationTargets)
    await tx.delete(downloadClients)
    await tx.delete(trackers)
    await tx.delete(appSettings)
  })

  // The in-memory ledger still points at the row that was just deleted; without
  // this, every later write targets a nonexistent id and the ledger silently
  // stops recording until the process restarts.
  clearAppLivenessState()
  ;(globalThis as unknown as Record<string, unknown>).__backfillDone = false
}
