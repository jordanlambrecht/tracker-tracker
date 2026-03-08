// src/app/api/trackers/[id]/route.ts
//
// Functions: PATCH, DELETE

import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import { authenticate, parseJsonBody, parseTrackerId } from "@/lib/api-helpers"
import { encrypt } from "@/lib/crypto"
import { db } from "@/lib/db"
import { trackers } from "@/lib/db/schema"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  const trackerId = await parseTrackerId(params)
  if (trackerId instanceof NextResponse) return trackerId

  const body = await parseJsonBody(request)
  if (body instanceof NextResponse) return body

  const updates: Record<string, unknown> = { updatedAt: new Date() }

  if (typeof body.name === "string") {
    if (body.name.length > 100) {
      return NextResponse.json({ error: "Name must be 100 characters or fewer" }, { status: 400 })
    }
    updates.name = body.name.trim()
  }
  if (typeof body.baseUrl === "string") {
    if (body.baseUrl.length > 500) {
      return NextResponse.json({ error: "URL must be 500 characters or fewer" }, { status: 400 })
    }
    try {
      new URL(body.baseUrl as string)
      updates.baseUrl = (body.baseUrl as string).trim()
    } catch {
      return NextResponse.json({ error: "Invalid baseUrl format" }, { status: 400 })
    }
  }
  if (typeof body.pollIntervalMinutes === "number") updates.pollIntervalMinutes = Math.min(1440, Math.max(15, body.pollIntervalMinutes))
  if (typeof body.isActive === "boolean") updates.isActive = body.isActive
  if (typeof body.color === "string") {
    if (body.color.length > 20) {
      return NextResponse.json({ error: "Color must be 20 characters or fewer" }, { status: 400 })
    }
    updates.color = body.color
  }

  if (typeof body.qbtTag === "string") {
    if (body.qbtTag.length > 100) {
      return NextResponse.json({ error: "qBittorrent tag must be 100 characters or fewer" }, { status: 400 })
    }
    updates.qbtTag = body.qbtTag.trim()
  }

  if (typeof body.apiToken === "string") {
    if (body.apiToken.length > 500) {
      return NextResponse.json({ error: "API token must be 500 characters or fewer" }, { status: 400 })
    }
    const key = Buffer.from(auth.encryptionKey, "hex")
    updates.encryptedApiToken = encrypt(body.apiToken, key)
  }

  await db
    .update(trackers)
    .set(updates)
    .where(eq(trackers.id, trackerId))

  return NextResponse.json({ success: true })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  const trackerId = await parseTrackerId(params)
  if (trackerId instanceof NextResponse) return trackerId

  await db.delete(trackers).where(eq(trackers.id, trackerId))

  return NextResponse.json({ success: true })
}
