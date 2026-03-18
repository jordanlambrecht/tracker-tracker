// src/lib/nuke.ts
//
// Functions: scrubAndDeleteAll

import { randomBytes } from "node:crypto"
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
      username: null,
      totpSecret: null,
      totpBackupCodes: null,
      encryptedProxyPassword: null,
      encryptedBackupPassword: null,
    })

    await tx.update(downloadClients).set({
      encryptedUsername: randomHex(64),
      encryptedPassword: randomHex(64),
      name: randomHex(8),
      host: randomHex(16),
      lastError: null,
    })

    await tx.delete(clientUptimeBuckets)
    await tx.delete(clientSnapshots)
    await tx.delete(trackerSnapshots)
    await tx.delete(trackerRoles)
    await tx.delete(tagGroupMembers)
    await tx.delete(tagGroups)
    await tx.delete(downloadClients)
    await tx.delete(trackers)
    await tx.delete(appSettings)
  })
}
