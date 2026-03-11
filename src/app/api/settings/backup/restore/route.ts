// src/app/api/settings/backup/restore/route.ts
//
// Functions: batchInsert, POST

import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import { authenticate, decodeKey } from "@/lib/api-helpers"
import { clearSession, verifyPassword } from "@/lib/auth"
import {
  type BackupPayload,
  decryptBackupPayload,
  type EncryptedBackupEnvelope,
  validateBackupJson,
} from "@/lib/backup"
import { db } from "@/lib/db"
import {
  appSettings,
  clientSnapshots,
  downloadClients,
  tagGroupMembers,
  tagGroups,
  trackerRoles,
  trackerSnapshots,
  trackers,
} from "@/lib/db/schema"
import { stopScheduler } from "@/lib/scheduler"

const BATCH_SIZE = 500

type TxType = Parameters<typeof db.transaction>[0] extends (tx: infer T) => unknown ? T : never

async function batchInsert<T extends Record<string, unknown>>(
  tx: TxType,
  table: Parameters<TxType["insert"]>[0],
  rows: T[]
): Promise<void> {
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE)
    if (batch.length > 0) {
      await tx.insert(table).values(batch)
    }
  }
}

export async function POST(request: Request) {
  // Step 1: Authenticate
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  // Step 2: Parse multipart form data
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 })
  }

  const file = formData.get("file")
  const password = formData.get("password")

  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "Backup file is required" }, { status: 400 })
  }

  const MAX_BACKUP_SIZE = 50 * 1024 * 1024 // 50 MB
  if (file.size > MAX_BACKUP_SIZE) {
    return NextResponse.json(
      { error: "Backup file exceeds maximum size of 50 MB" },
      { status: 400 }
    )
  }

  if (!password || typeof password !== "string" || password.length === 0) {
    return NextResponse.json({ error: "Master password is required" }, { status: 400 })
  }

  // Step 3: Verify master password
  const [currentSettings] = await db.select().from(appSettings).limit(1)
  if (!currentSettings) {
    return NextResponse.json({ error: "Not configured" }, { status: 400 })
  }

  const valid = await verifyPassword(currentSettings.passwordHash, password)
  if (!valid) {
    // CRITICAL: do NOT call recordFailedAttempt() — this is intent confirmation, not a login
    return NextResponse.json({ error: "Incorrect password" }, { status: 403 })
  }

  // Step 4: Parse and validate backup JSON
  let text: string
  try {
    text = await (file as Blob).text()
  } catch {
    return NextResponse.json({ error: "Failed to read backup file" }, { status: 400 })
  }

  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return NextResponse.json({ error: "Invalid JSON in backup file" }, { status: 400 })
  }

  let payload: BackupPayload
  try {
    const envelope = raw as Record<string, unknown>
    if (envelope.format === "tracker-tracker-encrypted-backup") {
      const key = decodeKey(auth)
      payload = decryptBackupPayload(envelope as unknown as EncryptedBackupEnvelope, key)
    } else {
      validateBackupJson(raw)
      payload = raw as BackupPayload
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json(
      { error: `Invalid or corrupted backup file: ${message}` },
      { status: 400 }
    )
  }

  // Step 5: Stop schedulers (key is zeroed inside stopScheduler)
  stopScheduler()

  // Step 6: Execute restore in a transaction
  const currentSettingsId = currentSettings.id

  try {
    await db.transaction(async (tx) => {
      // Delete all existing data — FK-safe order (children before parents)
      await tx.delete(clientSnapshots)
      await tx.delete(trackerSnapshots)
      await tx.delete(trackerRoles)
      await tx.delete(tagGroupMembers)
      await tx.delete(tagGroups)
      await tx.delete(downloadClients)
      await tx.delete(trackers)
      // appSettings is NOT deleted — updated in place below

      // Insert trackers and build oldId → newId map
      const trackerIdMap = new Map<number, number>()
      for (const t of payload.trackers) {
        const { id: oldId, ...fields } = t as Record<string, unknown> & { id: number }
        const [inserted] = await tx
          .insert(trackers)
          .values({
            name: fields.name as string,
            baseUrl: fields.baseUrl as string,
            apiPath: fields.apiPath as string,
            platformType: fields.platformType as string,
            encryptedApiToken: fields.encryptedApiToken as string,
            isActive: fields.isActive as boolean,
            color: (fields.color as string | null) ?? null,
            qbtTag: (fields.qbtTag as string | null) ?? null,
            useProxy: fields.useProxy as boolean,
            sortOrder: (fields.sortOrder as number | null) ?? null,
            joinedAt: (fields.joinedAt as string | null) ?? null,
            createdAt: new Date(fields.createdAt as string),
            updatedAt: new Date(fields.updatedAt as string),
          })
          .returning({ id: trackers.id })
        trackerIdMap.set(oldId, inserted.id)
      }

      // Insert downloadClients and build oldId → newId map
      const clientIdMap = new Map<number, number>()
      for (const c of payload.downloadClients) {
        const { id: oldId, ...fields } = c as Record<string, unknown> & { id: number }
        const [inserted] = await tx
          .insert(downloadClients)
          .values({
            name: fields.name as string,
            type: fields.type as string,
            enabled: fields.enabled as boolean,
            host: fields.host as string,
            port: fields.port as number,
            useSsl: fields.useSsl as boolean,
            encryptedUsername: fields.encryptedUsername as string,
            encryptedPassword: fields.encryptedPassword as string,
            pollIntervalSeconds: fields.pollIntervalSeconds as number,
            isDefault: fields.isDefault as boolean,
            crossSeedTags: (fields.crossSeedTags as string) ?? "[]",
            createdAt: new Date(fields.createdAt as string),
            updatedAt: new Date(fields.updatedAt as string),
          })
          .returning({ id: downloadClients.id })
        clientIdMap.set(oldId, inserted.id)
      }

      // Insert tagGroups and build oldId → newId map
      const tagGroupIdMap = new Map<number, number>()
      for (const g of payload.tagGroups) {
        const { id: oldId, ...fields } = g as Record<string, unknown> & { id: number }
        const [inserted] = await tx
          .insert(tagGroups)
          .values({
            name: fields.name as string,
            description: (fields.description as string | null) ?? null,
            sortOrder: (fields.sortOrder as number) ?? 0,
            createdAt: new Date(fields.createdAt as string),
            updatedAt: new Date(fields.updatedAt as string),
          })
          .returning({ id: tagGroups.id })
        tagGroupIdMap.set(oldId, inserted.id)
      }

      // Batch insert trackerSnapshots (remap trackerId)
      const snapshotRows: Record<string, unknown>[] = []
      for (const s of payload.trackerSnapshots) {
        const fields = s as Record<string, unknown>
        const newTrackerId = trackerIdMap.get(fields.trackerId as number)
        if (!newTrackerId) continue // orphaned snapshot — skip
        snapshotRows.push({
          trackerId: newTrackerId,
          polledAt: new Date(fields.polledAt as string),
          uploadedBytes: BigInt(fields.uploadedBytes as string),
          downloadedBytes: BigInt(fields.downloadedBytes as string),
          ratio: (fields.ratio as number | null) ?? null,
          bufferBytes: fields.bufferBytes ? BigInt(fields.bufferBytes as string) : null,
          seedingCount: (fields.seedingCount as number | null) ?? null,
          leechingCount: (fields.leechingCount as number | null) ?? null,
          seedbonus: (fields.seedbonus as number | null) ?? null,
          hitAndRuns: (fields.hitAndRuns as number | null) ?? null,
          username: (fields.username as string | null) ?? null,
          group: (fields.group as string | null) ?? null,
        })
      }
      await batchInsert(tx, trackerSnapshots, snapshotRows)

      // Insert trackerRoles (remap trackerId; small table)
      for (const r of payload.trackerRoles) {
        const fields = r as Record<string, unknown>
        const newTrackerId = trackerIdMap.get(fields.trackerId as number)
        if (!newTrackerId) continue // orphaned role — skip
        await tx.insert(trackerRoles).values({
          trackerId: newTrackerId,
          roleName: fields.roleName as string,
          achievedAt: new Date(fields.achievedAt as string),
          notes: (fields.notes as string | null) ?? null,
        })
      }

      // Insert tagGroupMembers (remap groupId; small table)
      for (const m of payload.tagGroupMembers) {
        const fields = m as Record<string, unknown>
        const newGroupId = tagGroupIdMap.get(fields.groupId as number)
        if (!newGroupId) continue // orphaned member — skip
        await tx.insert(tagGroupMembers).values({
          groupId: newGroupId,
          tag: fields.tag as string,
          label: fields.label as string,
          color: (fields.color as string | null) ?? null,
          sortOrder: (fields.sortOrder as number) ?? 0,
        })
      }

      // Batch insert clientSnapshots (remap clientId)
      const clientSnapshotRows: Record<string, unknown>[] = []
      for (const cs of payload.clientSnapshots) {
        const fields = cs as Record<string, unknown>
        const newClientId = clientIdMap.get(fields.clientId as number)
        if (!newClientId) continue // orphaned snapshot — skip
        clientSnapshotRows.push({
          clientId: newClientId,
          polledAt: new Date(fields.polledAt as string),
          totalSeedingCount: (fields.totalSeedingCount as number | null) ?? null,
          totalLeechingCount: (fields.totalLeechingCount as number | null) ?? null,
          uploadSpeedBytes: fields.uploadSpeedBytes
            ? BigInt(fields.uploadSpeedBytes as string)
            : null,
          downloadSpeedBytes: fields.downloadSpeedBytes
            ? BigInt(fields.downloadSpeedBytes as string)
            : null,
          tagStats: (fields.tagStats as string | null) ?? null,
        })
      }
      await batchInsert(tx, clientSnapshots, clientSnapshotRows)

      // Update appSettings in place — NEVER delete + re-insert
      await tx
        .update(appSettings)
        .set({
          encryptionSalt: payload.settings.encryptionSalt as string,
          username: (payload.settings.username as string | null) ?? null,
          storeUsernames: payload.settings.storeUsernames as boolean,
          totpSecret: (payload.settings.totpSecret as string | null) ?? null,
          totpBackupCodes: (payload.settings.totpBackupCodes as string | null) ?? null,
          sessionTimeoutMinutes:
            (payload.settings.sessionTimeoutMinutes as number | null) ?? null,
          autoWipeThreshold:
            (payload.settings.autoWipeThreshold as number | null) ?? null,
          failedLoginAttempts: 0, // ALWAYS reset — never restore the backup's counter
          snapshotRetentionDays:
            (payload.settings.snapshotRetentionDays as number | null) ?? null,
          proxyEnabled: payload.settings.proxyEnabled as boolean,
          proxyType: payload.settings.proxyType as string,
          proxyHost: (payload.settings.proxyHost as string | null) ?? null,
          proxyPort: (payload.settings.proxyPort as number | null) ?? null,
          proxyUsername: (payload.settings.proxyUsername as string | null) ?? null,
          encryptedProxyPassword:
            (payload.settings.encryptedProxyPassword as string | null) ?? null,
          qbitmanageEnabled: payload.settings.qbitmanageEnabled as boolean,
          qbitmanageTags: (payload.settings.qbitmanageTags as string | null) ?? null,
          backupScheduleEnabled: payload.settings.backupScheduleEnabled as boolean,
          backupScheduleFrequency: payload.settings.backupScheduleFrequency as string,
          backupRetentionCount: payload.settings.backupRetentionCount as number,
          backupEncryptionEnabled: payload.settings.backupEncryptionEnabled as boolean,
          backupStoragePath:
            (payload.settings.backupStoragePath as string | null) ?? null,
          // passwordHash: NEVER updated from backup
        })
        .where(eq(appSettings.id, currentSettingsId))
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json(
      { error: `Restore failed: ${message}` },
      { status: 409 }
    )
  }

  // Step 7: Clear session — encryptionSalt changed, current key is now wrong
  await clearSession()

  // Step 8: Return success
  return NextResponse.json({
    success: true,
    restored: {
      trackers: payload.trackers.length,
      trackerSnapshots: payload.trackerSnapshots.length,
      trackerRoles: payload.trackerRoles.length,
      downloadClients: payload.downloadClients.length,
      tagGroups: payload.tagGroups.length,
      tagGroupMembers: payload.tagGroupMembers.length,
      clientSnapshots: payload.clientSnapshots.length,
    },
    requiresRelogin: true,
  })
}
