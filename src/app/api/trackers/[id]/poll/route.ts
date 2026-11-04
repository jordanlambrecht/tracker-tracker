// src/app/api/trackers/[id]/poll/route.ts
import { and, eq, isNull, lte, or } from "drizzle-orm"
import { NextResponse } from "next/server"
import { trackerSiteFor } from "@/data/tracker-registry"
import {
  authenticate,
  decodeKey,
  parseTrackerId,
  type RouteContext,
  refuseIfOutboundDisabled,
} from "@/lib/api-helpers"
import { db } from "@/lib/db"
import { appSettings, trackers } from "@/lib/db/schema"
import { POLL_MANUAL_COOLDOWN_MS } from "@/lib/limits"
import { log } from "@/lib/logger"
import { pollTracker } from "@/lib/tracker-scheduler"
import { TRACKER_DEFUNCT_ERROR, TRACKER_UNLINKED_ERROR } from "@/lib/tracker-status"
import { buildProxyAgentFromSettings } from "@/lib/tunnel"

// The claim holds lastPolledAt only as a cooldown. A poll that didn't succeed
// hands back the time it replaced, unless a poll that did has written it since.
async function releaseClaim(trackerId: number, claimedAt: Date, previous: Date | null) {
  try {
    await db
      .update(trackers)
      .set({ lastPolledAt: previous })
      .where(and(eq(trackers.id, trackerId), eq(trackers.lastPolledAt, claimedAt)))
  } catch (error) {
    log.error(
      { route: "POST /api/trackers/[id]/poll", trackerId, error: String(error) },
      "manual poll cooldown not released"
    )
  }
}

export async function POST(_request: Request, props: RouteContext) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth
  const refusal = refuseIfOutboundDisabled()
  if (refusal) return refusal

  const trackerId = await parseTrackerId(props.params)
  if (trackerId instanceof NextResponse) return trackerId

  // Refused before the claim, so a refusal never starts the cooldown.
  const [tracker] = await db
    .select({ registrySlug: trackers.registrySlug, lastPolledAt: trackers.lastPolledAt })
    .from(trackers)
    .where(eq(trackers.id, trackerId))
    .limit(1)
  if (!tracker) {
    return NextResponse.json({ error: "Tracker not found" }, { status: 404 })
  }
  const site = trackerSiteFor(tracker)
  if (!site) {
    return NextResponse.json({ error: TRACKER_UNLINKED_ERROR }, { status: 400 })
  }
  if (site.entry.defunct) {
    return NextResponse.json({ error: TRACKER_DEFUNCT_ERROR }, { status: 400 })
  }

  // Atomically claim poll slot. Prevents TOCTOU race with multiple tabs
  const threshold = new Date(Date.now() - POLL_MANUAL_COOLDOWN_MS)
  const claimedAt = new Date()
  const [claimed] = await db
    .update(trackers)
    .set({ lastPolledAt: claimedAt })
    .where(
      and(
        eq(trackers.id, trackerId),
        or(isNull(trackers.lastPolledAt), lte(trackers.lastPolledAt, threshold))
      )
    )
    .returning({ id: trackers.id })

  if (!claimed) {
    return NextResponse.json(
      { error: "Polled a moment ago. Try again in a few seconds" },
      { status: 429 }
    )
  }

  const key = decodeKey(auth)

  const [settings] = await db
    .select({
      storeUsernames: appSettings.storeUsernames,
      proxyEnabled: appSettings.proxyEnabled,
      proxyType: appSettings.proxyType,
      proxyHost: appSettings.proxyHost,
      proxyPort: appSettings.proxyPort,
      proxyUsername: appSettings.proxyUsername,
      encryptedProxyPassword: appSettings.encryptedProxyPassword,
    })
    .from(appSettings)
    .limit(1)

  const privacyMode = settings ? !settings.storeUsernames : false
  const proxyAgent = settings ? buildProxyAgentFromSettings(settings, key) : undefined

  // pollTracker records a failed poll on the row itself, so only a database
  // fault reaches the catch. A recorded failure still answers 200, which makes
  // Poll Now refetch the row and show its error, with success saying which it was.
  let polled = false
  try {
    polled = await pollTracker(trackerId, key, privacyMode, proxyAgent, undefined, undefined, true)
    return NextResponse.json({ success: polled })
  } catch (error) {
    log.error(
      { route: "POST /api/trackers/[id]/poll", trackerId, error: String(error) },
      "manual poll failed"
    )
    return NextResponse.json({ error: "Poll failed" }, { status: 500 })
  } finally {
    if (!polled) await releaseClaim(trackerId, claimedAt, tracker.lastPolledAt)
  }
}
