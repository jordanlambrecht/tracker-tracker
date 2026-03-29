// src/app/api/trackers/[id]/snapshots/route.ts

import { NextResponse } from "next/server"
import { authenticate, parseTrackerId, type RouteContext } from "@/lib/api-helpers"
import { getSnapshotsForTracker } from "@/lib/server-data"

export async function GET(request: Request, props: RouteContext) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  const trackerId = await parseTrackerId(props.params)
  if (trackerId instanceof NextResponse) return trackerId

  const url = new URL(request.url)
  const daysParam = parseInt(url.searchParams.get("days") ?? "30", 10)
  const days = Math.min(Math.max(1, Number.isNaN(daysParam) ? 30 : daysParam), 3650) // Max 10 years

  const snapshots = await getSnapshotsForTracker(trackerId, days)
  return NextResponse.json(snapshots)
}
