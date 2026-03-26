// src/app/api/settings/backup/restore/route.ts
//
// Functions: batchInsert, POST, hashFileName, reencryptField

import { createHash } from "node:crypto"
import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import { authenticate } from "@/lib/api-helpers"
import { verifyPassword } from "@/lib/auth"
import {
  type BackupPayload,
  decryptBackupPayload,
  type EncryptedBackupEnvelope,
  validateBackupJson,
} from "@/lib/backup"
import { deriveKey, reencrypt } from "@/lib/crypto"
import { db } from "@/lib/db"
import {
  appSettings,
  clientSnapshots,
  clientUptimeBuckets,
  dismissedAlerts,
  downloadClients,
  notificationDeliveryState,
  notificationTargets,
  tagGroupMembers,
  tagGroups,
  trackerRoles,
  trackerSnapshots,
  trackers,
} from "@/lib/db/schema"
import { checkLockout, recordFailedAttempt, resetFailedAttempts } from "@/lib/lockout"
import { log } from "@/lib/logger"
import { stopScheduler } from "@/lib/scheduler"

const BATCH_SIZE = 500

type TxType = Parameters<typeof db.transaction>[0] extends (tx: infer T) => unknown ? T : never

function hashFileName(fileName: string): string {
  return createHash("sha256").update(fileName).digest("hex").substring(0, 16)
}

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

// Attempt to decrypt a field with the backup key and re-encrypt with the current key.
// Returns the re-encrypted ciphertext, or "" if the field is empty or re-encryption fails.
function reencryptField(ciphertext: string, backupKey: Buffer, currentKey: Buffer): string {
  if (!ciphertext) return ""
  try {
    return reencrypt(ciphertext, backupKey, currentKey)
  } catch {
    return ""
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
  const masterPassword = formData.get("masterPassword")
  const backupPassword = formData.get("backupPassword")

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

  // Step 3: Verify master password is present before parsing the backup payload.
  if (
    !masterPassword ||
    typeof masterPassword !== "string" ||
    masterPassword.length === 0 ||
    masterPassword.length > 128
  ) {
    return NextResponse.json(
      { error: "Master password is required to restore backups" },
      { status: 400 }
    )
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
  let isEncrypted = false
  try {
    const envelope = raw as Record<string, unknown>
    if (envelope.format === "tracker-tracker-encrypted-backup") {
      isEncrypted = true
      if (!backupPassword || typeof backupPassword !== "string" || backupPassword.length === 0) {
        return NextResponse.json(
          { error: "Backup password is required for encrypted backups" },
          { status: 400 }
        )
      }
      if (backupPassword.length > 128) {
        return NextResponse.json(
          { error: "Backup password must be 128 characters or fewer" },
          { status: 400 }
        )
      }

      const backupEnvelope = envelope as unknown as EncryptedBackupEnvelope
      if (!backupEnvelope.encryptionSalt || typeof backupEnvelope.encryptionSalt !== "string") {
        throw new Error("Missing or invalid encryptionSalt in backup envelope")
      }

      const decryptionKey = await deriveKey(backupPassword, backupEnvelope.encryptionSalt)
      payload = decryptBackupPayload(backupEnvelope, decryptionKey)
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

  // Step 5: Get current settings for ID
  const [currentSettings] = await db.select().from(appSettings).limit(1)
  if (!currentSettings) {
    return NextResponse.json({ error: "Not configured" }, { status: 400 })
  }

  const lockout = checkLockout(currentSettings)
  if (lockout) return lockout

  const isPasswordValid = await verifyPassword(currentSettings.passwordHash, masterPassword)
  if (!isPasswordValid) {
    await recordFailedAttempt(currentSettings.id, currentSettings)

    const fileName = file instanceof File ? file.name : "unknown"
    log.warn(
      {
        event: "restore_unauthorized",
        reason: "invalid_master_password",
        fileNameHash: hashFileName(fileName),
        encrypted: isEncrypted,
      },
      "Restore attempt with invalid master password"
    )

    return NextResponse.json({ error: "Invalid master password" }, { status: 401 })
  }

  await resetFailedAttempts(currentSettings.id)

  const fileName = file instanceof File ? file.name : "unknown"
  log.info(
    {
      event: "restore_starting",
      fileNameHash: hashFileName(fileName),
      fileSize: file.size,
      encrypted: isEncrypted,
    },
    "Restore operation authorized and starting"
  )

  // Step 6: Derive encryption keys for token re-encryption.
  // The backup's encryptionSalt may differ from the current instance's salt (e.g. after a
  // nuke + re-setup). We derive the backup key from masterPassword + backupSalt, and the
  // current key from masterPassword + currentSalt. If the salts match, the keys are identical
  // and re-encryption is a no-op pass-through.
  const backupSalt = payload.settings.encryptionSalt as string
  const currentSalt = currentSettings.encryptionSalt
  const sameSalt = backupSalt === currentSalt

  let backupKey: Buffer
  let currentKey: Buffer
  try {
    backupKey = await deriveKey(masterPassword, backupSalt)
    currentKey = sameSalt ? backupKey : await deriveKey(masterPassword, currentSalt)
  } catch (err) {
    log.warn({ err }, "Backup restore: key derivation failed, encrypted fields will be cleared")
    backupKey = Buffer.alloc(0)
    currentKey = Buffer.alloc(0)
  }

  const canReencrypt = backupKey.length === 32

  // Step 7: Stop schedulers (key is zeroed inside stopScheduler)
  stopScheduler()

  // Step 8: Execute restore in a transaction
  const currentSettingsId = currentSettings.id
  let tokensPreserved = 0
  let tokensCleared = 0
  let clientCredentialsCleared = 0
  let totpDisabledOnRestore = false

  try {
    await db.transaction(async (tx) => {
      // Delete all existing data — FK-safe order (children before parents)
      await tx.delete(dismissedAlerts)
      await tx.delete(clientUptimeBuckets)
      await tx.delete(clientSnapshots)
      await tx.delete(trackerSnapshots)
      await tx.delete(trackerRoles)
      await tx.delete(tagGroupMembers)
      await tx.delete(tagGroups)
      await tx.delete(notificationDeliveryState)
      await tx.delete(notificationTargets)
      await tx.delete(downloadClients)
      await tx.delete(trackers)

      // Insert trackers with token re-encryption
      const trackerIdMap = new Map<number, number>()
      for (const t of payload.trackers) {
        const { id: oldId, ...fields } = t as Record<string, unknown> & { id: number }

        let apiToken: string
        if (sameSalt) {
          // Same instance — keep ciphertext as-is
          apiToken = (fields.encryptedApiToken as string) || ""
        } else if (canReencrypt) {
          apiToken = reencryptField(fields.encryptedApiToken as string, backupKey, currentKey)
        } else {
          apiToken = ""
        }

        if (apiToken) tokensPreserved++
        else if (fields.encryptedApiToken) tokensCleared++

        const [inserted] = await tx
          .insert(trackers)
          .values({
            name: fields.name as string,
            baseUrl: fields.baseUrl as string,
            apiPath: fields.apiPath as string,
            platformType: fields.platformType as string,
            encryptedApiToken: apiToken,
            isActive: fields.isActive as boolean,
            color: (fields.color as string | null) ?? null,
            qbtTag: (fields.qbtTag as string | null) ?? null,
            remoteUserId: (fields.remoteUserId as number | null) ?? null,
            platformMeta: (fields.platformMeta as string | null) ?? null,
            avatarData: (fields.avatarData as string | null) ?? null,
            avatarCachedAt: fields.avatarCachedAt
              ? new Date(fields.avatarCachedAt as string)
              : null,
            avatarRemoteUrl: (fields.avatarRemoteUrl as string | null) ?? null,
            useProxy: fields.useProxy as boolean,
            countCrossSeedUnsatisfied: (fields.countCrossSeedUnsatisfied as boolean) ?? false,
            isFavorite: (fields.isFavorite as boolean) ?? false,
            sortOrder: (fields.sortOrder as number | null) ?? null,
            joinedAt: (fields.joinedAt as string | null) ?? null,
            createdAt: new Date(fields.createdAt as string),
            updatedAt: new Date(fields.updatedAt as string),
          })
          .returning({ id: trackers.id })
        trackerIdMap.set(oldId, inserted.id)
      }

      // Insert downloadClients with credential re-encryption
      const clientIdMap = new Map<number, number>()
      for (const c of payload.downloadClients) {
        const { id: oldId, ...fields } = c as Record<string, unknown> & { id: number }

        let encUsername: string
        let encPassword: string
        if (sameSalt) {
          encUsername = (fields.encryptedUsername as string) || ""
          encPassword = (fields.encryptedPassword as string) || ""
        } else if (canReencrypt) {
          encUsername = reencryptField(fields.encryptedUsername as string, backupKey, currentKey)
          encPassword = reencryptField(fields.encryptedPassword as string, backupKey, currentKey)
        } else {
          encUsername = ""
          encPassword = ""
        }

        const credentialsCleared = !encUsername || !encPassword
        const [inserted] = await tx
          .insert(downloadClients)
          .values({
            name: fields.name as string,
            type: fields.type as string,
            enabled: credentialsCleared ? false : (fields.enabled as boolean),
            host: fields.host as string,
            port: fields.port as number,
            useSsl: fields.useSsl as boolean,
            encryptedUsername: encUsername,
            encryptedPassword: encPassword,
            pollIntervalSeconds: fields.pollIntervalSeconds as number,
            isDefault: fields.isDefault as boolean,
            crossSeedTags: Array.isArray(fields.crossSeedTags)
              ? (fields.crossSeedTags as string[])
              : (() => {
                  try {
                    return JSON.parse(fields.crossSeedTags as string) as string[]
                  } catch {
                    return []
                  }
                })(),
            lastError: credentialsCleared
              ? "Credentials cleared during restore — re-enter and re-enable"
              : null,
            createdAt: new Date(fields.createdAt as string),
            updatedAt: new Date(fields.updatedAt as string),
          })
          .returning({ id: downloadClients.id })
        clientIdMap.set(oldId, inserted.id)
        if (credentialsCleared) clientCredentialsCleared++
      }

      // Insert tagGroups
      const tagGroupIdMap = new Map<number, number>()
      for (const g of payload.tagGroups) {
        const { id: oldId, ...fields } = g as Record<string, unknown> & { id: number }
        const [inserted] = await tx
          .insert(tagGroups)
          .values({
            name: fields.name as string,
            emoji: (fields.emoji as string | null) ?? null,
            chartType: (fields.chartType as string) ?? "bar",
            description: (fields.description as string | null) ?? null,
            sortOrder: (fields.sortOrder as number) ?? 0,
            countUnmatched: (fields.countUnmatched as boolean) ?? false,
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
        if (!newTrackerId) continue
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
          requiredRatio: (fields.requiredRatio as number | null) ?? null,
          warned: (fields.warned as boolean | null) ?? null,
          freeleechTokens: (fields.freeleechTokens as number | null) ?? null,
          shareScore: (fields.shareScore as number | null) ?? null,
          username: (fields.username as string | null) ?? null,
          group: (fields.group as string | null) ?? null,
        })
      }
      await batchInsert(tx, trackerSnapshots, snapshotRows)

      // Insert trackerRoles (remap trackerId)
      for (const r of payload.trackerRoles) {
        const fields = r as Record<string, unknown>
        const newTrackerId = trackerIdMap.get(fields.trackerId as number)
        if (!newTrackerId) continue
        await tx.insert(trackerRoles).values({
          trackerId: newTrackerId,
          roleName: fields.roleName as string,
          achievedAt: new Date(fields.achievedAt as string),
          notes: (fields.notes as string | null) ?? null,
        })
      }

      // Insert tagGroupMembers (remap groupId)
      for (const m of payload.tagGroupMembers) {
        const fields = m as Record<string, unknown>
        const newGroupId = tagGroupIdMap.get(fields.groupId as number)
        if (!newGroupId) continue
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
        if (!newClientId) continue
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

      // Batch insert clientUptimeBuckets (remap clientId, optional for older backups)
      if (Array.isArray(payload.clientUptimeBuckets) && payload.clientUptimeBuckets.length > 0) {
        const uptimeRows: { clientId: number; bucketTs: Date; ok: number; fail: number }[] = []
        for (const ub of payload.clientUptimeBuckets) {
          const fields = ub as Record<string, unknown>
          const newClientId = clientIdMap.get(fields.clientId as number)
          if (!newClientId) continue
          uptimeRows.push({
            clientId: newClientId,
            bucketTs: new Date(fields.bucketTs as string),
            ok: (fields.ok as number) ?? 0,
            fail: (fields.fail as number) ?? 0,
          })
        }
        for (let i = 0; i < uptimeRows.length; i += BATCH_SIZE) {
          const batch = uptimeRows.slice(i, i + BATCH_SIZE)
          if (batch.length > 0) {
            await tx.insert(clientUptimeBuckets).values(batch).onConflictDoNothing()
          }
        }
      }

      // Insert dismissedAlerts (optional — absent in older backups)
      if (Array.isArray(payload.dismissedAlerts) && payload.dismissedAlerts.length > 0) {
        const alertRows: { alertKey: string; alertType: string; dismissedAt: Date }[] = []
        for (const a of payload.dismissedAlerts) {
          const fields = a as Record<string, unknown>
          if (typeof fields.alertKey !== "string" || typeof fields.alertType !== "string") continue
          alertRows.push({
            alertKey: fields.alertKey,
            alertType: fields.alertType,
            dismissedAt: fields.dismissedAt ? new Date(fields.dismissedAt as string) : new Date(),
          })
        }
        for (let i = 0; i < alertRows.length; i += BATCH_SIZE) {
          const batch = alertRows.slice(i, i + BATCH_SIZE)
          if (batch.length > 0) {
            await tx.insert(dismissedAlerts).values(batch).onConflictDoNothing()
          }
        }
      }

      // Insert notificationTargets with config re-encryption (optional — absent in older backups)
      if (Array.isArray(payload.notificationTargets) && payload.notificationTargets.length > 0) {
        for (const nt of payload.notificationTargets) {
          const { id: _id, ...fields } = nt as Record<string, unknown> & { id: number }

          let encryptedConfig: string
          if (sameSalt) {
            encryptedConfig = (fields.encryptedConfig as string) || ""
          } else if (canReencrypt) {
            encryptedConfig = reencryptField(
              fields.encryptedConfig as string,
              backupKey,
              currentKey
            )
          } else {
            encryptedConfig = ""
          }

          const configCleared = !encryptedConfig
          await tx.insert(notificationTargets).values({
            name: fields.name as string,
            type: fields.type as string,
            enabled: configCleared ? false : (fields.enabled as boolean),
            encryptedConfig,
            notifyRatioDrop: (fields.notifyRatioDrop as boolean) ?? false,
            notifyHitAndRun: (fields.notifyHitAndRun as boolean) ?? false,
            notifyTrackerDown: (fields.notifyTrackerDown as boolean) ?? false,
            notifyBufferMilestone: (fields.notifyBufferMilestone as boolean) ?? false,
            notifyWarned: (fields.notifyWarned as boolean) ?? false,
            notifyRatioDanger: (fields.notifyRatioDanger as boolean) ?? false,
            notifyZeroSeeding: (fields.notifyZeroSeeding as boolean) ?? false,
            notifyRankChange: (fields.notifyRankChange as boolean) ?? false,
            notifyAnniversary: (fields.notifyAnniversary as boolean) ?? false,
            thresholds: (fields.thresholds as Record<string, unknown> | null) ?? null,
            includeTrackerName: (fields.includeTrackerName as boolean) ?? true,
            scope: (fields.scope as number[] | null) ?? null,
            lastDeliveryError: configCleared
              ? "Config cleared during restore — re-enter and re-enable"
              : null,
            createdAt: new Date(fields.createdAt as string),
            updatedAt: new Date(fields.updatedAt as string),
          })
        }
      }

      // Re-encrypt proxy password if possible
      let proxyPassword: string | null = null
      if (payload.settings.encryptedProxyPassword) {
        if (sameSalt) {
          proxyPassword = payload.settings.encryptedProxyPassword as string
        } else if (canReencrypt) {
          const result = reencryptField(
            payload.settings.encryptedProxyPassword as string,
            backupKey,
            currentKey
          )
          proxyPassword = result || null
        }
      }

      // Re-encrypt backup password if possible
      let backupPasswordEncrypted: string | null = null
      if (payload.settings.encryptedBackupPassword) {
        if (sameSalt) {
          backupPasswordEncrypted = payload.settings.encryptedBackupPassword as string
        } else if (canReencrypt) {
          const result = reencryptField(
            payload.settings.encryptedBackupPassword as string,
            backupKey,
            currentKey
          )
          backupPasswordEncrypted = result || null
        }
      }

      // Re-encrypt image hosting API keys if possible
      let encryptedPtpimgApiKey: string | null = null
      if (payload.settings.encryptedPtpimgApiKey) {
        if (sameSalt) {
          encryptedPtpimgApiKey = payload.settings.encryptedPtpimgApiKey as string
        } else if (canReencrypt) {
          encryptedPtpimgApiKey =
            reencryptField(
              payload.settings.encryptedPtpimgApiKey as string,
              backupKey,
              currentKey
            ) || null
        }
      }

      let encryptedOeimgApiKey: string | null = null
      if (payload.settings.encryptedOeimgApiKey) {
        if (sameSalt) {
          encryptedOeimgApiKey = payload.settings.encryptedOeimgApiKey as string
        } else if (canReencrypt) {
          encryptedOeimgApiKey =
            reencryptField(
              payload.settings.encryptedOeimgApiKey as string,
              backupKey,
              currentKey
            ) || null
        }
      }

      let encryptedImgbbApiKey: string | null = null
      if (payload.settings.encryptedImgbbApiKey) {
        if (sameSalt) {
          encryptedImgbbApiKey = payload.settings.encryptedImgbbApiKey as string
        } else if (canReencrypt) {
          encryptedImgbbApiKey =
            reencryptField(
              payload.settings.encryptedImgbbApiKey as string,
              backupKey,
              currentKey
            ) || null
        }
      }

      // Re-encrypt TOTP secret if possible
      let totpSecret: string | null = null
      let totpBackupCodes: string | null = null
      if (payload.settings.totpSecret) {
        if (sameSalt) {
          totpSecret = payload.settings.totpSecret as string
          totpBackupCodes = (payload.settings.totpBackupCodes as string | null) ?? null
        } else if (canReencrypt) {
          const reencryptedSecret = reencryptField(
            payload.settings.totpSecret as string,
            backupKey,
            currentKey
          )
          if (reencryptedSecret) {
            totpSecret = reencryptedSecret
            totpBackupCodes = payload.settings.totpBackupCodes
              ? reencryptField(payload.settings.totpBackupCodes as string, backupKey, currentKey) ||
                null
              : null
          } else {
            totpDisabledOnRestore = true
          }
        } else {
          totpDisabledOnRestore = true
        }
      }

      // Update appSettings in place — NEVER delete + re-insert
      await tx
        .update(appSettings)
        .set({
          username: (payload.settings.username as string | null) ?? null,
          storeUsernames: payload.settings.storeUsernames as boolean,
          totpSecret,
          totpBackupCodes,
          sessionTimeoutMinutes: (payload.settings.sessionTimeoutMinutes as number | null) ?? null,
          lockoutEnabled: (payload.settings.lockoutEnabled as boolean) ?? true,
          lockoutThreshold: (payload.settings.lockoutThreshold as number) ?? 5,
          lockoutDurationMinutes: (payload.settings.lockoutDurationMinutes as number) ?? 15,
          failedLoginAttempts: 0,
          lockedUntil: null,
          snapshotRetentionDays: (payload.settings.snapshotRetentionDays as number | null) ?? null,
          trackerPollIntervalMinutes: (payload.settings.trackerPollIntervalMinutes as number) ?? 60,
          proxyEnabled: payload.settings.proxyEnabled as boolean,
          proxyType: payload.settings.proxyType as string,
          proxyHost: (payload.settings.proxyHost as string | null) ?? null,
          proxyPort: (payload.settings.proxyPort as number | null) ?? null,
          proxyUsername: (payload.settings.proxyUsername as string | null) ?? null,
          encryptedProxyPassword: proxyPassword,
          qbitmanageEnabled: payload.settings.qbitmanageEnabled as boolean,
          qbitmanageTags: (payload.settings.qbitmanageTags as string | null) ?? null,
          backupScheduleEnabled: payload.settings.backupScheduleEnabled as boolean,
          backupScheduleFrequency: payload.settings.backupScheduleFrequency as string,
          backupRetentionCount: payload.settings.backupRetentionCount as number,
          backupEncryptionEnabled: payload.settings.backupEncryptionEnabled as boolean,
          encryptedBackupPassword: backupPasswordEncrypted,
          backupStoragePath: (payload.settings.backupStoragePath as string | null) ?? null,
          encryptedPtpimgApiKey,
          encryptedOeimgApiKey,
          encryptedImgbbApiKey,
          draftQuicklinks: (payload.settings.draftQuicklinks as string | null) ?? null,
          dashboardSettings: (payload.settings.dashboardSettings as string | null) ?? null,
          // passwordHash: NEVER updated from backup
          // encryptionSalt: NEVER updated from backup
          encryptedSchedulerKey: null,
        })
        .where(eq(appSettings.id, currentSettingsId))
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"

    log.error(
      {
        event: "restore_failed",
        error: message,
        fileNameHash: hashFileName(fileName),
      },
      "Restore operation failed"
    )

    return NextResponse.json(
      { error: "Restore failed. Check server logs for details." },
      { status: 409 }
    )
  } finally {
    if (backupKey.length > 0) backupKey.fill(0)
    if (currentKey !== backupKey && currentKey.length > 0) currentKey.fill(0)
  }

  if (totpDisabledOnRestore) {
    log.warn(
      { event: "restore_totp_cleared" },
      "TOTP secret could not be re-encrypted — 2FA has been disabled"
    )
  }

  log.info(
    {
      event: "restore_completed",
      fileNameHash: hashFileName(fileName),
      tokensPreserved,
      tokensCleared,
      clientCredentialsCleared,
      totpDisabledOnRestore,
      restored: {
        trackers: payload.trackers.length,
        trackerSnapshots: payload.trackerSnapshots.length,
        trackerRoles: payload.trackerRoles.length,
        downloadClients: payload.downloadClients.length,
        tagGroups: payload.tagGroups.length,
        dismissedAlerts: Array.isArray(payload.dismissedAlerts)
          ? payload.dismissedAlerts.length
          : 0,
        notificationTargets: Array.isArray(payload.notificationTargets)
          ? payload.notificationTargets.length
          : 0,
      },
    },
    "Restore operation completed successfully"
  )

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
      clientUptimeBuckets: Array.isArray(payload.clientUptimeBuckets)
        ? payload.clientUptimeBuckets.length
        : 0,
      dismissedAlerts: Array.isArray(payload.dismissedAlerts) ? payload.dismissedAlerts.length : 0,
      notificationTargets: Array.isArray(payload.notificationTargets)
        ? payload.notificationTargets.length
        : 0,
    },
    tokensPreserved,
    tokensCleared,
    clientCredentialsCleared,
    totpDisabledOnRestore,
    requiresRelogin: false,
  })
}
