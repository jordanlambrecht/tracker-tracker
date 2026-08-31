// src/app/api/uptime/outages/route.ts
//
// GET /api/uptime/outages?from=<epoch ms>&to=<epoch ms>[&trackerId=<id>]
//
// Returns the outage bands to shade behind a time-series chart for that window.
// All interval math lives in @/lib/outages (pure, no DB). This route gathers
// evidence and decides the coverage policy: how far back and forward records are
// allowed to speak.

import { and, asc, eq, gte, inArray, lte } from "drizzle-orm"
import { NextResponse } from "next/server"
import { authenticate } from "@/lib/api-helpers"
import { getAppCoverage, getCoverageGaps } from "@/lib/app-liveness"
import { db } from "@/lib/db"
import { clientUptimeBuckets, downloadClients } from "@/lib/db/schema"
import { errMsg } from "@/lib/error-utils"
import { log } from "@/lib/logger"
import {
  BUCKET_MS,
  type ClientBuckets,
  computeOutageBands,
  floorToBucketMs,
  type Interval,
} from "@/lib/outages"
import { getTrackerOutages } from "@/lib/tracker-outages"

/** Widest window a single request may ask for: five years. */
const MAX_WINDOW_MS = 5 * 365 * 24 * 60 * 60 * 1000

function parseEpochMs(raw: string | null): number | null {
  if (raw === null || raw.trim() === "") return null
  const value = Number(raw)
  if (!Number.isFinite(value) || !Number.isInteger(value)) return null
  return value
}

export async function GET(request: Request) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  const params = new URL(request.url).searchParams
  const from = parseEpochMs(params.get("from"))
  const to = parseEpochMs(params.get("to"))
  const trackerIdRaw = params.get("trackerId")

  if (from === null || to === null) {
    return NextResponse.json(
      { error: "from and to are required and must be integer epoch milliseconds" },
      { status: 400 }
    )
  }
  if (to <= from) {
    return NextResponse.json({ error: "to must be greater than from" }, { status: 400 })
  }
  if (to - from > MAX_WINDOW_MS) {
    return NextResponse.json({ error: "Requested window is too large" }, { status: 400 })
  }

  // Absent is the normal case and means "no tracker scoping". Present but
  // malformed is a client bug, and answering it with unscoped bands would hide
  // that bug behind a chart that silently shows nothing.
  let trackerId: number | null = null
  if (trackerIdRaw !== null) {
    const parsed = Number(trackerIdRaw)
    if (!Number.isInteger(parsed) || parsed < 1) {
      return NextResponse.json({ error: "trackerId must be a positive integer" }, { status: 400 })
    }
    trackerId = parsed
  }

  const window: Interval = { start: from, end: to }

  try {
    // Only ENABLED clients count. A disabled client stops producing buckets, and
    // a permanent absence of evidence is not an outage.
    const enabled = await db
      .select({ id: downloadClients.id })
      .from(downloadClients)
      .where(eq(downloadClients.enabled, true))
    const enabledIds = enabled.map((c) => c.id)

    // A band can start before the window does, so reach one bucket further back:
    // without the slop a straddling outage would appear to begin exactly at the
    // left edge and be measured too short to draw.
    const bucketFloor = new Date(from - BUCKET_MS)
    const bucketCeiling = new Date(to)

    const [gaps, appCoverage, buckets, earliestBucket, trackerRows] = await Promise.all([
      getCoverageGaps(from - BUCKET_MS, to),
      getAppCoverage(),
      enabledIds.length === 0
        ? Promise.resolve([])
        : db
            .select({
              clientId: clientUptimeBuckets.clientId,
              bucketTs: clientUptimeBuckets.bucketTs,
              ok: clientUptimeBuckets.ok,
              fail: clientUptimeBuckets.fail,
            })
            .from(clientUptimeBuckets)
            .where(
              and(
                inArray(clientUptimeBuckets.clientId, enabledIds),
                gte(clientUptimeBuckets.bucketTs, bucketFloor),
                lte(clientUptimeBuckets.bucketTs, bucketCeiling)
              )
            )
            .orderBy(asc(clientUptimeBuckets.bucketTs)),
      db
        .select({ bucketTs: clientUptimeBuckets.bucketTs })
        .from(clientUptimeBuckets)
        .orderBy(asc(clientUptimeBuckets.bucketTs))
        .limit(1),
      // Same one-bucket reach-back as the app gaps, for the same reason. An
      // unknown id simply returns nothing, so no existence check is needed.
      trackerId === null ? Promise.resolve([]) : getTrackerOutages(trackerId, from - BUCKET_MS, to),
    ])

    // Every enabled client gets an entry even with zero buckets, so it forces the
    // fleet-wide intersection empty instead of being silently skipped.
    const byClient = new Map<number, ClientBuckets>(
      enabledIds.map((id) => [id, { clientId: id, buckets: [] }])
    )
    for (const b of buckets) {
      byClient.get(b.clientId)?.buckets.push({
        bucketTs: b.bucketTs.getTime(),
        ok: b.ok,
        fail: b.fail,
      })
    }

    // Upper bound is the end of the last flushed bucket. The in-flight bucket is
    // still accumulating in memory, so treating it as observed would band the
    // open present.
    const lastFlushedEnd = floorToBucketMs(Date.now())
    const earliestBucketMs = earliestBucket[0]?.bucketTs.getTime() ?? null

    // qBT bands are clamped to firstSeenAt as well as to the buckets themselves.
    const qbtCoverage: Interval | null =
      earliestBucketMs === null || enabledIds.length === 0
        ? null
        : {
            start: Math.max(earliestBucketMs, appCoverage?.start ?? earliestBucketMs),
            end: lastFlushedEnd,
          }

    const bands = computeOutageBands({
      window,
      appGaps: gaps.map((g) => ({ start: g.start, end: g.end })),
      clients: [...byClient.values()],
      trackerOutages: trackerRows.map((o) => ({ start: o.start, end: o.end })),
      appCoverage,
      qbtCoverage,
    })

    return NextResponse.json({
      window,
      app: bands.app,
      allDown: bands.allDown,
      tracker: bands.tracker,
      perClient: bands.perClient,
      coverage: bands.coverage,
    })
  } catch (err) {
    log.error({ error: errMsg(err) }, "Failed to compute outage bands")
    return NextResponse.json({ error: "Failed to compute outage bands" }, { status: 500 })
  }
}
