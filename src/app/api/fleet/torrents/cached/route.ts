// src/app/api/fleet/torrents/cached/route.ts
//
// Functions: GET
//
// Returns cached torrent data from the last deep poll across all clients.
// Reads from downloadClients.cachedTorrents (populated by client-scheduler).
// No live qBT HTTP requests — DB read only.

import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import { authenticate } from "@/lib/api-helpers"
import { db } from "@/lib/db"
import { downloadClients } from "@/lib/db/schema"
import {
  parseCachedTorrents,
  parseCrossSeedTags,
  type QbtTorrent,
  stripSensitiveTorrentFields,
} from "@/lib/qbt"
import { aggregateCrossSeedTags, mergeTorrentLists } from "@/lib/qbt/merge"

export async function GET() {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth

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

  const torrentLists: QbtTorrent[][] = []
  const crossSeedClients: { crossSeedTags: string[] }[] = []
  const hashClients = new Map<string, string[]>()
  let oldestCacheAt: Date | null = null

  for (const client of clients) {
    const torrents = parseCachedTorrents(client.cachedTorrents)
    if (torrents.length === 0) continue
    torrentLists.push(torrents)

    for (const t of torrents) {
      const names = hashClients.get(t.hash) ?? []
      names.push(client.name)
      hashClients.set(t.hash, names)
    }

    crossSeedClients.push({ crossSeedTags: parseCrossSeedTags(client.crossSeedTags) })

    if (client.cachedTorrentsAt) {
      if (!oldestCacheAt || client.cachedTorrentsAt < oldestCacheAt) {
        oldestCacheAt = client.cachedTorrentsAt
      }
    }
  }

  const merged = mergeTorrentLists(torrentLists)
  const crossSeedTags = aggregateCrossSeedTags(crossSeedClients)

  const stamped = merged.map((t) => ({
    ...stripSensitiveTorrentFields(t),
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
