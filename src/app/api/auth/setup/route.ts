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

  let body: { password?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { password } = body
  if (!password || typeof password !== "string" || password.length < 8 || password.length > 128) {
    return NextResponse.json(
      { error: "Password must be between 8 and 128 characters" },
      { status: 400 }
    )
  }

  const passwordHash = await hashPassword(password)
  const encryptionSalt = generateSalt()

  await db.insert(appSettings).values({ passwordHash, encryptionSalt })

  return NextResponse.json({ success: true })
}
