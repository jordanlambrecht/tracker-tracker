// src/app/api/auth/change-password/route.ts
//
// Functions: POST
//
// Changes the master password and re-encrypts all encrypted fields
// (tracker API tokens, download client credentials, proxy password,
// backup password, TOTP secrets) inside a single transaction.
// Requires an active session and the current password for verification.

import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import { authenticate, decodeKey, parseJsonBody } from "@/lib/api-helpers"
import { clearSession, hashPassword, verifyPassword } from "@/lib/auth"
import { decrypt, deriveKey, encrypt, reencrypt } from "@/lib/crypto"
import { db } from "@/lib/db"
import { appSettings, downloadClients, trackers } from "@/lib/db/schema"
import { recordFailedAttempt, resetFailedAttempts } from "@/lib/lockout"
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

  if (!currentPassword || typeof currentPassword !== "string" || currentPassword.length > 128) {
    return NextResponse.json({ error: "Current password is required" }, { status: 400 })
  }
  if (
    !newPassword ||
    typeof newPassword !== "string" ||
    newPassword.length < 8 ||
    newPassword.length > 128
  ) {
    return NextResponse.json(
      { error: "New password must be between 8 and 128 characters" },
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
  const failedTrackers: string[] = []
  const failedClients: string[] = []

  const allTrackers = await db.select().from(trackers)
  for (const tracker of allTrackers) {
    try {
      trackerPlaintexts.set(tracker.id, decrypt(tracker.encryptedApiToken, oldKey))
    } catch {
      failedTrackers.push(tracker.name)
    }
  }

  const allClients = await db.select().from(downloadClients)
  for (const client of allClients) {
    try {
      clientPlaintexts.set(client.id, {
        username: decrypt(client.encryptedUsername, oldKey),
        password: decrypt(client.encryptedPassword, oldKey),
      })
    } catch {
      failedClients.push(client.name)
    }
  }

  const settingsUpdates: Record<string, unknown> = {}
  const warnings: string[] = []
  let totpDisabled = false

  if (settings.totpSecret) {
    try {
      settingsUpdates.totpSecret = reencrypt(settings.totpSecret, oldKey, newKey)
    } catch {
      // security-audit-ignore: re-encryption failed — clearing TOTP is the safe fallback
      settingsUpdates.totpSecret = null
      settingsUpdates.totpBackupCodes = null
      totpDisabled = true
    }
  }
  if (settings.totpBackupCodes && !settingsUpdates.totpBackupCodes && !totpDisabled) {
    try {
      settingsUpdates.totpBackupCodes = reencrypt(settings.totpBackupCodes, oldKey, newKey)
    } catch {
      // security-audit-ignore: clearing backup codes is safe when re-encryption fails
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

      await tx
        .update(appSettings)
        .set({ passwordHash: newHash, ...settingsUpdates })
        .where(eq(appSettings.id, settings.id))
    })
  } catch (err) {
    console.error("[change-password] Transaction failed:", err) // security-audit-ignore: server-side only
    return NextResponse.json(
      { error: "Password change failed. Your current password is unchanged." },
      { status: 500 }
    )
  } finally {
    oldKey.fill(0)
    newKey.fill(0)
  }

  // Transaction committed — safe to end session
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
  if (totpDisabled) {
    warnings.push("TOTP could not be re-encrypted and was disabled. Re-enroll 2FA after login.")
  }

  return NextResponse.json({ success: true, ...(warnings.length > 0 && { warnings }) })
}
