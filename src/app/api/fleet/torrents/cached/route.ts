// src/app/api/fleet/torrents/cached/route.ts
//
// Functions: GET

import { NextResponse } from "next/server"
import { authenticate } from "@/lib/api-helpers"
import { fetchFleetAggregation } from "@/lib/download-clients"
import { log } from "@/lib/logger"

export async function GET() {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  try {
    const result = await fetchFleetAggregation()
    return NextResponse.json(result)
  } catch (error) {
    log.error(
      error instanceof Error ? error : { err: String(error) },
      "GET /api/fleet/torrents/cached failed"
    )
    return NextResponse.json({ error: "Failed to load fleet data" }, { status: 500 })
  }
}
