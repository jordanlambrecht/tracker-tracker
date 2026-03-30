// src/app/api/auth/totp/verify/route.ts
//
// Functions: POST
//
// Verifies a TOTP code (or backup code) during login. Exchanges a pending
// token + valid code for a full session. This route is public (no session
// cookie required since the user is mid-login).

import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import { parseJsonBody } from "@/lib/api-helpers"
import { createSession, verifyPendingToken } from "@/lib/auth"
import { extractClientIp } from "@/lib/client-ip"
import { decrypt, encrypt } from "@/lib/crypto"
import { db } from "@/lib/db"
import { appSettings } from "@/lib/db/schema"
import { checkLockout, recordFailedAttempt, resetFailedAttempts } from "@/lib/lockout"
import { log } from "@/lib/logger"
import { startScheduler } from "@/lib/scheduler"
import { persistSchedulerKey } from "@/lib/scheduler-key-store"
import type { BackupCodeEntry } from "@/lib/totp"
import {
  BACKUP_CODE_PATTERN,
  TOTP_CODE_RE,
  verifyAndConsumeBackupCode,
  verifyTotpCode,
} from "@/lib/totp"

export async function POST(request: Request) {
  const body = await parseJsonBody(request)
  if (body instanceof NextResponse) return body

  const clientIp = extractClientIp(request.headers)

  const { pendingToken, code, isBackupCode } = body as {
    pendingToken?: string
    code?: string
    isBackupCode?: boolean
  }

  if (!pendingToken || typeof pendingToken !== "string" || pendingToken.length > 2048) {
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
  } else if (!TOTP_CODE_RE.test(code)) {
    return NextResponse.json({ error: "Invalid TOTP code — must be 6 digits" }, { status: 400 })
  }

  const pending = await verifyPendingToken(pendingToken)
  if (!pending) {
    log.warn(
      { route: "POST /api/auth/totp/verify" },
      "TOTP verify rejected — invalid or expired pending token"
    )
    return NextResponse.json({ error: "Session expired. Please log in again." }, { status: 401 })
  }

  const [settings] = await db.select().from(appSettings).limit(1)
  if (!settings?.totpSecret) {
    return NextResponse.json({ error: "TOTP is not enabled" }, { status: 400 })
  }

  const lockout = checkLockout(settings)
  if (lockout) return lockout

  const key = Buffer.from(pending.encryptionKey, "hex")

  if (isBackupCode) {
    // Verify backup code
    if (!settings.totpBackupCodes) {
      return NextResponse.json({ error: "Backup codes are not enabled" }, { status: 400 })
    }

    let entries: BackupCodeEntry[]
    try {
      entries = JSON.parse(decrypt(settings.totpBackupCodes, key))
    } catch {
      log.error({ route: "POST /api/auth/totp/verify" }, "corrupted backup codes detected")
      return NextResponse.json({ error: "Corrupted backup codes" }, { status: 500 })
    }
    const { valid, updatedEntries } = verifyAndConsumeBackupCode(code, entries)

    if (!valid) {
      await recordFailedAttempt(settings.id, settings)
      log.warn(
        { event: "totp_failed", method: "backup_code", ip: clientIp },
        "Failed backup code attempt"
      )
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
      await recordFailedAttempt(settings.id, settings)
      log.warn({ event: "totp_failed", method: "totp", ip: clientIp }, "Failed TOTP code attempt")
      return NextResponse.json({ error: "Invalid TOTP code" }, { status: 401 })
    }
  }

  // Code verified
  await resetFailedAttempts(settings.id)

  await createSession(pending.encryptionKey, settings.sessionTimeoutMinutes)
  await persistSchedulerKey(key, settings.id)
  startScheduler(key)
  log.info(
    { event: "login_success", method: isBackupCode ? "backup_code" : "totp", ip: clientIp },
    "Login successful (2FA verified)"
  )

  return NextResponse.json({ success: true })
}
