// src/app/api/trackers/[id]/torrents/cached/route.ts
//
// Functions: GET
//
// Returns cached torrent data from the last successful deep poll.
// Used as fallback when live qBittorrent connection fails.

import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import { authenticate, parseTrackerId } from "@/lib/api-helpers"
import { db } from "@/lib/db"
import { downloadClients, trackers } from "@/lib/db/schema"
import { parseCrossSeedTags, type QbtTorrent } from "@/lib/qbt"
import { aggregateCrossSeedTags, mergeTorrentLists } from "@/lib/qbt/merge"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  const trackerId = await parseTrackerId(params)
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
    return NextResponse.json({ error: "No qBittorrent tag configured" }, { status: 400 })
  }

  // Fetch all enabled clients that have cached data
  const clients = await db
    .select({
      id: downloadClients.id,
      name: downloadClients.name,
      cachedTorrents: downloadClients.cachedTorrents,
      cachedTorrentsAt: downloadClients.cachedTorrentsAt,
      crossSeedTags: downloadClients.crossSeedTags,
    })
    .from(downloadClients)
    .where(eq(downloadClients.enabled, true))

  if (clients.length === 0) {
    return NextResponse.json({
      torrents: [],
      crossSeedTags: [],
      clientErrors: [],
      clientCount: 0,
      cachedAt: null,
    })
  }

  const tag = tracker.qbtTag.trim().toLowerCase()
  const torrentLists: QbtTorrent[][] = []
  const crossSeedClients: { crossSeedTags: string[] }[] = []
  const hashClients = new Map<string, string[]>()
  let oldestCacheAt: Date | null = null

  // Parse each client's cached JSON once, then reuse for filtering + stamping.
  // Cached blobs can be 500 KB-5 MB, so we avoid double-parsing.
  const parsedCache = new Map<number, QbtTorrent[]>()
  for (const client of clients) {
    if (!client.cachedTorrents) continue
    try {
      parsedCache.set(client.id, JSON.parse(client.cachedTorrents) as QbtTorrent[])
    } catch { // security-audit-ignore: malformed cached JSON — skip this client
    }
  }

  for (const client of clients) {
    const torrents = parsedCache.get(client.id)
    if (!torrents) continue

    // Re-filter by this tracker's tag (cache is per-client, not per-tracker)
    const filtered = torrents.filter((t) =>
      t.tags
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .includes(tag)
    )

    torrentLists.push(filtered)

    // Build hash->client name(s) map for client_name stamping (matches live endpoint)
    for (const t of filtered) {
      const names = hashClients.get(t.hash) ?? []
      names.push(client.name)
      hashClients.set(t.hash, names)
    }

    crossSeedClients.push({ crossSeedTags: parseCrossSeedTags(client.crossSeedTags) })

    // Track the oldest cache timestamp for the stale indicator.
    // We use the oldest (most pessimistic) timestamp across clients so the
    // UI banner reflects the worst-case staleness.
    if (client.cachedTorrentsAt) {
      if (!oldestCacheAt || client.cachedTorrentsAt < oldestCacheAt) {
        oldestCacheAt = client.cachedTorrentsAt
      }
    }
  }

  const merged = mergeTorrentLists(torrentLists)
  const crossSeedTags = aggregateCrossSeedTags(crossSeedClients)

  const stamped = merged.map((t) => ({
    ...t,
    client_name: (hashClients.get(t.hash) ?? []).join(", "),
  }))

  return NextResponse.json({
    torrents: stamped,
    crossSeedTags,
    clientErrors: [],
    clientCount: clients.length,
    cachedAt: oldestCacheAt?.toISOString() ?? null,
  })
}
