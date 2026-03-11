// src/app/api/auth/setup/route.ts
import { NextResponse } from "next/server"
import { parseJsonBody } from "@/lib/api-helpers"
import { hashPassword } from "@/lib/auth"
import { generateSalt } from "@/lib/crypto"
import { db } from "@/lib/db"
import { appSettings } from "@/lib/db/schema"

export async function POST(request: Request) {
  const body = await parseJsonBody(request)
  if (body instanceof NextResponse) return body

  const { password, username } = body as { password?: string; username?: string }
  if (!password || typeof password !== "string" || password.length < 8 || password.length > 128) {
    return NextResponse.json(
      { error: "Password must be between 8 and 128 characters" },
      { status: 400 }
    )
  }

  if (typeof username !== "string" || !username.trim()) {
    return NextResponse.json(
      { error: "Username is required" },
      { status: 400 }
    )
  }
  const validatedUsername = username.trim()
  if (validatedUsername.length < 3 || validatedUsername.length > 100) {
    return NextResponse.json(
      { error: "Username must be between 3 and 100 characters" },
      { status: 400 }
    )
  }
  if (!/^[\w\-. ]+$/.test(validatedUsername)) {
    return NextResponse.json(
      { error: "Username may only contain letters, numbers, underscores, hyphens, dots, and spaces" },
      { status: 400 }
    )
  }

  // Fast pre-flight: skip expensive hashing if already configured
  const preCheck = await db.select({ id: appSettings.id }).from(appSettings).limit(1)
  if (preCheck.length > 0) {
    return NextResponse.json({ error: "Already configured" }, { status: 400 })
  }

  const passwordHash = await hashPassword(password)
  const encryptionSalt = generateSalt()

  // Atomic check-and-insert with serializable isolation: prevents TOCTOU race
  const inserted = await db.transaction(async (tx) => {
    const existing = await tx.select({ id: appSettings.id }).from(appSettings).limit(1)
    if (existing.length > 0) return false
    await tx.insert(appSettings).values({
      passwordHash,
      encryptionSalt,
      username: validatedUsername,
    })
    return true
  }, { isolationLevel: "serializable" })

  if (!inserted) {
    return NextResponse.json({ error: "Already configured" }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
