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
    encryptedBackupPassword: null,
  })

  await db.update(downloadClients).set({
    encryptedUsername: randomHex(64),
    encryptedPassword: randomHex(64),
    name: randomHex(8),
    host: randomHex(16),
    lastError: null,
  })

  await db.delete(clientUptimeBuckets)
  await db.delete(clientSnapshots)
  await db.delete(trackerSnapshots)
  await db.delete(trackerRoles)
  await db.delete(tagGroupMembers)
  await db.delete(tagGroups)
  await db.delete(downloadClients)
  await db.delete(trackers)
  await db.delete(appSettings)
}
