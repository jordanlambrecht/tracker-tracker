// src/app/api/auth/totp/verify/route.ts
//
// Functions: POST
//
// Verifies a TOTP code (or backup code) during login. Exchanges a pending
// token + valid code for a full session. This route is public (no session
// cookie required — the user is mid-login).

import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import { parseJsonBody } from "@/lib/api-helpers"
import { createSession, verifyPendingToken } from "@/lib/auth"
import { decrypt, encrypt } from "@/lib/crypto"
import { db } from "@/lib/db"
import { appSettings } from "@/lib/db/schema"
import { startScheduler } from "@/lib/scheduler"
import type { BackupCodeEntry } from "@/lib/totp"
import { verifyAndConsumeBackupCode, verifyTotpCode } from "@/lib/totp"
import { recordFailedAttempt, resetFailedAttempts, WIPE_MESSAGE } from "@/lib/wipe"

const BACKUP_CODE_PATTERN = /^[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}$/

export async function POST(request: Request) {
  const body = await parseJsonBody(request)
  if (body instanceof NextResponse) return body

  const { pendingToken, code, isBackupCode } = body as {
    pendingToken?: string
    code?: string
    isBackupCode?: boolean
  }

  if (!pendingToken || typeof pendingToken !== "string") {
    return NextResponse.json({ error: "Missing pending token" }, { status: 400 })
  }
  if (!code || typeof code !== "string") {
    return NextResponse.json({ error: "Missing verification code" }, { status: 400 })
  }

  // Validate code format before any crypto/DB work
  if (isBackupCode) {
    if (!BACKUP_CODE_PATTERN.test(code)) {
      return NextResponse.json({ error: "Invalid backup code format" }, { status: 400 })
    }
  } else if (code.length !== 6 || !/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: "Invalid TOTP code — must be 6 digits" }, { status: 400 })
  }

  const pending = await verifyPendingToken(pendingToken)
  if (!pending) {
    return NextResponse.json({ error: "Session expired. Please log in again." }, { status: 401 })
  }

  const [settings] = await db.select().from(appSettings).limit(1)
  if (!settings?.totpSecret) {
    return NextResponse.json({ error: "TOTP is not enabled" }, { status: 400 })
  }

  const key = Buffer.from(pending.encryptionKey, "hex")

  if (isBackupCode) {
    // Verify backup code
    if (!settings.totpBackupCodes) {
      return NextResponse.json({ error: "Backup codes are not enabled" }, { status: 400 })
    }

    const entries: BackupCodeEntry[] = JSON.parse(decrypt(settings.totpBackupCodes, key))
    const { valid, updatedEntries } = verifyAndConsumeBackupCode(code, entries)

    if (!valid) {
      const wiped = await recordFailedAttempt(settings.id, settings.autoWipeThreshold)
      if (wiped) return NextResponse.json({ error: WIPE_MESSAGE }, { status: 403 })
      return NextResponse.json({ error: "Invalid backup code" }, { status: 401 })
    }

    // Mark the used backup code in the DB
    await db
      .update(appSettings)
      .set({ totpBackupCodes: encrypt(JSON.stringify(updatedEntries), key) })
      .where(eq(appSettings.id, settings.id))
  } else {
    // Verify TOTP code
    const totpSecret = decrypt(settings.totpSecret, key)
    if (!verifyTotpCode(totpSecret, code)) {
      const wiped = await recordFailedAttempt(settings.id, settings.autoWipeThreshold)
      if (wiped) return NextResponse.json({ error: WIPE_MESSAGE }, { status: 403 })
      return NextResponse.json({ error: "Invalid TOTP code" }, { status: 401 })
    }
  }

  // Code verified — login fully successful, reset failed attempts
  await resetFailedAttempts(settings.id)

  await createSession(pending.encryptionKey, settings.sessionTimeoutMinutes)
  startScheduler(key)

  return NextResponse.json({ success: true })
}
