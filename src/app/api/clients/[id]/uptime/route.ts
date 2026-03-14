// src/app/api/clients/[id]/uptime/route.ts
//
// Functions: GET

import { and, eq, gte } from "drizzle-orm"
import { NextResponse } from "next/server"
import { authenticate, parseRouteId } from "@/lib/api-helpers"
import { db } from "@/lib/db"
import { clientUptimeBuckets, downloadClients } from "@/lib/db/schema"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  const clientId = await parseRouteId(params, "client ID")
  if (clientId instanceof NextResponse) return clientId

  const [client] = await db
    .select({ id: downloadClients.id })
    .from(downloadClients)
    .where(eq(downloadClients.id, clientId))
    .limit(1)

  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 })
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000)

  const buckets = await db
    .select({
      bucketTs: clientUptimeBuckets.bucketTs,
      ok: clientUptimeBuckets.ok,
      fail: clientUptimeBuckets.fail,
    })
    .from(clientUptimeBuckets)
    .where(
      and(
        eq(clientUptimeBuckets.clientId, clientId),
        gte(clientUptimeBuckets.bucketTs, since)
      )
    )
    .orderBy(clientUptimeBuckets.bucketTs)

  const totalOk = buckets.reduce((sum, b) => sum + b.ok, 0)
  const totalFail = buckets.reduce((sum, b) => sum + b.fail, 0)
  const total = totalOk + totalFail
  const uptimePercent = total > 0 ? Math.round((totalOk / total) * 1000) / 10 : null

  return NextResponse.json({ buckets, uptimePercent })
}
