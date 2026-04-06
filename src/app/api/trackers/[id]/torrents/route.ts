// src/app/api/trackers/[id]/torrents/route.ts
//
// Functions: GET

import { NextResponse } from "next/server"
import { authenticate, decodeKey, parseTrackerId, type RouteContext } from "@/lib/api-helpers"
import { fetchTrackerTorrents } from "@/lib/download-clients"
import { log } from "@/lib/logger"

export async function GET(request: Request, props: RouteContext) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  const trackerId = await parseTrackerId(props.params)
  if (trackerId instanceof NextResponse) return trackerId

  const key = decodeKey(auth)
  const url = new URL(request.url)
  const activeOnly = url.searchParams.get("active") === "true"
  const qbtFilter = activeOnly ? "active" : undefined

  try {
    const out = await fetchTrackerTorrents(trackerId, key, qbtFilter)
    if ("error" in out) {
      return NextResponse.json({ error: out.error }, { status: out.status })
    }
    return NextResponse.json(out.result)
  } catch (error) {
    log.error(
      { route: "GET /api/trackers/[id]/torrents", trackerId, error: String(error) },
      "torrent fetch failed"
    )
    return NextResponse.json({ error: "Failed to fetch torrents" }, { status: 502 })
  }
}
