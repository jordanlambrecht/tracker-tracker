// src/app/api/auth/change-password/route.ts
//
// Changes the master password and re-encrypts all tracker API tokens + TOTP secrets.
// Requires an active session and the current password for verification.

import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import { authenticate, decodeKey, parseJsonBody } from "@/lib/api-helpers"
import { clearSession, hashPassword, verifyPassword } from "@/lib/auth"
import { decrypt, deriveKey, encrypt } from "@/lib/crypto"
import { db } from "@/lib/db"
import { appSettings, trackers } from "@/lib/db/schema"
import { stopScheduler } from "@/lib/scheduler"

export async function POST(request: Request) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  const body = await parseJsonBody(request)
  if (body instanceof NextResponse) return body

  const { currentPassword, newPassword } = body as {
    currentPassword?: string
    newPassword?: string
  }

  if (!currentPassword || typeof currentPassword !== "string") {
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
    return NextResponse.json({ error: "Current password is incorrect" }, { status: 401 })
  }

  const oldKey = decodeKey(auth)
  const newKey = await deriveKey(newPassword, settings.encryptionSalt)
  const newHash = await hashPassword(newPassword)

  // Re-encrypt all tracker API tokens
  const allTrackers = await db.select().from(trackers)
  for (const tracker of allTrackers) {
    try {
      const plainToken = decrypt(tracker.encryptedApiToken, oldKey)
      const reEncrypted = encrypt(plainToken, newKey)
      await db.update(trackers).set({ encryptedApiToken: reEncrypted }).where(eq(trackers.id, tracker.id))
    } catch {
      // Token was corrupted — leave as-is, user will need to re-enter
    }
  }

  // Re-encrypt TOTP secret and backup codes if present
  const totpUpdates: Record<string, unknown> = {}
  if (settings.totpSecret) {
    try {
      totpUpdates.totpSecret = encrypt(decrypt(settings.totpSecret, oldKey), newKey)
    } catch {
      totpUpdates.totpSecret = null
      totpUpdates.totpBackupCodes = null
    }
  }
  if (settings.totpBackupCodes && !totpUpdates.totpBackupCodes) {
    try {
      totpUpdates.totpBackupCodes = encrypt(decrypt(settings.totpBackupCodes, oldKey), newKey)
    } catch {
      totpUpdates.totpBackupCodes = null
    }
  }

  await db
    .update(appSettings)
    .set({ passwordHash: newHash, ...totpUpdates })
    .where(eq(appSettings.id, settings.id))

  // End current session — user must re-login with new password
  stopScheduler()
  await clearSession()

  return NextResponse.json({ success: true })
}
