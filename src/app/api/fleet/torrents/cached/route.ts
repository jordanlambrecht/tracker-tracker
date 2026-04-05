// src/app/api/fleet/torrents/cached/route.ts
//
// Functions: GET
//
// Returns cached torrent data from the last deep poll across all clients.
// Fast path: reads from in-memory sync store (populated by client-scheduler).
// Fallback: reads from downloadClients.cachedTorrents JSONB (cold start only).
// No live qBT HTTP requests.

import { eq, isNotNull } from "drizzle-orm"
import { NextResponse } from "next/server"
import { authenticate } from "@/lib/api-helpers"
import { db } from "@/lib/db"
import { downloadClients, trackers } from "@/lib/db/schema"
import { parseTorrentTags } from "@/lib/fleet"
import { computeFleetAggregation } from "@/lib/fleet-aggregation"
import { log } from "@/lib/logger"
import {
  buildBaseUrl,
  getFilteredTorrents,
  isStoreFresh,
  parseCachedTorrents,
  parseCrossSeedTags,
  type QbtTorrent,
  type SlimTorrent,
  STORE_MAX_AGE_MS,
  slimTorrentForCache,
} from "@/lib/qbt"
import { aggregateCrossSeedTags, mergeTorrentLists } from "@/lib/qbt/merge"

export async function GET() {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

  try {
    // Light query. No cachedTorrents blob
    const clients = await db
      .select({
        id: downloadClients.id,
        name: downloadClients.name,
        host: downloadClients.host,
        port: downloadClients.port,
        useSsl: downloadClients.useSsl,
        crossSeedTags: downloadClients.crossSeedTags,
        cachedTorrentsAt: downloadClients.cachedTorrentsAt,
      })
      .from(downloadClients)
      .where(eq(downloadClients.enabled, true))

    if (clients.length === 0) {
      return NextResponse.json({
        ...computeFleetAggregation([], [], []),
        clientErrors: [],
        clientCount: 0,
        cachedAt: null,
      })
    }

    const trackerTagRows = await db
      .select({
        qbtTag: trackers.qbtTag,
        name: trackers.name,
        color: trackers.color,
      })
      .from(trackers)
      .where(isNotNull(trackers.qbtTag))
    const trackerTagStrings = trackerTagRows.map((r) => r.qbtTag as string)
    const trackerTagsWithMeta = trackerTagRows.map((r) => ({
      tag: r.qbtTag as string,
      name: r.name,
      color: r.color ?? "#01d4ff",
    }))

    const crossSeedTags = aggregateCrossSeedTags(
      clients.map((c) => ({ crossSeedTags: parseCrossSeedTags(c.crossSeedTags) }))
    )
    const allTags = [...new Set([...trackerTagStrings, ...crossSeedTags])]
    const tagSet = new Set(allTags.map((t) => t.toLowerCase()))
    const tagPredicate = (t: QbtTorrent) => {
      if (!t.tags) return false
      return parseTorrentTags(t.tags).some((tag) => tagSet.has(tag))
    }

    const torrentLists: (QbtTorrent | SlimTorrent)[][] = []
    const hashClients = new Map<string, string[]>()
    let oldestCacheAt: Date | null = null

    for (const client of clients) {
      const baseUrl = buildBaseUrl(client.host, client.port, client.useSsl)
      let torrents: QbtTorrent[] | SlimTorrent[]

      if (isStoreFresh(baseUrl, STORE_MAX_AGE_MS)) {
        // Fast path: read from in-memory sync store, slim to 23 fields
        torrents = getFilteredTorrents(baseUrl, tagPredicate).map(slimTorrentForCache)
      } else {
        // Cold start fallback: read from Postgres JSONB
        const [row] = await db
          .select({ cachedTorrents: downloadClients.cachedTorrents })
          .from(downloadClients)
          .where(eq(downloadClients.id, client.id))
          .limit(1)
        torrents = row ? parseCachedTorrents(row.cachedTorrents) : []
      }

      if (torrents.length === 0) continue
      torrentLists.push(torrents)

      for (const t of torrents) {
        const names = hashClients.get(t.hash) ?? []
        names.push(client.name)
        hashClients.set(t.hash, names)
      }

      if (client.cachedTorrentsAt) {
        if (!oldestCacheAt || client.cachedTorrentsAt < oldestCacheAt) {
          oldestCacheAt = client.cachedTorrentsAt
        }
      }
    }

    const merged = mergeTorrentLists(torrentLists)

    const stamped = merged.map((t) => ({
      ...t,
      client_name: (hashClients.get(t.hash) ?? []).join(", "),
    }))

    const aggregation = computeFleetAggregation(stamped, trackerTagsWithMeta, crossSeedTags)

    return NextResponse.json({
      ...aggregation,
      clientErrors: [],
      clientCount: clients.length,
      cachedAt: oldestCacheAt?.toISOString() ?? null,
    })
  } catch (error) {
    log.error(
      error instanceof Error ? error : { err: String(error) },
      "GET /api/fleet/torrents/cached failed"
    )
    return NextResponse.json({ error: "Failed to load fleet data" }, { status: 500 })
  }
}
