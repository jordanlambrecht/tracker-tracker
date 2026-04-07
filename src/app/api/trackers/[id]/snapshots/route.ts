// src/app/api/trackers/[id]/snapshots/route.ts

import { NextResponse } from "next/server"
import { authenticate, parseTrackerId, type RouteContext } from "@/lib/api-helpers"
import { errMsg } from "@/lib/error-utils"
import { log } from "@/lib/logger"
import { getSnapshotsForTracker } from "@/lib/server-data"
import { parseIntClamped } from "@/lib/validators"

export async function GET(request: Request, props: RouteContext) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  const trackerId = await parseTrackerId(props.params)
  if (trackerId instanceof NextResponse) return trackerId

  const url = new URL(request.url)
  const days = parseIntClamped(url.searchParams.get("days"), 0, 3650, 30)

  try {
    const snapshots = await getSnapshotsForTracker(trackerId, days)
    return NextResponse.json(snapshots)
  } catch (err) {
    log.error(
      { route: "GET /api/trackers/[id]/snapshots", trackerId, error: errMsg(err) },
      "Failed to fetch snapshots"
    )
    return NextResponse.json({ error: "Failed to load snapshots" }, { status: 500 })
  }
}
