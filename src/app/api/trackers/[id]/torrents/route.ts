// src/app/api/trackers/[id]/torrents/route.ts
//
// Functions: GET
//
// Aggregated torrents endpoint — queries ALL enabled download clients
// for the tracker's qbtTag, merges results with deduplication by hash.

import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import { authenticate, decodeKey, parseTrackerId } from "@/lib/api-helpers"
import { db } from "@/lib/db"
import { downloadClients, trackers } from "@/lib/db/schema"
import { log } from "@/lib/logger"
import { fetchAndMergeTorrents } from "@/lib/qbt/fetch-merged"

export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  const trackerId = await parseTrackerId(props.params)
  if (trackerId instanceof NextResponse) return trackerId

  // Look up tracker to get qbtTag
  const [tracker] = await db
    .select({ qbtTag: trackers.qbtTag })
    .from(trackers)
    .where(eq(trackers.id, trackerId))
    .limit(1)

  if (!tracker) {
    return NextResponse.json({ error: "Tracker not found" }, { status: 404 })
  }

  if (!tracker.qbtTag) {
    return NextResponse.json(
      { error: "No qBittorrent tag configured for this tracker" },
      { status: 400 }
    )
  }

  // Fetch only the columns needed — avoids loading cachedTorrents blob
  // and keeps encrypted credentials scoped to this handler's memory.
  const clients = await db
    .select({
      name: downloadClients.name,
      host: downloadClients.host,
      port: downloadClients.port,
      useSsl: downloadClients.useSsl,
      encryptedUsername: downloadClients.encryptedUsername,
      encryptedPassword: downloadClients.encryptedPassword,
      crossSeedTags: downloadClients.crossSeedTags,
    })
    .from(downloadClients)
    .where(eq(downloadClients.enabled, true))

  const key = decodeKey(auth)
  const tag = tracker.qbtTag.trim()
  const url = new URL(request.url)
  const activeOnly = url.searchParams.get("active") === "true"
  const qbtFilter = activeOnly ? "active" : undefined

  try {
    const result = await fetchAndMergeTorrents(clients, [tag], key, qbtFilter)
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown"
    log.error({ route: "GET /api/trackers/[id]/torrents", trackerId, error: message }, "torrent fetch failed")
    return NextResponse.json({ error: "Failed to fetch torrents" }, { status: 502 })
  }
}
