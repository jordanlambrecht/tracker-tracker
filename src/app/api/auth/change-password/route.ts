// src/app/api/auth/change-password/route.ts
//
// Functions: POST
//
// Changes the master password and re-encrypts all encrypted fields
// (tracker API tokens, download client credentials, proxy password,
// TOTP secrets) inside a single transaction.
// Requires an active session and the current password for verification.

import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import { authenticate, decodeKey, parseJsonBody } from "@/lib/api-helpers"
import { clearSession, hashPassword, verifyPassword } from "@/lib/auth"
import { decrypt, deriveKey, encrypt } from "@/lib/crypto"
import { db } from "@/lib/db"
import { appSettings, downloadClients, trackers } from "@/lib/db/schema"
import { stopScheduler } from "@/lib/scheduler"
import { recordFailedAttempt, resetFailedAttempts, WIPE_MESSAGE } from "@/lib/wipe"

function reEncrypt(ciphertext: string, oldKey: Buffer, newKey: Buffer): string {
  return encrypt(decrypt(ciphertext, oldKey), newKey)
}

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
  if (!newPassword || typeof newPassword !== "string" || newPassword.length < 8 || newPassword.length > 128) {
    return NextResponse.json({ error: "New password must be between 8 and 128 characters" }, { status: 400 })
  }

  const [settings] = await db.select().from(appSettings).limit(1)
  if (!settings) {
    return NextResponse.json({ error: "Not configured" }, { status: 400 })
  }

  const valid = await verifyPassword(settings.passwordHash, currentPassword)
  if (!valid) {
    const wiped = await recordFailedAttempt(settings.id, settings.autoWipeThreshold)
    if (wiped) return NextResponse.json({ error: WIPE_MESSAGE }, { status: 403 })
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
      settingsUpdates.totpSecret = reEncrypt(settings.totpSecret, oldKey, newKey)
    } catch {
      settingsUpdates.totpSecret = null
      settingsUpdates.totpBackupCodes = null
      totpDisabled = true
    }
  }
  if (settings.totpBackupCodes && !settingsUpdates.totpBackupCodes && !totpDisabled) {
    try {
      settingsUpdates.totpBackupCodes = reEncrypt(settings.totpBackupCodes, oldKey, newKey)
    } catch {
      settingsUpdates.totpBackupCodes = null
    }
  }

  if (settings.encryptedProxyPassword) {
    try {
      settingsUpdates.encryptedProxyPassword = reEncrypt(settings.encryptedProxyPassword, oldKey, newKey)
    } catch {
      settingsUpdates.encryptedProxyPassword = null
      warnings.push("Proxy password could not be re-encrypted and was cleared. Re-enter it in settings.")
    }
  }

  // All decrypts done. Write phase is all-or-nothing inside a transaction.
  // Only items that successfully decrypted are re-encrypted and committed.
  try {
    await db.transaction(async (tx) => {
      for (const [id, plainToken] of trackerPlaintexts) {
        await tx.update(trackers).set({ encryptedApiToken: encrypt(plainToken, newKey) }).where(eq(trackers.id, id))
      }

      for (const [id, creds] of clientPlaintexts) {
        await tx.update(downloadClients).set({
          encryptedUsername: encrypt(creds.username, newKey),
          encryptedPassword: encrypt(creds.password, newKey),
        }).where(eq(downloadClients.id, id))
      }

      await tx
        .update(appSettings)
        .set({ passwordHash: newHash, ...settingsUpdates })
        .where(eq(appSettings.id, settings.id))
    })
  } finally {
    oldKey.fill(0)
    newKey.fill(0)
  }

  // Transaction committed — safe to end session
  stopScheduler()
  await clearSession()

  if (failedTrackers.length > 0) {
    warnings.push(`Could not re-encrypt ${failedTrackers.length} tracker API key(s). Re-enter them manually.`)
  }
  if (failedClients.length > 0) {
    warnings.push(`Could not re-encrypt ${failedClients.length} client credential(s). Re-enter them manually.`)
  }
  if (totpDisabled) {
    warnings.push("TOTP could not be re-encrypted and was disabled. Re-enroll 2FA after login.")
  }

  return NextResponse.json({ success: true, ...(warnings.length > 0 && { warnings }) })
}
