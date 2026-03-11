// src/app/api/trackers/[id]/torrents/route.ts
//
// Functions: GET
//
// Aggregated torrents endpoint — queries ALL enabled download clients
// for the tracker's qbtTag, merges results with deduplication by hash.

import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import { authenticate, decodeKey, parseTrackerId } from "@/lib/api-helpers"
import { decrypt } from "@/lib/crypto"
import { db } from "@/lib/db"
import { downloadClients, trackers } from "@/lib/db/schema"
import { getTorrents, withSessionRetry } from "@/lib/qbt"
import { aggregateCrossSeedTags, mergeTorrentLists, type RawTorrent } from "@/lib/qbt/merge"

async function fetchClientTorrents(
  client: typeof downloadClients.$inferSelect,
  tag: string,
  key: Buffer
): Promise<RawTorrent[]> {
  const username = decrypt(client.encryptedUsername, key)
  const password = decrypt(client.encryptedPassword, key)
  return withSessionRetry(
    client.host, client.port, client.useSsl, username, password,
    (baseUrl, sid) => getTorrents(baseUrl, sid, tag) as Promise<RawTorrent[]>
  )
}

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
    return NextResponse.json({ error: "No qBittorrent tag configured for this tracker" }, { status: 400 })
  }

  // Fetch all enabled clients
  const clients = await db
    .select()
    .from(downloadClients)
    .where(eq(downloadClients.enabled, true))

  if (clients.length === 0) {
    return NextResponse.json({
      torrents: [],
      crossSeedTags: [],
      clientErrors: [],
      clientCount: 0,
    })
  }

  const key = decodeKey(auth)
  const tag = tracker.qbtTag.trim()

  // Query all clients in parallel — partial failures don't block
  const results = await Promise.allSettled(
    clients.map(async (client) => {
      let parsedTags: string[] = []
      try {
        parsedTags = JSON.parse(client.crossSeedTags) as string[]
      } catch {
        // malformed JSON, treat as empty
      }
      return {
        clientName: client.name,
        crossSeedTags: parsedTags,
        torrents: await fetchClientTorrents(client, tag, key),
      }
    })
  )

  const torrentLists: RawTorrent[][] = []
  const crossSeedClients: { crossSeedTags: string[] }[] = []
  const clientErrors: string[] = []

  for (let i = 0; i < results.length; i++) {
    const result = results[i]
    if (result.status === "fulfilled") {
      torrentLists.push(result.value.torrents)
      crossSeedClients.push({ crossSeedTags: result.value.crossSeedTags })
    } else {
      const clientName = clients[i].name
      const message = result.reason instanceof Error ? result.reason.message : "Unknown error"
      clientErrors.push(`${clientName}: ${message}`)
    }
  }

  // Build hash → client name(s) lookup before merge flattens provenance
  const hashClients = new Map<string, string[]>()
  for (let i = 0; i < results.length; i++) {
    const result = results[i]
    if (result.status === "fulfilled") {
      for (const torrent of result.value.torrents) {
        const names = hashClients.get(torrent.hash) ?? []
        names.push(result.value.clientName)
        hashClients.set(torrent.hash, names)
      }
    }
  }

  const merged = mergeTorrentLists(torrentLists)
  const crossSeedTags = aggregateCrossSeedTags(crossSeedClients)

  // Stamp each merged torrent with source client name(s)
  const stamped = merged.map((t) => ({
    ...t,
    client_name: (hashClients.get(t.hash) ?? []).join(", "),
  }))

  return NextResponse.json({
    torrents: stamped,
    crossSeedTags,
    clientErrors,
    clientCount: clients.length,
  })
}
