// src/lib/log-reader.ts
//
// Functions: readLogTail

import { existsSync } from "node:fs"
import { open, stat } from "node:fs/promises"
import { dirname } from "node:path"
import { DEFAULT_LOG_FILE, DEV_LOG_FILE } from "@/lib/constants"

export async function readLogTail(
  maxBytes: number
): Promise<{ content: string; sizeBytes: number }> {
  const logFile =
    process.env.LOG_FILE ??
    (existsSync(dirname(DEFAULT_LOG_FILE)) ? DEFAULT_LOG_FILE : DEV_LOG_FILE)

  const info = await stat(logFile)
  const readSize = Math.min(maxBytes, info.size)
  const offset = info.size - readSize

  const fh = await open(logFile, "r")
  let tail: string
  try {
    const buf = Buffer.alloc(readSize)
    await fh.read(buf, 0, readSize, offset)
    tail = buf.toString("utf8")
  } finally {
    await fh.close()
  }

  const lines = tail.split("\n")
  if (offset > 0) lines.shift()
  const content = lines.join("\n").trim()

  return { content, sizeBytes: info.size }
}
