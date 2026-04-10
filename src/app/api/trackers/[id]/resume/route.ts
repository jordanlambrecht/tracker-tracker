// src/app/api/trackers/[id]/resume/route.ts
import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import { authenticate, parseTrackerId, type RouteContext } from "@/lib/api-helpers"
import { db } from "@/lib/db"
import { trackers } from "@/lib/db/schema"
import { log } from "@/lib/logger"

export async function POST(_request: Request, props: RouteContext) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  const trackerId = await parseTrackerId(props.params)
  if (trackerId instanceof NextResponse) return trackerId

  const [tracker] = await db
    .select({
      pausedAt: trackers.pausedAt,
      consecutiveFailures: trackers.consecutiveFailures,
      lastError: trackers.lastError,
    })
    .from(trackers)
    .where(eq(trackers.id, trackerId))
    .limit(1)

  if (!tracker) {
    return NextResponse.json({ error: "Tracker not found" }, { status: 404 })
  }

  if (!tracker.pausedAt) {
    log.info(
      {
        route: "POST /api/trackers/[id]/resume",
        trackerId,
        consecutiveFailures: tracker.consecutiveFailures,
        lastError: tracker.lastError,
      },
      "resume called but tracker is not paused (idempotent OK)"
    )
    return NextResponse.json({ success: true, alreadyResumed: true })
  }

  log.info(
    {
      route: "POST /api/trackers/[id]/resume",
      trackerId,
      pausedAt: tracker.pausedAt.toISOString(),
      consecutiveFailures: tracker.consecutiveFailures,
      lastError: tracker.lastError,
    },
    "resuming auto-paused tracker"
  )

  try {
    await db
      .update(trackers)
      .set({
        pausedAt: null,
        lastError: null,
        lastErrorAt: null,
        consecutiveFailures: 0,
        updatedAt: new Date(),
      })
      .where(eq(trackers.id, trackerId))
  } catch (error) {
    log.error(error, `Failed to resume tracker ${trackerId}`)
    return NextResponse.json({ error: "Failed to resume tracker" }, { status: 500 })
  }

  log.info(
    { route: "POST /api/trackers/[id]/resume", trackerId },
    "tracker resumed, consecutiveFailures reset to 0"
  )

  return NextResponse.json({ success: true })
}
