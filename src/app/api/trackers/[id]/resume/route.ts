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
    .select({ pausedAt: trackers.pausedAt })
    .from(trackers)
    .where(eq(trackers.id, trackerId))
    .limit(1)

  if (!tracker) {
    return NextResponse.json({ error: "Tracker not found" }, { status: 404 })
  }

  if (!tracker.pausedAt) {
    return NextResponse.json({ error: "Tracker is not paused" }, { status: 400 })
  }

  try {
    await db
      .update(trackers)
      .set({ pausedAt: null, lastError: null, updatedAt: new Date() })
      .where(eq(trackers.id, trackerId))
  } catch (error) {
    log.error(error, `Failed to resume tracker ${trackerId}`)
    return NextResponse.json({ error: "Failed to resume tracker" }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
