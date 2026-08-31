// src/app/api/auth/setup/route.ts
import { NextResponse } from "next/server"
import { parseJsonBody, validateIntRange } from "@/lib/api-helpers"
import { hashPassword } from "@/lib/auth"
import { generateSalt } from "@/lib/crypto"
import { db } from "@/lib/db"
import { appSettings } from "@/lib/db/schema"
import { errMsg } from "@/lib/error-utils"
import {
  PASSWORD_MAX,
  PASSWORD_MIN,
  SNAPSHOT_RETENTION_MAX,
  SNAPSHOT_RETENTION_MIN,
  validateUsername,
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

  // Setup is the reference definition of a valid username, so it reads it from
  // the shared validator rather than owning a private copy. POST
  // /api/auth/username has to agree with it exactly or an account created here
  // could not be renamed there, and vice versa.
  const usernameCheck = validateUsername(username)
  if (!usernameCheck.ok) {
    return NextResponse.json({ error: usernameCheck.error }, { status: 400 })
  }
  const validatedUsername = usernameCheck.username

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
    log.warn({ route: "POST /api/auth/setup" }, "setup rejected: already configured")
    return NextResponse.json({ error: "Already configured" }, { status: 400 })
  }

  const passwordHash = await hashPassword(password)
  const encryptionSalt = generateSalt()

  // Atomic check-and-insert with serializable isolation: prevents TOCTOU race
  let inserted: boolean
  try {
    inserted = await db.transaction(
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
  } catch (err) {
    log.error({ route: "POST /api/auth/setup", error: errMsg(err) }, "Setup transaction failed")
    return NextResponse.json(
      { error: "Setup failed due to a database error. Please try again." },
      { status: 500 }
    )
  }

  if (!inserted) {
    log.warn({ route: "POST /api/auth/setup" }, "setup rejected: race condition")
    return NextResponse.json({ error: "Already configured" }, { status: 400 })
  }

  log.info({ route: "POST /api/auth/setup" }, "initial setup completed")
  return NextResponse.json({ success: true })
}
