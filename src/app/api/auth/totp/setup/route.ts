// src/app/api/auth/totp/setup/route.ts
//
// Begins TOTP enrollment. Returns QR URI, setup token, and backup codes.
// Requires an active session (user must be logged in).

import { NextResponse } from "next/server"
import { authenticate } from "@/lib/api-helpers"
import { createSetupToken } from "@/lib/auth"
import { db } from "@/lib/db"
import { appSettings } from "@/lib/db/schema"
import { log } from "@/lib/logger"
import { generateBackupCodes, generateTotpSecret, hashBackupCode } from "@/lib/totp"

export async function POST() {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  const [settings] = await db.select().from(appSettings).limit(1)
  if (!settings) {
    return NextResponse.json({ error: "Not configured" }, { status: 400 })
  }

  if (settings.totpSecret) {
    log.warn({ route: "POST /api/auth/totp/setup" }, "TOTP setup rejected — already enabled")
    return NextResponse.json({ error: "TOTP is already enabled" }, { status: 400 })
  }

  const { secret, uri } = generateTotpSecret("TrackerTracker")
  const backupCodes = generateBackupCodes()
  const backupHashes = backupCodes.map((code) => hashBackupCode(code))

  const setupToken = await createSetupToken(secret, JSON.stringify(backupHashes))

  log.info({ route: "POST /api/auth/totp/setup" }, "TOTP enrollment initiated")
  return NextResponse.json({
    uri,
    setupToken,
    backupCodes,
  })
}
