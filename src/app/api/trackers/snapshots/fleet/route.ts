// src/app/api/trackers/snapshots/fleet/route.ts
//
// Functions: GET

import { NextResponse } from "next/server"
import { authenticate } from "@/lib/api-helpers"
import { errMsg } from "@/lib/error-utils"
import { log } from "@/lib/logger"
import { getFleetSnapshots } from "@/lib/server-data"
import { parseIntClamped } from "@/lib/validators"

export async function GET(request: Request) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  const url = new URL(request.url)
  const days = parseIntClamped(url.searchParams.get("days"), 0, 3650, 30)

  try {
    const data = await getFleetSnapshots(days)
    return NextResponse.json(data)
  } catch (err) {
    log.error(
      { route: "GET /api/trackers/snapshots/fleet", error: errMsg(err) },
      "Failed to fetch fleet snapshots"
    )
    return NextResponse.json({ error: "Failed to load fleet snapshots" }, { status: 500 })
  }
}
