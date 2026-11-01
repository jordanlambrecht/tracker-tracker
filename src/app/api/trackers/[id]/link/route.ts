// src/app/api/trackers/[id]/link/route.ts
//
// Links an unlinked row to a tracker in the list. Every such row was saved for a
// host no entry carries, or the startup backfill would have linked it, so a link
// always moves the row to another host. It takes a new key, typed for the chosen
// tracker and tested there by the dialog, and never reads the stored one.

import { and, eq, isNull } from "drizzle-orm"
import { NextResponse } from "next/server"
import { getTrackerBySlug } from "@/data/tracker-registry"
import {
  authenticate,
  decodeKey,
  parseJsonBody,
  parseTrackerId,
  type RouteContext,
  validateMaxLength,
} from "@/lib/api-helpers"
import { maxTokenLengthFor } from "@/lib/credential-forms"
import { encrypt } from "@/lib/crypto"
import { db } from "@/lib/db"
import { trackers } from "@/lib/db/schema"
import { errMsg } from "@/lib/error-utils"
import { log } from "@/lib/logger"
import { getTrackerForClient, isRegistrySlugHeld } from "@/lib/server-data"
import {
  NEW_KEY_RESET,
  PAUSE_RESET,
  TRACKER_ALREADY_LINKED_ERROR,
  TRACKER_DEFUNCT_ERROR,
  TRACKER_UNKNOWN_ERROR,
  trackerHeldError,
} from "@/lib/tracker-status"

export async function POST(request: Request, props: RouteContext) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  const trackerId = await parseTrackerId(props.params)
  if (trackerId instanceof NextResponse) return trackerId

  const body = await parseJsonBody(request)
  if (body instanceof NextResponse) return body

  const { slug, apiToken } = body as { slug?: unknown; apiToken?: unknown }
  const entry = typeof slug === "string" ? getTrackerBySlug(slug.trim()) : undefined
  if (!entry) {
    return NextResponse.json({ error: TRACKER_UNKNOWN_ERROR }, { status: 400 })
  }
  if (entry.defunct) {
    return NextResponse.json({ error: TRACKER_DEFUNCT_ERROR }, { status: 400 })
  }

  if (typeof apiToken !== "string" || !apiToken.trim()) {
    return NextResponse.json({ error: "apiToken is required" }, { status: 400 })
  }
  const trimmedToken = apiToken.trim()
  const tokenErr = validateMaxLength(trimmedToken, maxTokenLengthFor(entry.platform), "API token")
  if (tokenErr) return tokenErr

  try {
    const [row] = await db
      .select({ registrySlug: trackers.registrySlug })
      .from(trackers)
      .where(eq(trackers.id, trackerId))
      .limit(1)
    if (!row) {
      return NextResponse.json({ error: "Tracker not found" }, { status: 404 })
    }
    if (row.registrySlug !== null) {
      return NextResponse.json({ error: TRACKER_ALREADY_LINKED_ERROR }, { status: 409 })
    }
    // Two links or adds at once can both pass this until registry_slug has a
    // unique index.
    if (await isRegistrySlugHeld(entry.slug)) {
      return NextResponse.json({ error: trackerHeldError(entry.name) }, { status: 409 })
    }

    // Only while the slug is still null, so a link made since the select stands.
    const [linked] = await db
      .update(trackers)
      .set({
        registrySlug: entry.slug,
        baseUrl: entry.url,
        apiPath: entry.apiPath,
        platformType: entry.platform,
        encryptedApiToken: encrypt(trimmedToken, decodeKey(auth)),
        ...NEW_KEY_RESET,
        ...PAUSE_RESET,
        updatedAt: new Date(),
      })
      .where(and(eq(trackers.id, trackerId), isNull(trackers.registrySlug)))
      .returning({ id: trackers.id })
    if (!linked) {
      return NextResponse.json({ error: TRACKER_ALREADY_LINKED_ERROR }, { status: 409 })
    }

    log.info(
      { route: "POST /api/trackers/[id]/link", trackerId, slug: entry.slug },
      "tracker linked"
    )
    const updated = await getTrackerForClient(trackerId)
    if (!updated) {
      return NextResponse.json({ error: "Tracker not found" }, { status: 404 })
    }
    return NextResponse.json(updated)
  } catch (err) {
    log.error(
      { route: "POST /api/trackers/[id]/link", trackerId, error: errMsg(err) },
      "Failed to link tracker"
    )
    return NextResponse.json({ error: "Failed to link tracker" }, { status: 500 })
  }
}
