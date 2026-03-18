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
import { appSettings, trackers } from "@/lib/db/schema"
import { stopScheduler } from "@/lib/scheduler"

export async function POST(request: Request) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  const body = await parseJsonBody(request)
  if (body instanceof NextResponse) return body

  const { password } = body as { password?: string }
  if (!password || typeof password !== "string" || password.length > 128) {
    return NextResponse.json({ error: "Master password is required" }, { status: 400 })
  }

  const [settings] = await db.select().from(appSettings).limit(1)
  if (!settings) {
    return NextResponse.json({ error: "Not configured" }, { status: 400 })
  }

  const valid = await verifyPassword(settings.passwordHash, password)
  if (!valid) {
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 })
  }

  // 1. Stop all polling immediately
  stopScheduler()

  // 2. Nullify all tracker API tokens — they're now useless
  await db.update(trackers).set({
    encryptedApiToken: "LOCKDOWN_REVOKED",
    isActive: false,
    lastError: "Emergency lockdown — API token revoked",
    updatedAt: new Date(),
  })

  // 3. Rotate encryption salt — orphans any remaining ciphertext
  const newSalt = generateSalt()

  // 4. Wipe all encrypted fields (encrypted with old key, now unrecoverable anyway)
  await db
    .update(appSettings)
    .set({
      encryptionSalt: newSalt,
      totpSecret: null,
      totpBackupCodes: null,
      encryptedProxyPassword: null,
      encryptedBackupPassword: null,
      username: null,
    })
    .where(eq(appSettings.id, settings.id))

  // 5. Kill the session
  await clearSession()

  return NextResponse.json({ success: true })
}
