// src/app/api/fleet/torrents/route.ts
//
// Functions: GET

import { NextResponse } from "next/server"
import { authenticate, decodeKey } from "@/lib/api-helpers"
import { fetchFleetTorrents } from "@/lib/download-clients"
import { log } from "@/lib/logger"

export async function GET() {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth
  const key = decodeKey(auth)

  try {
    const result = await fetchFleetTorrents(key)

    if (result.sessionExpired) {
      log.warn({ route: "GET /api/fleet/torrents" }, "fleet fetch failed — stale session key")
      return NextResponse.json({ error: "Session expired. Please log in again." }, { status: 401 })
    }

    return NextResponse.json(result)
  } catch (error) {
    log.error(
      { route: "GET /api/fleet/torrents", error: String(error) },
      "fleet torrent fetch failed"
    )
    return NextResponse.json({ error: "Failed to fetch fleet torrents" }, { status: 500 })
  }
}
