// src/app/api/trackers/snapshots/fleet/route.ts
//
// Functions: GET

import { NextResponse } from "next/server"
import { authenticate } from "@/lib/api-helpers"
import { getFleetSnapshots } from "@/lib/server-data"
import { parseIntClamped } from "@/lib/validators"

export async function GET(request: Request) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  const url = new URL(request.url)
  const days = parseIntClamped(url.searchParams.get("days"), 0, 3650, 30)

  const data = await getFleetSnapshots(days)
  return NextResponse.json(data)
}
