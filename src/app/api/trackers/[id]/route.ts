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
  type RouteContext,
  validateHexColor,
  validateJoinedAt,
  validateLastAccessAt,
  validateMaxLength,
  validateMouseholeToken,
  validateMouseholeUrl,
} from "@/lib/api-helpers"
import { encrypt } from "@/lib/crypto"
import { db } from "@/lib/db"
import { trackers } from "@/lib/db/schema"
import { errMsg } from "@/lib/error-utils"
import { LONG_STRING_MAX, maxTokenLengthFor, TRACKER_NAME_MAX, TRACKER_TAG_MAX } from "@/lib/limits"
import { log } from "@/lib/logger"
import { isValidIndexerOverride } from "@/lib/prowlarr/matching"
import { getTrackerForClient } from "@/lib/server-data"

export async function GET(_request: Request, props: RouteContext) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  const trackerId = await parseTrackerId(props.params)
  if (trackerId instanceof NextResponse) return trackerId

  try {
    const tracker = await getTrackerForClient(trackerId)
    if (!tracker) return NextResponse.json({ error: "Tracker not found" }, { status: 404 })
    return NextResponse.json(tracker)
  } catch (err) {
    log.error(
      { route: "GET /api/trackers/[id]", trackerId, error: errMsg(err) },
      "Failed to fetch tracker"
    )
    return NextResponse.json({ error: "Failed to load tracker" }, { status: 500 })
  }
}

export async function PATCH(request: Request, props: RouteContext) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  const trackerId = await parseTrackerId(props.params)
  if (trackerId instanceof NextResponse) return trackerId

  const body = await parseJsonBody(request)
  if (body instanceof NextResponse) return body

  const updates: Record<string, unknown> = { updatedAt: new Date() }

  if (typeof body.name === "string") {
    const nameErr = validateMaxLength(body.name, TRACKER_NAME_MAX, "Name")
    if (nameErr) return nameErr
    updates.name = body.name.trim()
  }
  // No baseUrl: the URL is registry data copied in when the tracker was added, so
  // an edit body carrying one, valid or hostile, is ignored.
  if (typeof body.isActive === "boolean") updates.isActive = body.isActive
  if (typeof body.color === "string") {
    const colorErr = validateHexColor(body.color)
    if (colorErr) return colorErr
    updates.color = body.color
  }

  if (typeof body.qbtTag === "string") {
    const qbtTagErr = validateMaxLength(body.qbtTag, TRACKER_TAG_MAX, "qBittorrent tag")
    if (qbtTagErr) return qbtTagErr
    updates.qbtTag = body.qbtTag.trim() || null
  }

  // Clearing the URL clears the token with it, so no token outlives its URL.
  if (typeof body.mouseholeUrl === "string") {
    const trimmed = body.mouseholeUrl.trim()
    if (trimmed) {
      const mouseholeUrlErr = validateMaxLength(trimmed, LONG_STRING_MAX, "Mousehole URL")
      if (mouseholeUrlErr) return mouseholeUrlErr
      const mouseUrlErr = validateMouseholeUrl(trimmed)
      if (mouseUrlErr) return mouseUrlErr
    }
    updates.mouseholeUrl = trimmed || null
    if (!trimmed) updates.encryptedMouseholeToken = null
  }

  // An empty string clears the token; a body without the key leaves it alone.
  if (typeof body.mouseholeToken === "string") {
    const trimmedMouseholeToken = body.mouseholeToken.trim()
    if (trimmedMouseholeToken) {
      const mouseholeTokenErr = validateMouseholeToken(trimmedMouseholeToken)
      if (mouseholeTokenErr) return mouseholeTokenErr
      // A token is only sent to the saved URL, so a token without one is refused.
      let mouseholeUrl = typeof body.mouseholeUrl === "string" ? body.mouseholeUrl.trim() : null
      if (mouseholeUrl === null) {
        const [row] = await db
          .select({ mouseholeUrl: trackers.mouseholeUrl })
          .from(trackers)
          .where(eq(trackers.id, trackerId))
          .limit(1)
        mouseholeUrl = row?.mouseholeUrl ?? ""
      }
      if (!mouseholeUrl) {
        return NextResponse.json(
          { error: "Mousehole API token needs a Mousehole URL" },
          { status: 400 }
        )
      }
    }
    updates.encryptedMouseholeToken = trimmedMouseholeToken
      ? encrypt(trimmedMouseholeToken, decodeKey(auth))
      : null
  }

  if (typeof body.useProxy === "boolean") updates.useProxy = body.useProxy
  if (typeof body.countCrossSeedUnsatisfied === "boolean")
    updates.countCrossSeedUnsatisfied = body.countCrossSeedUnsatisfied
  if (typeof body.hideUnreadBadges === "boolean") updates.hideUnreadBadges = body.hideUnreadBadges
  if (typeof body.isFavorite === "boolean") updates.isFavorite = body.isFavorite
  // null returns the tracker to hostname matching.
  if (body.prowlarrIndexer !== undefined) {
    if (body.prowlarrIndexer === null) {
      updates.prowlarrIndexer = null
    } else if (
      typeof body.prowlarrIndexer === "string" &&
      isValidIndexerOverride(body.prowlarrIndexer)
    ) {
      updates.prowlarrIndexer = body.prowlarrIndexer
    } else {
      return NextResponse.json(
        { error: 'prowlarrIndexer must be null, "none" or "<instanceId>:<indexerId>"' },
        { status: 400 }
      )
    }
  }
  if (typeof body.pollingPaused === "boolean") {
    updates.userPausedAt = body.pollingPaused ? new Date() : null
    if (!body.pollingPaused) {
      updates.pausedAt = null
      updates.consecutiveFailures = 0
      updates.lastError = null
      updates.lastErrorAt = null
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

  if (body.lastAccessAt !== undefined) {
    if (body.lastAccessAt === null) {
      updates.lastAccessAt = null
    } else if (typeof body.lastAccessAt === "string") {
      const lastAccessAtErr = validateLastAccessAt(body.lastAccessAt)
      if (lastAccessAtErr) return lastAccessAtErr
      updates.lastAccessAt = body.lastAccessAt
    } else {
      return NextResponse.json(
        { error: "lastAccessAt must be YYYY-MM-DD or null" },
        { status: 400 }
      )
    }
  }

  if (typeof body.apiToken === "string") {
    const trimmedToken = (body.apiToken as string).trim()
    const [tracker] = await db
      .select({ platformType: trackers.platformType })
      .from(trackers)
      .where(eq(trackers.id, trackerId))
      .limit(1)
    const maxTokenLength = maxTokenLengthFor(tracker?.platformType)
    const tokenErr = validateMaxLength(trimmedToken, maxTokenLength, "API token")
    if (tokenErr) return tokenErr
    const key = decodeKey(auth)
    updates.encryptedApiToken = encrypt(trimmedToken, key)
  }

  try {
    await db.update(trackers).set(updates).where(eq(trackers.id, trackerId))
    const updated = await getTrackerForClient(trackerId)
    return NextResponse.json(updated ?? { success: true })
  } catch (err) {
    log.error(
      { route: "PATCH /api/trackers/[id]", trackerId, error: errMsg(err) },
      "Failed to update tracker"
    )
    return NextResponse.json({ error: "Failed to update tracker" }, { status: 500 })
  }
}

export async function DELETE(_request: Request, props: RouteContext) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  const trackerId = await parseTrackerId(props.params)
  if (trackerId instanceof NextResponse) return trackerId

  try {
    await db.delete(trackers).where(eq(trackers.id, trackerId))
    log.info({ route: "DELETE /api/trackers/[id]", trackerId }, "tracker deleted")
    return NextResponse.json({ success: true })
  } catch (err) {
    log.error(
      { route: "DELETE /api/trackers/[id]", trackerId, error: errMsg(err) },
      "Failed to delete tracker"
    )
    return NextResponse.json({ error: "Failed to delete tracker" }, { status: 500 })
  }
}
