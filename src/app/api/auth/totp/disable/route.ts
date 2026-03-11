// src/app/api/auth/totp/disable/route.ts
//
// Disables TOTP. Requires a valid TOTP code or backup code as proof of
// possession before removing the secret from the database.
// Requires an active session.

import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import { authenticate, decodeKey, parseJsonBody } from "@/lib/api-helpers"
import { decrypt } from "@/lib/crypto"
import { db } from "@/lib/db"
import { appSettings } from "@/lib/db/schema"
import type { BackupCodeEntry } from "@/lib/totp"
import { verifyAndConsumeBackupCode, verifyTotpCode } from "@/lib/totp"

export async function POST(request: Request) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  const body = await parseJsonBody(request)
  if (body instanceof NextResponse) return body

  const { code, isBackupCode } = body as { code?: string; isBackupCode?: boolean }

  if (!code || typeof code !== "string") {
    return NextResponse.json({ error: "A TOTP or backup code is required to disable 2FA" }, { status: 400 })
  }

  const [settings] = await db.select().from(appSettings).limit(1)
  if (!settings?.totpSecret) {
    return NextResponse.json({ error: "TOTP is not enabled" }, { status: 400 })
  }

  const key = decodeKey(auth)
  let verified = false

  if (isBackupCode) {
    if (!settings.totpBackupCodes) {
      return NextResponse.json({ error: "Backup codes are not enabled" }, { status: 400 })
    }
    const entries: BackupCodeEntry[] = JSON.parse(decrypt(settings.totpBackupCodes, key))
    const result = verifyAndConsumeBackupCode(code, entries)
    verified = result.valid
  } else {
    if (code.length !== 6 || !/^\d{6}$/.test(code)) {
      return NextResponse.json({ error: "Invalid TOTP code — must be 6 digits" }, { status: 400 })
    }
    const totpSecret = decrypt(settings.totpSecret, key)
    verified = verifyTotpCode(totpSecret, code)
  }

  if (!verified) {
    return NextResponse.json({ error: "Invalid code" }, { status: 401 })
  }

  // Remove TOTP from the database
  await db
    .update(appSettings)
    .set({ totpSecret: null, totpBackupCodes: null })
    .where(eq(appSettings.id, settings.id))

  return NextResponse.json({ success: true })
}
