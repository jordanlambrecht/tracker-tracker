// src/app/api/settings/lockdown/route.ts
//
// Emergency lockdown: stops scheduler, nullifies all encrypted data,
// rotates encryption salt (orphaning any remaining ciphertext),
// and destroys the session. The user must log back in and re-enter
// all tracker API tokens.

import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import { authenticate, parseJsonBody } from "@/lib/api-helpers"
import { clearSession, verifyPassword } from "@/lib/auth"
import { generateSalt } from "@/lib/crypto"
import { db } from "@/lib/db"
import { appSettings, downloadClients, trackers } from "@/lib/db/schema"
import { errMsg } from "@/lib/error-utils"
import { PASSWORD_MAX } from "@/lib/limits"
import { log } from "@/lib/logger"
import { stopScheduler } from "@/lib/scheduler"
import { clearSchedulerKey } from "@/lib/scheduler-key-store"

export async function POST(request: Request) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  const body = await parseJsonBody(request)
  if (body instanceof NextResponse) return body

  const { password } = body as { password?: string }
  if (!password || typeof password !== "string" || password.length > PASSWORD_MAX) {
    return NextResponse.json({ error: "Master password is required" }, { status: 400 })
  }

  const [settings] = await db.select().from(appSettings).limit(1)
  if (!settings) {
    return NextResponse.json({ error: "Not configured" }, { status: 400 })
  }

  const valid = await verifyPassword(settings.passwordHash, password)
  if (!valid) {
    log.warn({ route: "POST /api/settings/lockdown" }, "lockdown rejected — incorrect password")
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 })
  }

  log.info({ route: "POST /api/settings/lockdown" }, "emergency lockdown initiated")
  // 1. Stop all polling immediately
  stopScheduler()
  await clearSchedulerKey(settings.id)

  const newSalt = generateSalt()
  const now = new Date()

  try {
    await db.transaction(async (tx) => {
      // 2. Revoke all tracker API tokens
      await tx.update(trackers).set({
        encryptedApiToken: "LOCKDOWN_REVOKED",
        isActive: false,
        lastError: "Emergency lockdown: API token revoked",
        updatedAt: now,
      })

      // 3. Revoke all download client credentials
      await tx.update(downloadClients).set({
        encryptedUsername: "",
        encryptedPassword: "",
        enabled: false,
        lastError: "Emergency lockdown: credentials revoked",
        updatedAt: now,
      })

      // 4. Rotate salt + wipe all encrypted settings fields
      await tx
        .update(appSettings)
        .set({
          encryptionSalt: newSalt,
          totpSecret: null,
          totpBackupCodes: null,
          encryptedProxyPassword: null,
          encryptedBackupPassword: null,
          encryptedPtpimgApiKey: null,
          encryptedOeimgApiKey: null,
          encryptedImgbbApiKey: null,
          username: null,
        })
        .where(eq(appSettings.id, settings.id))
    })
  } catch (err) {
    log.error(
      { route: "POST /api/settings/lockdown", error: errMsg(err) },
      "Lockdown DB operations failed"
    )
    return NextResponse.json(
      { error: "Emergency lockdown failed. Retry immediately or shut down the server." },
      { status: 500 }
    )
  }

  // 5. Kill the session
  await clearSession()

  log.info({ route: "POST /api/settings/lockdown" }, "emergency lockdown completed")
  return NextResponse.json({ success: true })
}
