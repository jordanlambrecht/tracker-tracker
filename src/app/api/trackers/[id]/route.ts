// src/app/api/trackers/[id]/route.ts
//
// Functions: isRowId, GET, PATCH, DELETE

import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import { trackerSiteFor } from "@/data/tracker-registry"
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
  validatePublicUrl,
} from "@/lib/api-helpers"
import { maxTokenLengthFor } from "@/lib/credential-forms"
import { encrypt } from "@/lib/crypto"
import { db } from "@/lib/db"
import { prowlarrInstances, trackers } from "@/lib/db/schema"
import { errMsg } from "@/lib/error-utils"
import { LONG_STRING_MAX, TRACKER_NAME_MAX, TRACKER_TAG_MAX } from "@/lib/limits"
import { log } from "@/lib/logger"
import { normalizePublicUrl } from "@/lib/public-url"
import { getTrackerForClient } from "@/lib/server-data"
import { NEW_KEY_RESET, PAUSE_RESET, TRACKER_UNLINKED_ERROR } from "@/lib/tracker-status"
import { isIntegerInRange } from "@/lib/validators"

// A Postgres integer id.
function isRowId(value: unknown): value is number {
  return typeof value === "number" && isIntegerInRange(value, 1, 2_147_483_647)
}

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

  // Read before anything is encrypted, so a missing row answers 404 rather than an
  // update that writes nothing and reports success. PATCH never changes the slug.
  let existing: { registrySlug: string | null; mouseholeUrl: string | null } | undefined
  try {
    ;[existing] = await db
      .select({ registrySlug: trackers.registrySlug, mouseholeUrl: trackers.mouseholeUrl })
      .from(trackers)
      .where(eq(trackers.id, trackerId))
      .limit(1)
  } catch (err) {
    log.error(
      { route: "PATCH /api/trackers/[id]", trackerId, error: errMsg(err) },
      "Failed to fetch tracker"
    )
    return NextResponse.json({ error: "Failed to load tracker" }, { status: 500 })
  }
  if (!existing) return NextResponse.json({ error: "Tracker not found" }, { status: 404 })

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
    const qbtTagErr = validateMaxLength(body.qbtTag, TRACKER_TAG_MAX, "Client tag")
    if (qbtTagErr) return qbtTagErr
    updates.qbtTag = body.qbtTag.trim() || null
  }

  // Clearing the URL clears the token and public URL with it, so neither outlives it.
  if (typeof body.mouseholeUrl === "string") {
    const trimmed = body.mouseholeUrl.trim()
    if (trimmed) {
      const mouseholeUrlErr = validateMaxLength(trimmed, LONG_STRING_MAX, "Mousehole URL")
      if (mouseholeUrlErr) return mouseholeUrlErr
      const mouseUrlErr = validateMouseholeUrl(trimmed)
      if (mouseUrlErr) return mouseUrlErr
    }
    updates.mouseholeUrl = trimmed || null
    if (!trimmed) {
      updates.encryptedMouseholeToken = null
      updates.mouseholePublicUrl = null
    }
  }

  // An empty string clears the public URL; a body without the key leaves it alone.
  if (typeof body.mouseholePublicUrl === "string" && updates.mouseholeUrl !== null) {
    const publicUrl = normalizePublicUrl(body.mouseholePublicUrl)
    if (publicUrl) {
      const publicUrlErr = validatePublicUrl(publicUrl)
      if (publicUrlErr) return publicUrlErr
      const mouseholeUrl =
        typeof body.mouseholeUrl === "string" ? body.mouseholeUrl.trim() : existing.mouseholeUrl
      if (!mouseholeUrl) {
        return NextResponse.json(
          { error: "Mousehole public URL needs a Mousehole URL" },
          { status: 400 }
        )
      }
    }
    updates.mouseholePublicUrl = publicUrl
  }

  // An empty string clears the token; a body without the key leaves it alone.
  if (typeof body.mouseholeToken === "string") {
    const trimmedMouseholeToken = body.mouseholeToken.trim()
    if (trimmedMouseholeToken) {
      const mouseholeTokenErr = validateMouseholeToken(trimmedMouseholeToken)
      if (mouseholeTokenErr) return mouseholeTokenErr
      // A token is only sent to the saved URL, so a token without one is refused.
      const mouseholeUrl =
        typeof body.mouseholeUrl === "string" ? body.mouseholeUrl.trim() : existing.mouseholeUrl
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
  // A null pin returns the tracker to hostname matching.
  if (body.prowlarrPin !== undefined) {
    const pin = body.prowlarrPin as { instanceId?: unknown; indexerId?: unknown } | null
    if (pin === null) {
      updates.prowlarrInstanceId = null
      updates.prowlarrIndexerId = null
    } else if (typeof pin === "object" && isRowId(pin.instanceId) && isRowId(pin.indexerId)) {
      const [instance] = await db
        .select({ id: prowlarrInstances.id })
        .from(prowlarrInstances)
        .where(eq(prowlarrInstances.id, pin.instanceId))
        .limit(1)
      if (!instance) {
        return NextResponse.json({ error: "Prowlarr instance not found" }, { status: 400 })
      }
      updates.prowlarrInstanceId = pin.instanceId
      updates.prowlarrIndexerId = pin.indexerId
    } else {
      return NextResponse.json(
        { error: "prowlarrPin must be null or { instanceId, indexerId }" },
        { status: 400 }
      )
    }
  }
  if (typeof body.prowlarrOptOut === "boolean") updates.prowlarrOptOut = body.prowlarrOptOut
  if (typeof body.pollingPaused === "boolean") {
    updates.userPausedAt = body.pollingPaused ? new Date() : null
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
      return NextResponse.json(
        { error: "joinedAt must be a valid YYYY-MM-DD date or null" },
        { status: 400 }
      )
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
        { error: "lastAccessAt must be a valid YYYY-MM-DD date or null" },
        { status: 400 }
      )
    }
  }

  if (typeof body.apiToken === "string") {
    const trimmedToken = (body.apiToken as string).trim()
    const site = trackerSiteFor(existing)
    // A key reaches an unlinked row only by linking it, which tests the key on
    // the tracker picked. Saved here, it would belong to no tracker.
    if (!site) {
      return NextResponse.json({ error: TRACKER_UNLINKED_ERROR }, { status: 400 })
    }
    const maxTokenLength = maxTokenLengthFor(site?.platform)
    const tokenErr = validateMaxLength(trimmedToken, maxTokenLength, "API token")
    if (tokenErr) return tokenErr
    const key = decodeKey(auth)
    updates.encryptedApiToken = encrypt(trimmedToken, key)
    Object.assign(updates, NEW_KEY_RESET)
  }

  try {
    await db.update(trackers).set(updates).where(eq(trackers.id, trackerId))
    // The auto-pause comes off a linked row only. An unlinked one stays paused with
    // its reason, since nothing may poll it.
    if (body.pollingPaused === false && trackerSiteFor(existing)) {
      await db.update(trackers).set(PAUSE_RESET).where(eq(trackers.id, trackerId))
    }
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
