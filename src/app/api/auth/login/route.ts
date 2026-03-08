// src/app/api/auth/login/route.ts
import { NextResponse } from "next/server"
import { createSession, verifyPassword } from "@/lib/auth"
import { deriveKey } from "@/lib/crypto"
import { db } from "@/lib/db"
import { appSettings } from "@/lib/db/schema"
import { startScheduler } from "@/lib/scheduler"

export async function POST(request: Request) {
  const [settings] = await db.select().from(appSettings).limit(1)
  if (!settings) {
    return NextResponse.json({ error: "Not configured. Run setup first." }, { status: 400 })
  }

  let body: { password?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { password } = body
  if (!password || typeof password !== "string" || password.length > 128) {
    return NextResponse.json({ error: "Invalid password" }, { status: 400 })
  }

  const valid = await verifyPassword(settings.passwordHash, password)
  if (!valid) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 })
  }

  // Derive encryption key and store in session
  const key = await deriveKey(password, settings.encryptionSalt)
  await createSession(key.toString("hex"))
  startScheduler(key)

  return NextResponse.json({ success: true })
}
