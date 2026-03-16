// src/app/api/trackers/[id]/route.ts
//
// Functions: GET, PATCH, DELETE

import { desc, eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import { authenticate, decodeKey, parseJsonBody, parseTrackerId, validateHexColor, validateHttpUrl } from "@/lib/api-helpers"
import { encrypt } from "@/lib/crypto"
import { db } from "@/lib/db"
import { appSettings, trackerSnapshots, trackers } from "@/lib/db/schema"
import { createPrivacyMaskSync } from "@/lib/privacy-db"
import { serializeTrackerResponse } from "@/lib/tracker-serializer"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  const trackerId = await parseTrackerId(params)
  if (trackerId instanceof NextResponse) return trackerId

  const [[tracker], [latest], [privacySettings]] = await Promise.all([
    db
      .select()
      .from(trackers)
      .where(eq(trackers.id, trackerId))
      .limit(1),
    db
      .select()
      .from(trackerSnapshots)
      .where(eq(trackerSnapshots.trackerId, trackerId))
      .orderBy(desc(trackerSnapshots.polledAt))
      .limit(1),
    db.select({ storeUsernames: appSettings.storeUsernames }).from(appSettings).limit(1),
  ])

  if (!tracker) {
    return NextResponse.json({ error: "Tracker not found" }, { status: 404 })
  }

  // Fallback true = "store usernames" = no masking. Matches createPrivacyMask()
  // behavior when no settings row exists. Do NOT change to false.
  const mask = createPrivacyMaskSync(privacySettings?.storeUsernames ?? true)

  // security-audit-ignore: serializeTrackerResponse omits encryptedApiToken by design
  return NextResponse.json(serializeTrackerResponse(tracker, latest ?? null, mask))
}

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
    const urlErr = validateHttpUrl(body.baseUrl as string)
    if (urlErr) return urlErr
    updates.baseUrl = (body.baseUrl as string).trim()
  }
  if (typeof body.isActive === "boolean") updates.isActive = body.isActive
  if (typeof body.color === "string") {
    const colorErr = validateHexColor(body.color)
    if (colorErr) return colorErr
    updates.color = body.color
  }

  if (typeof body.qbtTag === "string") {
    if (body.qbtTag.length > 100) {
      return NextResponse.json({ error: "qBittorrent tag must be 100 characters or fewer" }, { status: 400 })
    }
    updates.qbtTag = body.qbtTag.trim() || null
  }

  if (typeof body.useProxy === "boolean") updates.useProxy = body.useProxy
  if (typeof body.countCrossSeedUnsatisfied === "boolean") updates.countCrossSeedUnsatisfied = body.countCrossSeedUnsatisfied
  if (typeof body.isFavorite === "boolean") updates.isFavorite = body.isFavorite

  if (body.joinedAt !== undefined) {
    if (body.joinedAt === null) {
      updates.joinedAt = null
    } else if (typeof body.joinedAt === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.joinedAt)) {
      if (body.joinedAt > new Date().toISOString().split("T")[0]) {
        return NextResponse.json({ error: "Join date cannot be in the future" }, { status: 400 })
      }
      updates.joinedAt = body.joinedAt
    } else {
      return NextResponse.json({ error: "joinedAt must be YYYY-MM-DD or null" }, { status: 400 })
    }
  }

  if (typeof body.apiToken === "string") {
    if (body.apiToken.length > 500) {
      return NextResponse.json({ error: "API token must be 500 characters or fewer" }, { status: 400 })
    }
    const key = decodeKey(auth)
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
