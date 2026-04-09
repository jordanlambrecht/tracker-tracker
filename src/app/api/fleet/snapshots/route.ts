// src/app/api/fleet/snapshots/route.ts
//
// Functions: GET
//
// Returns historical client snapshots with parsed tagStats for all clients.
// Query param: ?days=N (default 7, max 365)

import { desc, gte, sql } from "drizzle-orm"
import { NextResponse } from "next/server"
import { authenticate } from "@/lib/api-helpers"
import { db } from "@/lib/db"
import { clientSnapshots, downloadClients } from "@/lib/db/schema"
import { errMsg } from "@/lib/error-utils"
import { FLEET_SNAPSHOT_QUERY_MAX } from "@/lib/limits"
import { log } from "@/lib/logger"
import { getSnapshotBucket } from "@/lib/server-data"

export async function GET(request: Request) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  const url = new URL(request.url)
  const daysParam = parseInt(url.searchParams.get("days") ?? "7", 10)
  const days = Math.min(
    Math.max(1, Number.isNaN(daysParam) ? 7 : daysParam),
    FLEET_SNAPSHOT_QUERY_MAX
  )

  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

  try {
    const bucket = getSnapshotBucket(days)

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
            .where(gte(clientSnapshots.polledAt, cutoff))
            .orderBy(clientSnapshots.clientId, bucketExpr, desc(clientSnapshots.polledAt))
        })()
      : db
          .select(clientSnapshotColumns)
          .from(clientSnapshots)
          .where(gte(clientSnapshots.polledAt, cutoff))

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
