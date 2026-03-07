// src/app/api/trackers/[id]/snapshots/route.ts
import { and, eq, gte } from "drizzle-orm"
import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { db } from "@/lib/db"
import { trackerSnapshots } from "@/lib/db/schema"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth()
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const trackerId = parseInt(id, 10)
  if (Number.isNaN(trackerId)) {
    return NextResponse.json({ error: "Invalid tracker ID" }, { status: 400 })
  }

  const url = new URL(request.url)
  const daysParam = url.searchParams.get("days")
  const days = Math.min(Math.max(parseInt(daysParam || "30", 10) || 30, 1), 365)
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

  const snapshots = await db
    .select()
    .from(trackerSnapshots)
    .where(
      and(
        eq(trackerSnapshots.trackerId, trackerId),
        gte(trackerSnapshots.polledAt, since)
      )
    )
    .orderBy(trackerSnapshots.polledAt)

  // Serialize bigints to strings for JSON
  const serialized = snapshots.map((s) => ({
    ...s,
    uploadedBytes: s.uploadedBytes?.toString(),
    downloadedBytes: s.downloadedBytes?.toString(),
    bufferBytes: s.bufferBytes?.toString(),
  }))

  return NextResponse.json(serialized)
}
