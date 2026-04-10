// src/app/api/auth/change-password/route.ts
//
// Functions: POST
//
// Changes the master password and re-encrypts all encrypted fields
// (tracker API tokens, download client credentials, proxy password,
// backup password, TOTP secrets, image host API keys, notification
// target configs) inside a single transaction.
// Requires an active session and the current password for verification.

import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import { authenticate, decodeKey, parseJsonBody } from "@/lib/api-helpers"
import { clearSession, hashPassword, verifyPassword } from "@/lib/auth"
import { decrypt, deriveKey, encrypt, reencrypt } from "@/lib/crypto"
import { db } from "@/lib/db"
import { appSettings, downloadClients, notificationTargets, trackers } from "@/lib/db/schema"
import { PASSWORD_MAX, PASSWORD_MIN } from "@/lib/limits"
import { recordFailedAttempt, resetFailedAttempts } from "@/lib/lockout"
import { log } from "@/lib/logger"
import { stopScheduler } from "@/lib/scheduler"
import { clearSchedulerKey } from "@/lib/scheduler-key-store"

export async function POST(request: Request) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  const body = await parseJsonBody(request)
  if (body instanceof NextResponse) return body

  const { currentPassword, newPassword } = body as {
    currentPassword?: string
    newPassword?: string
  }

  if (
    !currentPassword ||
    typeof currentPassword !== "string" ||
    currentPassword.length > PASSWORD_MAX
  ) {
    return NextResponse.json({ error: "Current password is required" }, { status: 400 })
  }
  if (
    !newPassword ||
    typeof newPassword !== "string" ||
    newPassword.length < PASSWORD_MIN ||
    newPassword.length > PASSWORD_MAX
  ) {
    return NextResponse.json(
      { error: `New password must be between ${PASSWORD_MIN} and ${PASSWORD_MAX} characters` },
      { status: 400 }
    )
  }

  const [settings] = await db.select().from(appSettings).limit(1)
  if (!settings) {
    return NextResponse.json({ error: "Not configured" }, { status: 400 })
  }

  const valid = await verifyPassword(settings.passwordHash, currentPassword)
  if (!valid) {
    await recordFailedAttempt(settings.id, settings)
    log.warn(
      { route: "POST /api/auth/change-password" },
      "password change rejected — incorrect current password"
    )
    return NextResponse.json({ error: "Current password is incorrect" }, { status: 401 })
  }
  await resetFailedAttempts(settings.id)

  const oldKey = decodeKey(auth)
  const newKey = await deriveKey(newPassword, settings.encryptionSalt)
  const newHash = await hashPassword(newPassword)

  // Pre-flight: decrypt everything outside the transaction to identify
  // already-corrupted items before committing any writes.
  const trackerPlaintexts = new Map<number, string>()
  const clientPlaintexts = new Map<number, { username: string; password: string }>()
  const notificationPlaintexts = new Map<number, string>()
  const failedTrackers: string[] = []
  const failedClients: string[] = []
  const failedNotifications: string[] = []

  const [allTrackers, allClients, allNotifications] = await Promise.all([
    db
      .select({
        id: trackers.id,
        name: trackers.name,
        encryptedApiToken: trackers.encryptedApiToken,
      })
      .from(trackers),
    db
      .select({
        id: downloadClients.id,
        name: downloadClients.name,
        encryptedUsername: downloadClients.encryptedUsername,
        encryptedPassword: downloadClients.encryptedPassword,
      })
      .from(downloadClients),
    db
      .select({
        id: notificationTargets.id,
        name: notificationTargets.name,
        encryptedConfig: notificationTargets.encryptedConfig,
      })
      .from(notificationTargets),
  ])

  for (const tracker of allTrackers) {
    try {
      trackerPlaintexts.set(tracker.id, decrypt(tracker.encryptedApiToken, oldKey))
    } catch (err) {
      log.warn(
        { trackerId: tracker.id, error: String(err) },
        "Failed to decrypt tracker API token during password change"
      )
      failedTrackers.push(tracker.name)
    }
  }

  for (const client of allClients) {
    try {
      clientPlaintexts.set(client.id, {
        username: decrypt(client.encryptedUsername, oldKey),
        password: decrypt(client.encryptedPassword, oldKey),
      })
    } catch (err) {
      log.warn(
        { clientId: client.id, error: String(err) },
        "Failed to decrypt client credentials during password change"
      )
      failedClients.push(client.name)
    }
  }

  for (const nt of allNotifications) {
    try {
      notificationPlaintexts.set(nt.id, decrypt(nt.encryptedConfig, oldKey))
    } catch (err) {
      log.warn(
        { targetId: nt.id, error: String(err) },
        "Failed to decrypt notification config during password change"
      )
      failedNotifications.push(nt.name)
    }
  }

  const settingsUpdates: Record<string, unknown> = {}
  const warnings: string[] = []
  let totpDisabled = false

  if (settings.totpSecret) {
    try {
      settingsUpdates.totpSecret = reencrypt(settings.totpSecret, oldKey, newKey)
    } catch (err) {
      log.warn(
        { error: String(err) },
        "TOTP secret re-encryption failed during password change, disabling 2FA"
      )
      settingsUpdates.totpSecret = null
      settingsUpdates.totpBackupCodes = null
      totpDisabled = true
    }
  }
  if (settings.totpBackupCodes && !settingsUpdates.totpBackupCodes && !totpDisabled) {
    try {
      settingsUpdates.totpBackupCodes = reencrypt(settings.totpBackupCodes, oldKey, newKey)
    } catch (err) {
      log.warn(
        { error: String(err) },
        "TOTP backup codes re-encryption failed during password change"
      )
      settingsUpdates.totpBackupCodes = null
    }
  }

  if (settings.encryptedProxyPassword) {
    try {
      settingsUpdates.encryptedProxyPassword = reencrypt(
        settings.encryptedProxyPassword,
        oldKey,
        newKey
      )
    } catch {
      settingsUpdates.encryptedProxyPassword = null
      warnings.push(
        "Proxy password could not be re-encrypted and was cleared. Re-enter it in settings."
      )
    }
  }

  if (settings.encryptedBackupPassword) {
    try {
      settingsUpdates.encryptedBackupPassword = reencrypt(
        settings.encryptedBackupPassword,
        oldKey,
        newKey
      )
    } catch {
      settingsUpdates.encryptedBackupPassword = null
      warnings.push(
        "Backup password could not be re-encrypted and was cleared. Re-set it in backup settings."
      )
    }
  }

  if (settings.encryptedPtpimgApiKey) {
    try {
      settingsUpdates.encryptedPtpimgApiKey = reencrypt(
        settings.encryptedPtpimgApiKey,
        oldKey,
        newKey
      )
    } catch {
      settingsUpdates.encryptedPtpimgApiKey = null
      warnings.push(
        "PTPImg API key could not be re-encrypted and was cleared. Re-enter it in settings."
      )
    }
  }

  if (settings.encryptedOeimgApiKey) {
    try {
      settingsUpdates.encryptedOeimgApiKey = reencrypt(
        settings.encryptedOeimgApiKey,
        oldKey,
        newKey
      )
    } catch {
      settingsUpdates.encryptedOeimgApiKey = null
      warnings.push(
        "OEImg API key could not be re-encrypted and was cleared. Re-enter it in settings."
      )
    }
  }

  if (settings.encryptedImgbbApiKey) {
    try {
      settingsUpdates.encryptedImgbbApiKey = reencrypt(
        settings.encryptedImgbbApiKey,
        oldKey,
        newKey
      )
    } catch {
      settingsUpdates.encryptedImgbbApiKey = null
      warnings.push(
        "ImgBB API key could not be re-encrypted and was cleared. Re-enter it in settings."
      )
    }
  }

  // All decrypts done. Write phase is all-or-nothing inside a transaction.
  // Only items that successfully decrypted are re-encrypted and committed.
  try {
    await db.transaction(async (tx) => {
      for (const [id, plainToken] of trackerPlaintexts) {
        await tx
          .update(trackers)
          .set({ encryptedApiToken: encrypt(plainToken, newKey) })
          .where(eq(trackers.id, id))
      }

      for (const [id, creds] of clientPlaintexts) {
        await tx
          .update(downloadClients)
          .set({
            encryptedUsername: encrypt(creds.username, newKey),
            encryptedPassword: encrypt(creds.password, newKey),
          })
          .where(eq(downloadClients.id, id))
      }

      for (const [id, plainConfig] of notificationPlaintexts) {
        await tx
          .update(notificationTargets)
          .set({ encryptedConfig: encrypt(plainConfig, newKey) })
          .where(eq(notificationTargets.id, id))
      }

      await tx
        .update(appSettings)
        .set({ passwordHash: newHash, ...settingsUpdates })
        .where(eq(appSettings.id, settings.id))
    })
  } catch (err) {
    log.error(
      {
        route: "POST /api/auth/change-password",
        error: String(err),
      },
      "transaction failed during password change"
    )
    return NextResponse.json(
      { error: "Password change failed. Your current password is unchanged." },
      { status: 500 }
    )
  } finally {
    oldKey.fill(0)
    newKey.fill(0)
  }

  // Transaction committed — safe to end session
  log.info({ route: "POST /api/auth/change-password" }, "password changed successfully")
  await clearSchedulerKey(settings.id)
  stopScheduler()
  await clearSession()

  if (failedTrackers.length > 0) {
    warnings.push(
      `Could not re-encrypt ${failedTrackers.length} tracker API key(s). Re-enter them manually.`
    )
  }
  if (failedClients.length > 0) {
    warnings.push(
      `Could not re-encrypt ${failedClients.length} client credential(s). Re-enter them manually.`
    )
  }
  if (failedNotifications.length > 0) {
    warnings.push(
      `${failedNotifications.length} notification target(s) could not be re-encrypted and were skipped: ${failedNotifications.join(", ")}`
    )
  }
  if (totpDisabled) {
    log.warn(
      { route: "POST /api/auth/change-password" },
      "TOTP disabled during password change — re-encryption failed"
    )
    warnings.push("TOTP could not be re-encrypted and was disabled. Re-enroll 2FA after login.")
  }

  return NextResponse.json({ success: true, ...(warnings.length > 0 && { warnings }) })
}
