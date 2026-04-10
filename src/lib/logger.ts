// src/lib/logger.ts
//
// Exports: log

import { existsSync, mkdirSync } from "node:fs"
import { dirname } from "node:path"
import pino from "pino"
import pretty from "pino-pretty"
import { DEFAULT_LOG_FILE, DEV_LOG_FILE } from "@/lib/constants"

const g = globalThis as typeof globalThis & { __logger?: pino.Logger }

function createLogger(): pino.Logger {
  const stdoutLevel = process.env.LOG_LEVEL || "info"
  // Explicit LOG_FILE always wins. Otherwise use the Docker path if it exists,
  // or fall back to a local .next/ file so the events tab works in dev.
  const explicitLogFile = process.env.LOG_FILE
  const logFile =
    explicitLogFile ?? (existsSync(dirname(DEFAULT_LOG_FILE)) ? DEFAULT_LOG_FILE : DEV_LOG_FILE)

  const prettyStream = pretty({
    colorize: process.stdout.isTTY ?? false,
    translateTime: "SYS:yyyy-mm-dd HH:MM:ss",
    ignore: "pid,hostname",
  })

  // Stdout uses the user-configured level (defaults to "info").
  // File always captures debug+ so the events tab can show all levels.
  const streams: pino.StreamEntry[] = [{ level: stdoutLevel as pino.Level, stream: prettyStream }]

  if (logFile) {
    try {
      mkdirSync(dirname(logFile), { recursive: true })
      streams.push({
        level: "debug",
        stream: pino.destination({ dest: logFile, mkdir: false, sync: false }),
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      process.stderr.write(`[logger] Log file "${logFile}" unavailable: ${msg}\n`)
    }
  }

  // Root level must be the lowest of all streams so messages reach them
  return pino({ level: "debug" }, pino.multistream(streams))
}

export const log: pino.Logger = g.__logger ?? createLogger()

if (process.env.NODE_ENV !== "production") {
  g.__logger = log
}
