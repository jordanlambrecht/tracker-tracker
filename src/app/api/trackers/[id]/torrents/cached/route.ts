// src/app/api/trackers/[id]/torrents/cached/route.ts
//
// Functions: GET

import { NextResponse } from "next/server"
import { authenticate, parseTrackerId, type RouteContext } from "@/lib/api-helpers"
import { fetchTrackerTorrentsCached } from "@/lib/download-clients"

export async function GET(_request: Request, props: RouteContext) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  const trackerId = await parseTrackerId(props.params)
  if (trackerId instanceof NextResponse) return trackerId

  const out = await fetchTrackerTorrentsCached(trackerId)
  if ("error" in out) {
    return NextResponse.json({ error: out.error }, { status: out.status })
  }
  return NextResponse.json(out.result)
}
