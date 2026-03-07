// src/app/api/trackers/[id]/route.ts
//
// Functions: PATCH, DELETE

import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { encrypt } from "@/lib/crypto"
import { db } from "@/lib/db"
import { trackers } from "@/lib/db/schema"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let session: { encryptionKey: string }
  try {
    session = await requireAuth()
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const trackerId = parseInt(id, 10)
  if (Number.isNaN(trackerId)) {
    return NextResponse.json({ error: "Invalid tracker ID" }, { status: 400 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() }

  if (typeof body.name === "string") updates.name = body.name.trim()
  if (typeof body.baseUrl === "string") {
    try {
      new URL(body.baseUrl as string)
      updates.baseUrl = (body.baseUrl as string).trim()
    } catch {
      return NextResponse.json({ error: "Invalid baseUrl format" }, { status: 400 })
    }
  }
  if (typeof body.pollIntervalMinutes === "number") updates.pollIntervalMinutes = body.pollIntervalMinutes
  if (typeof body.isActive === "boolean") updates.isActive = body.isActive
  if (typeof body.color === "string") updates.color = body.color

  if (typeof body.apiToken === "string") {
    const key = Buffer.from(session.encryptionKey, "hex")
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
  try {
    await requireAuth()
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const trackerId = parseInt(id, 10)
  if (Number.isNaN(trackerId)) {
    return NextResponse.json({ error: "Invalid tracker ID" }, { status: 400 })
  }

  await db.delete(trackers).where(eq(trackers.id, trackerId))

  return NextResponse.json({ success: true })
}
