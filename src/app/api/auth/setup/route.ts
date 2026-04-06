// src/app/api/auth/setup/route.ts
import { NextResponse } from "next/server"
import { parseJsonBody, validateIntRange } from "@/lib/api-helpers"
import { hashPassword } from "@/lib/auth"
import { generateSalt } from "@/lib/crypto"
import { db } from "@/lib/db"
import { appSettings } from "@/lib/db/schema"
import {
  PASSWORD_MAX,
  PASSWORD_MIN,
  SNAPSHOT_RETENTION_MAX,
  SNAPSHOT_RETENTION_MIN,
  USERNAME_MAX,
  USERNAME_MIN,
} from "@/lib/limits"
import { log } from "@/lib/logger"

export async function POST(request: Request) {
  const body = await parseJsonBody(request)
  if (body instanceof NextResponse) return body

  const { password, username, snapshotRetentionDays } = body as {
    password?: string
    username?: string
    snapshotRetentionDays?: number
  }
  if (
    !password ||
    typeof password !== "string" ||
    password.length < PASSWORD_MIN ||
    password.length > PASSWORD_MAX
  ) {
    return NextResponse.json(
      { error: `Password must be between ${PASSWORD_MIN} and ${PASSWORD_MAX} characters` },
      { status: 400 }
    )
  }

  if (typeof username !== "string" || !username.trim()) {
    return NextResponse.json({ error: "Username is required" }, { status: 400 })
  }
  const validatedUsername = username.trim()
  if (validatedUsername.length < USERNAME_MIN || validatedUsername.length > USERNAME_MAX) {
    return NextResponse.json(
      { error: `Username must be between ${USERNAME_MIN} and ${USERNAME_MAX} characters` },
      { status: 400 }
    )
  }
  if (!/^[\w\-. ]+$/.test(validatedUsername)) {
    return NextResponse.json(
      {
        error: "Username may only contain letters, numbers, underscores, hyphens, dots, and spaces",
      },
      { status: 400 }
    )
  }

  // Validate optional retention setting
  let validatedRetention: number | undefined
  if (snapshotRetentionDays !== undefined) {
    if (typeof snapshotRetentionDays !== "number") {
      return NextResponse.json(
        {
          error: `snapshotRetentionDays must be an integer between ${SNAPSHOT_RETENTION_MIN} and ${SNAPSHOT_RETENTION_MAX}`,
        },
        { status: 400 }
      )
    }
    const retentionErr = validateIntRange(
      snapshotRetentionDays,
      SNAPSHOT_RETENTION_MIN,
      SNAPSHOT_RETENTION_MAX,
      "snapshotRetentionDays",
      `snapshotRetentionDays must be an integer between ${SNAPSHOT_RETENTION_MIN} and ${SNAPSHOT_RETENTION_MAX}`
    )
    if (retentionErr) return retentionErr
    validatedRetention = snapshotRetentionDays
  }

  // Fast pre-flight: skip expensive hashing if already configured
  const preCheck = await db.select({ id: appSettings.id }).from(appSettings).limit(1)
  if (preCheck.length > 0) {
    log.warn({ route: "POST /api/auth/setup" }, "setup rejected — already configured")
    return NextResponse.json({ error: "Already configured" }, { status: 400 })
  }

  const passwordHash = await hashPassword(password)
  const encryptionSalt = generateSalt()

  // Atomic check-and-insert with serializable isolation: prevents TOCTOU race
  const inserted = await db.transaction(
    async (tx) => {
      const existing = await tx.select({ id: appSettings.id }).from(appSettings).limit(1)
      if (existing.length > 0) return false
      await tx.insert(appSettings).values({
        passwordHash,
        encryptionSalt,
        username: validatedUsername,
        ...(validatedRetention !== undefined && { snapshotRetentionDays: validatedRetention }),
      })
      return true
    },
    { isolationLevel: "serializable" }
  )

  if (!inserted) {
    log.warn({ route: "POST /api/auth/setup" }, "setup rejected — race condition")
    return NextResponse.json({ error: "Already configured" }, { status: 400 })
  }

  log.info({ route: "POST /api/auth/setup" }, "initial setup completed")
  return NextResponse.json({ success: true })
}
