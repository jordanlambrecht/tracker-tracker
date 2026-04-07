// src/lib/logger.ts
//
// Exports: log

import { mkdirSync } from "node:fs"
import { dirname } from "node:path"
import pino from "pino"
import pretty from "pino-pretty"
import { DEFAULT_LOG_FILE } from "@/lib/constants"

const g = globalThis as typeof globalThis & { __logger?: pino.Logger }

function createLogger(): pino.Logger {
  const level = process.env.LOG_LEVEL || "info"
  const logFile = process.env.LOG_FILE ?? DEFAULT_LOG_FILE

  const prettyStream = pretty({
    colorize: process.stdout.isTTY ?? false,
    translateTime: "SYS:yyyy-mm-dd HH:MM:ss",
    ignore: "pid,hostname",
  })

  const streams: pino.StreamEntry[] = [{ level: "trace", stream: prettyStream }]

  if (logFile) {
    try {
      mkdirSync(dirname(logFile), { recursive: true })
      streams.push({
        level: "trace",
        stream: pino.destination({ dest: logFile, mkdir: false, sync: false }),
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      process.stderr.write(
        `[logger] Cannot write to log file "${logFile}": ${msg}. Falling back to stdout only.\n`
      )
    }
  }

  return pino({ level }, pino.multistream(streams))
}

export const log: pino.Logger = g.__logger ?? createLogger()

if (process.env.NODE_ENV !== "production") {
  g.__logger = log
}
