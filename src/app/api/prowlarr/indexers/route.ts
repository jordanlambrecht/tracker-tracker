// src/app/api/prowlarr/indexers/route.ts
//
// Functions: GET

import { NextResponse } from "next/server"
import { authenticate } from "@/lib/api-helpers"
import { errMsg } from "@/lib/error-utils"
import { log } from "@/lib/logger"
import { listIndexerOptions } from "@/lib/prowlarr/sync"

export async function GET() {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  try {
    return NextResponse.json(await listIndexerOptions())
  } catch (err) {
    log.error(
      { route: "GET /api/prowlarr/indexers", error: errMsg(err) },
      "Failed to list indexers"
    )
    return NextResponse.json({ error: "Failed to load Prowlarr indexers" }, { status: 500 })
  }
}
