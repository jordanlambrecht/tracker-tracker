// src/app/api/settings/events/route.ts
//
// Functions: GET

import { desc, eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import { authenticate } from "@/lib/api-helpers"
import { db } from "@/lib/db"
import { backupHistory, trackerSnapshots, trackers } from "@/lib/db/schema"
import {
  backupToEvent,
  EVENT_CATEGORIES,
  type EventCategory,
  groupPollBatches,
  mergeAndSort,
  parseLogLine,
  type SystemEvent,
  snapshotToEvent,
} from "@/lib/events"
import { EVENTS_LIMIT_CAP, EVENTS_LIMIT_DEFAULT } from "@/lib/limits"
import { readLogTail } from "@/lib/log-reader"
import { log } from "@/lib/logger"

const MAX_LOG_BYTES = 256 * 1024 // 256 KB

export async function GET(request: Request): Promise<NextResponse> {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(request.url)

  // Parse and validate limit
  const rawLimit = parseInt(searchParams.get("limit") ?? "", 10)
  const limit = Number.isNaN(rawLimit)
    ? EVENTS_LIMIT_DEFAULT
    : Math.min(Math.max(rawLimit, 1), EVENTS_LIMIT_CAP)

  // Parse and validate offset
  const rawOffset = parseInt(searchParams.get("offset") ?? "", 10)
  const offset = Number.isNaN(rawOffset) ? 0 : Math.max(rawOffset, 0)

  // Parse and validate category
  const rawCategory = searchParams.get("category") ?? "all"
  const category: EventCategory | "all" =
    rawCategory === "all" || (EVENT_CATEGORIES as readonly string[]).includes(rawCategory)
      ? (rawCategory as EventCategory | "all")
      : "all"

  try {
    // Parallel DB queries
    const [snapshotRows, backupRows] = await Promise.all([
      db
        .select({
          id: trackerSnapshots.id,
          polledAt: trackerSnapshots.polledAt,
          uploadedBytes: trackerSnapshots.uploadedBytes,
          downloadedBytes: trackerSnapshots.downloadedBytes,
          ratio: trackerSnapshots.ratio,
          trackerId: trackerSnapshots.trackerId,
          trackerName: trackers.name,
        })
        .from(trackerSnapshots)
        .innerJoin(trackers, eq(trackerSnapshots.trackerId, trackers.id))
        .orderBy(desc(trackerSnapshots.polledAt))
        .limit(500),
      db
        .select({
          id: backupHistory.id,
          createdAt: backupHistory.createdAt,
          sizeBytes: backupHistory.sizeBytes,
          encrypted: backupHistory.encrypted,
          status: backupHistory.status,
          frequency: backupHistory.frequency,
        })
        .from(backupHistory)
        .orderBy(desc(backupHistory.createdAt))
        .limit(100),
    ])

    // Convert DB rows to SystemEvent (dates to ISO strings, bigints to strings)
    const dbEvents = [
      ...snapshotRows.map((row) =>
        snapshotToEvent({
          id: row.id,
          polledAt: row.polledAt.toISOString(),
          uploadedBytes: row.uploadedBytes.toString(),
          downloadedBytes: row.downloadedBytes.toString(),
          ratio: row.ratio,
          trackerId: row.trackerId,
          trackerName: row.trackerName ?? null,
        })
      ),
      ...backupRows.map((row) =>
        backupToEvent({
          id: row.id,
          createdAt: row.createdAt.toISOString(),
          sizeBytes: row.sizeBytes,
          encrypted: row.encrypted,
          status: row.status,
          frequency: row.frequency ?? null,
        })
      ),
    ]

    // tail-read of log file
    let logEvents: SystemEvent[] = []
    let logSizeBytes = 0

    try {
      const { content: logContent, sizeBytes: logSize } = await readLogTail(MAX_LOG_BYTES)
      logSizeBytes = logSize
      logEvents = logContent
        .split("\n")
        .map(parseLogLine)
        .filter((e) => e !== null)
    } catch (err) {
      if (
        !(err instanceof Error && "code" in err && (err as NodeJS.ErrnoException).code === "ENOENT")
      ) {
        log.error({ route: "GET /api/settings/events" }, "failed to read log file for events")
      }
    }

    // Count total
    const total =
      category === "all"
        ? dbEvents.length + logEvents.length
        : dbEvents.reduce((count, e) => (e.category === category ? count + 1 : count), 0) +
          logEvents.reduce((count, e) => (e.category === category ? count + 1 : count), 0)

    // Sort, paginate, then collapse same-timestamp polls into batches
    const events = groupPollBatches(mergeAndSort(dbEvents, logEvents, category, limit, offset))

    return NextResponse.json({
      events,
      total,
      hasMore: offset + events.length < total,
      logSizeBytes,
    })
  } catch (err) {
    log.error({ route: "GET /api/settings/events", err }, "failed to fetch events")
    return NextResponse.json({ error: "Failed to fetch events" }, { status: 500 })
  }
}
