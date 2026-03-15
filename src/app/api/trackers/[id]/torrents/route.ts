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
import { getTorrents, parseCrossSeedTags, type QbtTorrent, stripSensitiveTorrentFields, withSessionRetry } from "@/lib/qbt"
import { aggregateCrossSeedTags, mergeTorrentLists } from "@/lib/qbt/merge"

interface ClientRow {
  name: string
  host: string
  port: number
  useSsl: boolean
  encryptedUsername: string
  encryptedPassword: string
  crossSeedTags: string
}

async function fetchClientTorrents(
  client: ClientRow,
  tag: string,
  key: Buffer,
  filter?: string
): Promise<QbtTorrent[]> {
  const username = decrypt(client.encryptedUsername, key)
  const password = decrypt(client.encryptedPassword, key)
  return withSessionRetry(
    client.host, client.port, client.useSsl, username, password,
    (baseUrl, sid) => getTorrents(baseUrl, sid, tag, filter)
  )
}

export async function GET(
  request: Request,
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
  const url = new URL(request.url)
  const activeOnly = url.searchParams.get("active") === "true"
  const qbtFilter = activeOnly ? "active" : undefined

  // Query all clients in parallel — partial failures don't block
  const results = await Promise.allSettled(
    clients.map(async (client) => {
      return {
        clientName: client.name,
        crossSeedTags: parseCrossSeedTags(client.crossSeedTags),
        torrents: await fetchClientTorrents(client, tag, key, qbtFilter),
      }
    })
  )

  const torrentLists: QbtTorrent[][] = []
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

  // Strip sensitive fields, then stamp client name(s).
  const stamped = merged.map((t) => ({
    ...stripSensitiveTorrentFields(t),
    client_name: (hashClients.get(t.hash) ?? []).join(", "),
  }))

  return NextResponse.json({
    torrents: stamped,
    crossSeedTags,
    clientErrors,
    clientCount: clients.length,
  })
}
