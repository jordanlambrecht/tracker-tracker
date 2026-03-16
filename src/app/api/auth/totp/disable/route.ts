// src/app/api/auth/totp/disable/route.ts
//
// Disables TOTP. Requires a valid TOTP code or backup code as proof of
// possession before removing the secret from the database.
// Requires an active session.

import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import { authenticate, decodeKey, parseJsonBody } from "@/lib/api-helpers"
import { verifyPassword } from "@/lib/auth"
import { decrypt, encrypt } from "@/lib/crypto"
import { db } from "@/lib/db"
import { appSettings } from "@/lib/db/schema"
import type { BackupCodeEntry } from "@/lib/totp"
import { BACKUP_CODE_PATTERN, verifyAndConsumeBackupCode, verifyTotpCode } from "@/lib/totp"
import { recordFailedAttempt, resetFailedAttempts, WIPE_MESSAGE } from "@/lib/wipe"

export async function POST(request: Request) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  const body = await parseJsonBody(request)
  if (body instanceof NextResponse) return body

  const { code, isBackupCode, password } = body as {
    code?: string
    isBackupCode?: boolean
    password?: string
  }

  // Password re-verification required to disable 2FA
  if (!password || typeof password !== "string") {
    return NextResponse.json(
      { error: "Master password is required to disable 2FA" },
      { status: 400 }
    )
  }
  if (!code || typeof code !== "string") {
    return NextResponse.json(
      { error: "A TOTP or backup code is required to disable 2FA" },
      { status: 400 }
    )
  }

  const [settings] = await db.select().from(appSettings).limit(1)
  if (!settings?.totpSecret) {
    return NextResponse.json({ error: "TOTP is not enabled" }, { status: 400 })
  }

  const passwordValid = await verifyPassword(settings.passwordHash, password)
  if (!passwordValid) {
    const wiped = await recordFailedAttempt(settings.id, settings.autoWipeThreshold)
    if (wiped) return NextResponse.json({ error: WIPE_MESSAGE }, { status: 403 })
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 })
  }

  const key = decodeKey(auth)
  let verified = false

  if (isBackupCode) {
    if (!BACKUP_CODE_PATTERN.test(code)) {
      const wiped = await recordFailedAttempt(settings.id, settings.autoWipeThreshold)
      if (wiped) return NextResponse.json({ error: WIPE_MESSAGE }, { status: 403 })
      return NextResponse.json({ error: "Invalid backup code format" }, { status: 400 })
    }
    if (!settings.totpBackupCodes) {
      return NextResponse.json({ error: "Backup codes are not enabled" }, { status: 400 })
    }
    let entries: BackupCodeEntry[]
    try {
      entries = JSON.parse(decrypt(settings.totpBackupCodes, key))
    } catch {
      return NextResponse.json({ error: "Failed to decrypt backup codes" }, { status: 500 })
    }
    const { valid, updatedEntries } = verifyAndConsumeBackupCode(code, entries)
    verified = valid
    // Persist consumed backup code before the disable update (defense in depth)
    if (valid) {
      await db
        .update(appSettings)
        .set({ totpBackupCodes: encrypt(JSON.stringify(updatedEntries), key) })
        .where(eq(appSettings.id, settings.id))
    }
  } else {
    if (code.length !== 6 || !/^\d{6}$/.test(code)) {
      const wiped = await recordFailedAttempt(settings.id, settings.autoWipeThreshold)
      if (wiped) return NextResponse.json({ error: WIPE_MESSAGE }, { status: 403 })
      return NextResponse.json({ error: "Invalid TOTP code — must be 6 digits" }, { status: 400 })
    }
    let totpSecret: string
    try {
      totpSecret = decrypt(settings.totpSecret, key)
    } catch {
      return NextResponse.json({ error: "Failed to decrypt TOTP secret" }, { status: 500 })
    }
    verified = verifyTotpCode(totpSecret, code)
  }

  if (!verified) {
    const wiped = await recordFailedAttempt(settings.id, settings.autoWipeThreshold)
    if (wiped) return NextResponse.json({ error: WIPE_MESSAGE }, { status: 403 })
    return NextResponse.json({ error: "Invalid code" }, { status: 401 })
  }

  await resetFailedAttempts(settings.id)

  // Remove TOTP from the database
  await db
    .update(appSettings)
    .set({ totpSecret: null, totpBackupCodes: null })
    .where(eq(appSettings.id, settings.id))

  return NextResponse.json({ success: true })
}
