// src/app/api/settings/reset-stats/route.ts
//
// Functions: POST

import { NextResponse } from "next/server"
import { authenticate, parseJsonBody } from "@/lib/api-helpers"
import { verifyPassword } from "@/lib/auth"
import { db } from "@/lib/db"
import { appSettings, clientSnapshots, trackerSnapshots, trackers } from "@/lib/db/schema"
import { log } from "@/lib/logger"

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
    log.warn({ route: "POST /api/settings/reset-stats" }, "stats reset rejected — incorrect password")
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 })
  }

  log.info({ route: "POST /api/settings/reset-stats" }, "stats reset initiated")
  // Delete all tracker snapshots
  await db.delete(trackerSnapshots)

  // Delete all client snapshots
  await db.delete(clientSnapshots)

  // Clear lastPolledAt and lastError on all trackers so they re-poll fresh
  await db.update(trackers).set({ lastPolledAt: null, lastError: null })

  return NextResponse.json({ success: true })
}
