// src/app/api/settings/logs/download/route.ts

import { createReadStream, existsSync } from "node:fs"
import { dirname } from "node:path"
import { Readable } from "node:stream"
import { NextResponse } from "next/server"
import { authenticate } from "@/lib/api-helpers"
import { DEFAULT_LOG_FILE, DEV_LOG_FILE } from "@/lib/constants"
import { localDateStr } from "@/lib/formatters"
import { log } from "@/lib/logger"

export async function GET(): Promise<Response> {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  const logFile =
    process.env.LOG_FILE ??
    (existsSync(dirname(DEFAULT_LOG_FILE)) ? DEFAULT_LOG_FILE : DEV_LOG_FILE)

  if (!existsSync(logFile)) {
    return NextResponse.json({ error: "Log file not found" }, { status: 404 })
  }

  try {
    const stream = createReadStream(logFile)
    const webStream = Readable.toWeb(stream) as ReadableStream
    const today = localDateStr()

    return new Response(webStream, {
      headers: {
        "Content-Type": "application/x-ndjson",
        "Content-Disposition": `attachment; filename="tracker-tracker-${today}.log"`,
        "Cache-Control": "no-store",
      },
    })
  } catch {
    log.error({ route: "GET /api/settings/logs/download" }, "failed to stream log file")
    return NextResponse.json({ error: "Failed to download log file" }, { status: 500 })
  }
}
