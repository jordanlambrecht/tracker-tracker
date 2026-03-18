// src/app/api/auth/login/route.ts
//
// Functions: POST

import { NextResponse } from "next/server"
import { parseJsonBody } from "@/lib/api-helpers"
import { createPendingToken, createSession, verifyPassword } from "@/lib/auth"
import { extractClientIp } from "@/lib/client-ip"
import { deriveKey } from "@/lib/crypto"
import { db } from "@/lib/db"
import { appSettings } from "@/lib/db/schema"
import { checkLockout, recordFailedAttempt, resetFailedAttempts } from "@/lib/lockout"
import { log } from "@/lib/logger"
import { startScheduler } from "@/lib/scheduler"
import { persistSchedulerKey } from "@/lib/scheduler-key-store"

export async function POST(request: Request) {
  const [settings] = await db.select().from(appSettings).limit(1)
  if (!settings) {
    return NextResponse.json({ error: "Not configured. Run setup first." }, { status: 400 })
  }

  const lockout = checkLockout(settings)
  if (lockout) return lockout

  const body = await parseJsonBody(request)
  if (body instanceof NextResponse) return body

  const clientIp = extractClientIp(request.headers)

  const password = body.password as string | undefined
  if (!password || typeof password !== "string" || password.length > 128) {
    return NextResponse.json({ error: "Invalid password" }, { status: 400 })
  }

  // Check username (case-insensitive) when one is stored
  let usernameOk = true
  if (settings.username) {
    const username = body.username as string | undefined
    usernameOk =
      typeof username === "string" && username.toLowerCase() === settings.username.toLowerCase()
  }

  // Always run Argon2 to normalize timing — prevents username oracle
  const passwordOk = await verifyPassword(settings.passwordHash, password)

  if (!usernameOk || !passwordOk) {
    await recordFailedAttempt(settings.id, settings)
    log.warn({ event: "login_failed", ip: clientIp }, "Failed login attempt")
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
  }

  // Derive encryption key
  const key = await deriveKey(password, settings.encryptionSalt)
  const keyHex = key.toString("hex")

  // If TOTP is enrolled, return a pending token instead of a full session.
  // Don't reset the counter yet — TOTP verification is still pending.
  if (settings.totpSecret) {
    log.info({ event: "login_totp_pending", ip: clientIp }, "Password verified, awaiting TOTP")
    const pendingToken = await createPendingToken(keyHex)
    return NextResponse.json({ requiresTotp: true, pendingToken })
  }

  // No TOTP — login fully successful, reset failed attempts
  await resetFailedAttempts(settings.id)
  await createSession(keyHex, settings.sessionTimeoutMinutes)
  await persistSchedulerKey(key, settings.id)
  startScheduler(key)
  log.info({ event: "login_success", ip: clientIp }, "Login successful")

  return NextResponse.json({ success: true })
}
