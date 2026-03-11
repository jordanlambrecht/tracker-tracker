// src/lib/logger.ts
//
// Exports: log

import pino from "pino"
import pretty from "pino-pretty"

const g = globalThis as typeof globalThis & { __logger?: pino.Logger }

function createLogger(): pino.Logger {
  const level = process.env.LOG_LEVEL || "info"
  const logFile = process.env.LOG_FILE

  const prettyStream = pretty({
    colorize: process.stdout.isTTY ?? false,
    translateTime: "SYS:yyyy-mm-dd HH:MM:ss",
    ignore: "pid,hostname",
  })

  const streams: pino.StreamEntry[] = [{ level: "trace", stream: prettyStream }]

  if (logFile) {
    streams.push({
      level: "trace",
      stream: pino.destination({ dest: logFile, mkdir: true, sync: false }),
    })
  }

  return pino({ level }, pino.multistream(streams))
}

export const log: pino.Logger = g.__logger ?? createLogger()

if (process.env.NODE_ENV !== "production") {
  g.__logger = log
}
