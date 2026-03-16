// src/app/api/auth/totp/confirm/route.ts
//
// Confirms TOTP enrollment. Verifies the user's TOTP code against the setup
// token, then encrypts and saves the secret to the database.
// Requires an active session.

import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import { authenticate, decodeKey, parseJsonBody } from "@/lib/api-helpers"
import { verifySetupToken } from "@/lib/auth"
import { encrypt } from "@/lib/crypto"
import { db } from "@/lib/db"
import { appSettings } from "@/lib/db/schema"
import { verifyTotpCode } from "@/lib/totp"

export async function POST(request: Request) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  const body = await parseJsonBody(request)
  if (body instanceof NextResponse) return body

  const { setupToken, code, enableBackupCodes } = body as {
    setupToken?: string
    code?: string
    enableBackupCodes?: boolean
  }

  if (!setupToken || typeof setupToken !== "string" || setupToken.length > 2048) {
    return NextResponse.json({ error: "Missing setup token" }, { status: 400 })
  }
  if (!code || typeof code !== "string" || code.length !== 6 || !/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: "Invalid TOTP code — must be 6 digits" }, { status: 400 })
  }

  const setup = await verifySetupToken(setupToken)
  if (!setup) {
    return NextResponse.json(
      { error: "Setup token expired or invalid. Please restart enrollment." },
      { status: 400 }
    )
  }

  if (!verifyTotpCode(setup.totpSecret, code)) {
    return NextResponse.json({ error: "Invalid TOTP code. Please try again." }, { status: 400 })
  }

  // Encrypt the TOTP secret with the user's encryption key before saving
  const key = decodeKey(auth)
  const encryptedSecret = encrypt(setup.totpSecret, key)

  const [settings] = await db.select().from(appSettings).limit(1)
  if (!settings) {
    return NextResponse.json({ error: "Not configured" }, { status: 400 })
  }

  // Save encrypted secret and optionally backup codes
  const updates: Record<string, unknown> = { totpSecret: encryptedSecret }
  if (enableBackupCodes !== false) {
    updates.totpBackupCodes = encrypt(setup.backupCodesJson, key)
  }

  await db.update(appSettings).set(updates).where(eq(appSettings.id, settings.id))

  return NextResponse.json({ success: true })
}
