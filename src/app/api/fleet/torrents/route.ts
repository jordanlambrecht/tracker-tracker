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
    return NextResponse.json(await fetchFleetTorrents(key))
  } catch (error) {
    log.error(
      { route: "GET /api/fleet/torrents", error: String(error) },
      "fleet torrent fetch failed"
    )
    return NextResponse.json({ error: "Failed to fetch fleet torrents" }, { status: 500 })
  }
}
