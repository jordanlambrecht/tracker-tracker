// src/app/api/trackers/[id]/route.ts
//
// Functions: GET, PATCH, DELETE

import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import {
  authenticate,
  decodeKey,
  parseJsonBody,
  parseTrackerId,
  validateHexColor,
  validateHttpUrl,
  validateJoinedAt,
} from "@/lib/api-helpers"
import { encrypt } from "@/lib/crypto"
import { db } from "@/lib/db"
import { trackers } from "@/lib/db/schema"
import { log } from "@/lib/logger"
import { getTrackerForClient } from "@/lib/server-data"

export async function GET(_request: Request, props: { params: Promise<{ id: string }> }) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  const trackerId = await parseTrackerId(props.params)
  if (trackerId instanceof NextResponse) return trackerId

  const tracker = await getTrackerForClient(trackerId)
  if (!tracker) return NextResponse.json({ error: "Tracker not found" }, { status: 404 })

  return NextResponse.json(tracker)
}

export async function PATCH(request: Request, props: { params: Promise<{ id: string }> }) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  const trackerId = await parseTrackerId(props.params)
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
      return NextResponse.json(
        { error: "qBittorrent tag must be 100 characters or fewer" },
        { status: 400 }
      )
    }
    updates.qbtTag = body.qbtTag.trim() || null
  }

  if (typeof body.mouseholeUrl === "string") {
    const trimmed = body.mouseholeUrl.trim()
    if (trimmed) {
      const mouseUrlErr = validateHttpUrl(trimmed, "Mousehole URL")
      if (mouseUrlErr) return mouseUrlErr
    }
    updates.mouseholeUrl = trimmed || null
  }

  if (typeof body.useProxy === "boolean") updates.useProxy = body.useProxy
  if (typeof body.countCrossSeedUnsatisfied === "boolean")
    updates.countCrossSeedUnsatisfied = body.countCrossSeedUnsatisfied
  if (typeof body.hideUnreadBadges === "boolean") updates.hideUnreadBadges = body.hideUnreadBadges
  if (typeof body.isFavorite === "boolean") updates.isFavorite = body.isFavorite
  if (typeof body.pollingPaused === "boolean") {
    updates.userPausedAt = body.pollingPaused ? new Date() : null
    if (!body.pollingPaused) {
      updates.pausedAt = null
      updates.consecutiveFailures = 0
      updates.lastError = null
    }
    log.info(
      {
        route: "PATCH /api/trackers/[id]",
        trackerId,
        action: body.pollingPaused ? "paused" : "resumed",
      },
      "polling toggled"
    )
  }

  if (body.joinedAt !== undefined) {
    if (body.joinedAt === null) {
      updates.joinedAt = null
    } else if (typeof body.joinedAt === "string") {
      const joinedAtErr = validateJoinedAt(body.joinedAt)
      if (joinedAtErr) return joinedAtErr
      updates.joinedAt = body.joinedAt
    } else {
      return NextResponse.json({ error: "joinedAt must be YYYY-MM-DD or null" }, { status: 400 })
    }
  }

  if (typeof body.apiToken === "string") {
    const trimmedToken = (body.apiToken as string).trim()
    if (trimmedToken.length > 500) {
      return NextResponse.json(
        { error: "API token must be 500 characters or fewer" },
        { status: 400 }
      )
    }
    const key = decodeKey(auth)
    updates.encryptedApiToken = encrypt(trimmedToken, key)
  }

  await db.update(trackers).set(updates).where(eq(trackers.id, trackerId))

  return NextResponse.json({ success: true })
}

export async function DELETE(_request: Request, props: { params: Promise<{ id: string }> }) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  const trackerId = await parseTrackerId(props.params)
  if (trackerId instanceof NextResponse) return trackerId

  await db.delete(trackers).where(eq(trackers.id, trackerId))

  log.info({ route: "DELETE /api/trackers/[id]", trackerId }, "tracker deleted")
  return NextResponse.json({ success: true })
}
