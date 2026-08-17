// src/app/api/fleet/snapshots/route.ts
//
// Functions: GET
//
// Returns historical client snapshots with parsed tagStats for all clients.
// Query param: ?days=N (default 7, max 365). ?days=0 means ALL history — no time
// filter at all — matching the "All" option in the dashboard day-range sidebar.

import { asc, desc, gte, type SQL, sql } from "drizzle-orm"
import { NextResponse } from "next/server"
import { authenticate } from "@/lib/api-helpers"
import { db } from "@/lib/db"
import { clientSnapshots, downloadClients } from "@/lib/db/schema"
import { errMsg } from "@/lib/error-utils"
import { FLEET_SNAPSHOT_QUERY_MAX } from "@/lib/limits"
import { log } from "@/lib/logger"
import { getSnapshotBucket } from "@/lib/server-data"
import { parseIntClamped } from "@/lib/validators"

const MS_PER_DAY = 24 * 60 * 60 * 1000

interface QueryPlan {
  bucket: "hour" | "day" | null
  /** undefined = no time filter (the "All" case). Never build a cutoff for days=0: */
  /** `new Date(Date.now() - 0)` is *now*, and gte(polledAt, now) matches nothing. */
  sinceCondition: SQL | undefined
}

/**
 * Resolves the time filter and date_trunc bucket for a request.
 *
 * days > 0   rolling window; bucket sized to the requested range.
 * days === 0 "All": no time filter, and the bucket is sized to the ACTUAL span of
 *            stored snapshots. getSnapshotBucket(0) hardcodes "day", which would
 *            collapse a database holding only a few hours of history into a single
 *            point per client — making "All" coarser than any bounded range and
 *            firing every "need at least 2 days of data" empty state.
 *
 * Returns null when no snapshots exist at all.
 */
async function resolveQueryPlan(days: number): Promise<QueryPlan | null> {
  if (days > 0) {
    return {
      bucket: getSnapshotBucket(days),
      sinceCondition: gte(clientSnapshots.polledAt, new Date(Date.now() - days * MS_PER_DAY)),
    }
  }

  const [oldest] = await db
    .select({ polledAt: clientSnapshots.polledAt })
    .from(clientSnapshots)
    .orderBy(asc(clientSnapshots.polledAt))
    .limit(1)

  if (!oldest) return null

  const spanDays = Math.max(1, Math.ceil((Date.now() - oldest.polledAt.getTime()) / MS_PER_DAY))
  return { bucket: getSnapshotBucket(spanDays), sinceCondition: undefined }
}

export async function GET(request: Request) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  const url = new URL(request.url)
  // min of 0 keeps the "All" sentinel intact. A MISSING param still falls back to
  // the 7-day default, so 0 has to be sent explicitly by the client to mean "all".
  const days = parseIntClamped(url.searchParams.get("days"), 0, FLEET_SNAPSHOT_QUERY_MAX, 7)

  try {
    const plan = await resolveQueryPlan(days)
    if (!plan) return NextResponse.json([])
    const { bucket, sinceCondition } = plan

    const clientSnapshotColumns = {
      clientId: clientSnapshots.clientId,
      polledAt: clientSnapshots.polledAt,
      totalSeedingCount: clientSnapshots.totalSeedingCount,
      totalLeechingCount: clientSnapshots.totalLeechingCount,
      uploadSpeedBytes: clientSnapshots.uploadSpeedBytes,
      downloadSpeedBytes: clientSnapshots.downloadSpeedBytes,
      tagStats: clientSnapshots.tagStats,
    }

    const snapshotQuery = bucket
      ? (() => {
          const bucketExpr = sql`date_trunc(${sql.raw(`'${bucket}'`)}, ${clientSnapshots.polledAt})`
          return db
            .selectDistinctOn([clientSnapshots.clientId, bucketExpr], clientSnapshotColumns)
            .from(clientSnapshots)
            .where(sinceCondition)
            .orderBy(clientSnapshots.clientId, bucketExpr, desc(clientSnapshots.polledAt))
        })()
      : db.select(clientSnapshotColumns).from(clientSnapshots).where(sinceCondition)

    const [clients, snapshots] = await Promise.all([
      db.select({ id: downloadClients.id, name: downloadClients.name }).from(downloadClients),
      snapshotQuery,
    ])

    const clientNameMap = new Map(clients.map((c) => [c.id, c.name]))

    const serialized = snapshots.map((s) => ({
      clientId: s.clientId,
      clientName: clientNameMap.get(s.clientId) ?? `Client ${s.clientId}`,
      polledAt: s.polledAt.toISOString(),
      totalSeedingCount: s.totalSeedingCount,
      totalLeechingCount: s.totalLeechingCount,
      uploadSpeedBytes: s.uploadSpeedBytes?.toString() ?? null,
      downloadSpeedBytes: s.downloadSpeedBytes?.toString() ?? null,
      tagStats: s.tagStats
        ? (() => {
            try {
              return JSON.parse(s.tagStats) as unknown
            } catch {
              log.warn(
                { clientId: s.clientId, polledAt: s.polledAt.toISOString() },
                "Corrupt tagStats JSON in client snapshot"
              )
              return null
            }
          })()
        : null,
    }))

    return NextResponse.json(serialized)
  } catch (err) {
    log.error(
      { route: "GET /api/fleet/snapshots", error: errMsg(err) },
      "Failed to fetch fleet snapshots"
    )
    return NextResponse.json({ error: "Failed to load fleet snapshots" }, { status: 500 })
  }
}
