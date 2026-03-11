// src/app/api/auth/setup/route.ts
import { NextResponse } from "next/server"
import { hashPassword } from "@/lib/auth"
import { generateSalt } from "@/lib/crypto"
import { db } from "@/lib/db"
import { appSettings } from "@/lib/db/schema"

export async function POST(request: Request) {
  const existing = await db.select().from(appSettings).limit(1)
  if (existing.length > 0) {
    return NextResponse.json({ error: "Already configured" }, { status: 400 })
  }

  let body: { password?: string; username?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { password, username } = body
  if (!password || typeof password !== "string" || password.length < 8 || password.length > 128) {
    return NextResponse.json(
      { error: "Password must be between 8 and 128 characters" },
      { status: 400 }
    )
  }

  const trimmedUsername = typeof username === "string" ? username.trim() : ""
  if (!username || typeof username !== "string" || trimmedUsername.length < 3 || trimmedUsername.length > 100) {
    return NextResponse.json(
      { error: "Username must be between 3 and 100 characters" },
      { status: 400 }
    )
  }
  if (!/^[\w\-. ]+$/.test(trimmedUsername)) {
    return NextResponse.json(
      { error: "Username may only contain letters, numbers, underscores, hyphens, dots, and spaces" },
      { status: 400 }
    )
  }
  const validatedUsername = trimmedUsername

  const passwordHash = await hashPassword(password)
  const encryptionSalt = generateSalt()

  await db.insert(appSettings).values({
    passwordHash,
    encryptionSalt,
    username: validatedUsername,
  })

  return NextResponse.json({ success: true })
}
