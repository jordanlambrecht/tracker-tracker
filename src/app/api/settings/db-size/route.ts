// src/app/api/settings/db-size/route.ts

import { NextResponse } from "next/server"
import { authenticate } from "@/lib/api-helpers"
import { errMsg } from "@/lib/error-utils"
import { log } from "@/lib/logger"
import { getDbSizeHistory } from "@/lib/server-data"

export async function GET() {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  try {
    const data = await getDbSizeHistory()
    return NextResponse.json(data)
  } catch (err) {
    log.error({ route: "GET /api/settings/db-size", error: errMsg(err) }, "Failed to fetch DB size history")
    return NextResponse.json({ error: "Failed to load database size history" }, { status: 500 })
  }
}
