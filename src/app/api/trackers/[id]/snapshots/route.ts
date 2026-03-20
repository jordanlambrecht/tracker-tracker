// src/app/api/trackers/[id]/snapshots/route.ts

import { NextResponse } from "next/server"
import { authenticate, parseTrackerId } from "@/lib/api-helpers"
import { getSnapshotsForTracker } from "@/lib/server-data"

export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  const trackerId = await parseTrackerId(props.params)
  if (trackerId instanceof NextResponse) return trackerId

  const url = new URL(request.url)
  const daysParam = url.searchParams.get("days")
  const daysRaw = parseInt(daysParam ?? "30", 10)
  const days = Number.isNaN(daysRaw) ? 30 : daysRaw

  const snapshots = await getSnapshotsForTracker(trackerId, days)
  return NextResponse.json(snapshots)
}
