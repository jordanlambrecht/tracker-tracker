// src/app/api/fleet/torrents/cached/route.ts
//
// Functions: GET

import { NextResponse } from "next/server"
import { authenticate } from "@/lib/api-helpers"
import { fetchFleetAggregation } from "@/lib/download-clients"
import { log } from "@/lib/logger"
import { getTagGroupsWithMembers } from "@/lib/server-data"

export async function GET() {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  try {
    // Tag groups are opt-in and most installs have none, in which case the aggregation
    // skips the tag counting entirely. Counting here rather than in a second endpoint keeps
    // one source of truth for which torrents belong to which tracker, and lets the dashboard's
    // Tag Groups section share this response with the Torrent Fleet tab.
    const tagGroups = await getTagGroupsWithMembers().catch(() => [])
    const result = await fetchFleetAggregation({ tagGroups })
    return NextResponse.json(result)
  } catch (error) {
    log.error(
      error instanceof Error ? error : { err: String(error) },
      "GET /api/fleet/torrents/cached failed"
    )
    return NextResponse.json({ error: "Failed to load fleet data" }, { status: 500 })
  }
}
