// src/app/api/settings/logs/route.ts

import { open, stat } from "node:fs/promises"
import { NextResponse } from "next/server"
import { authenticate } from "@/lib/api-helpers"
import { log } from "@/lib/logger"

const MAX_BYTES = 64 * 1024 // Read last 64 KB

export async function GET(): Promise<NextResponse> {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  const logFile = process.env.LOG_FILE
  if (!logFile) {
    return NextResponse.json(
      { error: "File logging is not configured (LOG_FILE env not set)" },
      { status: 404 }
    )
  }

  try {
    const info = await stat(logFile)
    const readSize = Math.min(MAX_BYTES, info.size)
    const offset = info.size - readSize

    // Read only the tail bytes — never loads the full file into memory
    const fh = await open(logFile, "r")
    let tail: string
    try {
      const buf = Buffer.alloc(readSize)
      await fh.read(buf, 0, readSize, offset)
      tail = buf.toString("utf8")
    } finally {
      await fh.close()
    }

    // If we sliced mid-line, drop the partial first line
    const lines = tail.split("\n")
    if (offset > 0) lines.shift()
    const content = lines.join("\n").trim()

    return NextResponse.json({ content, sizeBytes: info.size })
  } catch (err) {
    if (err instanceof Error && "code" in err && (err as NodeJS.ErrnoException).code === "ENOENT") {
      return NextResponse.json({ content: "", sizeBytes: 0 })
    }
    log.error({ route: "GET /api/settings/logs" }, "failed to read log file")
    return NextResponse.json({ error: "Failed to read log file" }, { status: 500 })
  }
}
