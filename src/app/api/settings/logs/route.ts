// src/app/api/settings/logs/route.ts
//
// Functions: GET, DELETE

import { writeFile } from "node:fs/promises"
import { NextResponse } from "next/server"
import { authenticate } from "@/lib/api-helpers"
import { DEFAULT_LOG_FILE } from "@/lib/constants"
import { log } from "@/lib/logger"
import { readLogTail } from "@/lib/log-reader"

const MAX_BYTES = 64 * 1024 // Read last 64 KB

export async function GET(): Promise<NextResponse> {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  try {
    const { content, sizeBytes } = await readLogTail(MAX_BYTES)
    return NextResponse.json({ content, sizeBytes })
  } catch (err) {
    if (err instanceof Error && "code" in err && (err as NodeJS.ErrnoException).code === "ENOENT") {
      return NextResponse.json({ content: "", sizeBytes: 0 })
    }
    log.error({ route: "GET /api/settings/logs" }, "failed to read log file")
    return NextResponse.json({ error: "Failed to read log file" }, { status: 500 })
  }
}

export async function DELETE(_request: Request): Promise<NextResponse> {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  const logFile = process.env.LOG_FILE || DEFAULT_LOG_FILE
  try {
    await writeFile(logFile, "", "utf8")
    log.info({ route: "DELETE /api/settings/logs" }, "log file cleared by user")
    return NextResponse.json({ success: true })
  } catch {
    log.error({ route: "DELETE /api/settings/logs" }, "failed to clear log file")
    return NextResponse.json({ error: "Failed to clear log file" }, { status: 500 })
  }
}
