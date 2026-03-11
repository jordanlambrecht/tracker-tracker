// src/app/api/clients/[id]/snapshots/route.ts
//
// Functions: GET

import { desc, eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import { authenticate, parseRouteId } from "@/lib/api-helpers"
import { db } from "@/lib/db"
import { clientSnapshots } from "@/lib/db/schema"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  const clientId = await parseRouteId(params, "client ID")
  if (clientId instanceof NextResponse) return clientId

  const snapshots = await db
    .select()
    .from(clientSnapshots)
    .where(eq(clientSnapshots.clientId, clientId))
    .orderBy(desc(clientSnapshots.polledAt))
    .limit(100)

  // Serialize bigints to strings for JSON transport
  const serialized = snapshots.map((s) => ({
    ...s,
    uploadSpeedBytes: s.uploadSpeedBytes?.toString() ?? null,
    downloadSpeedBytes: s.downloadSpeedBytes?.toString() ?? null,
    tagStats: (() => {
      if (!s.tagStats) return null
      try {
        return JSON.parse(s.tagStats) as unknown
      } catch {
        return null
      }
    })(),
  }))

  return NextResponse.json(serialized)
}
