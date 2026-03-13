// src/app/api/trackers/[id]/snapshots/route.ts
import { and, eq, gte } from "drizzle-orm"
import { NextResponse } from "next/server"
import { authenticate, parseTrackerId } from "@/lib/api-helpers"
import { db } from "@/lib/db"
import { trackerSnapshots } from "@/lib/db/schema"
import { createPrivacyMask } from "@/lib/privacy-db"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  const trackerId = await parseTrackerId(params)
  if (trackerId instanceof NextResponse) return trackerId

  const url = new URL(request.url)
  const daysParam = url.searchParams.get("days")
  const daysRaw = parseInt(daysParam || "30", 10) || 30
  const days = daysRaw === 0 ? 0 : Math.min(Math.max(daysRaw, 1), 3650)

  const conditions = [eq(trackerSnapshots.trackerId, trackerId)]
  if (days > 0) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    conditions.push(gte(trackerSnapshots.polledAt, since))
  }

  const snapshots = await db
    .select()
    .from(trackerSnapshots)
    .where(and(...conditions))
    .orderBy(trackerSnapshots.polledAt)

  // Check privacy setting — enforce masking at response time even if DB has
  // plaintext from before privacy mode was enabled.
  const mask = await createPrivacyMask()

  // Serialize bigints to strings for JSON.
  // Username/group are included because detectRankChanges needs them.
  // When privacy mode is on, values are masked before leaving the API.
  const serialized = snapshots.map((s) => ({
    ...s,
    uploadedBytes: s.uploadedBytes?.toString(),
    downloadedBytes: s.downloadedBytes?.toString(),
    bufferBytes: s.bufferBytes?.toString(),
    username: mask(s.username),
    group: mask(s.group),
  }))

  return NextResponse.json(serialized)
}
