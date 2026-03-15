// src/app/api/fleet/torrents/route.ts
//
// Functions: GET
//
// Returns merged torrent list across all download clients and all tracker tags.
// Uses Promise.allSettled for resilience — one failed client doesn't block others.

import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import { authenticate, decodeKey } from "@/lib/api-helpers"
import { decrypt } from "@/lib/crypto"
import { db } from "@/lib/db"
import { downloadClients, trackers } from "@/lib/db/schema"
import { getTorrents, parseCrossSeedTags, type QbtTorrent, stripSensitiveTorrentFields, withSessionRetry } from "@/lib/qbt"
import { aggregateCrossSeedTags, mergeTorrentLists } from "@/lib/qbt/merge"

async function fetchClientTorrents(
  client: typeof downloadClients.$inferSelect,
  tags: string[],
  key: Buffer
): Promise<QbtTorrent[]> {
  const username = decrypt(client.encryptedUsername, key)
  const password = decrypt(client.encryptedPassword, key)
  return withSessionRetry(
    client.host, client.port, client.useSsl, username, password,
    async (baseUrl, sid) => {
      const results = await Promise.allSettled(
        tags.map((tag) => getTorrents(baseUrl, sid, tag))
      )
      const allTorrents: QbtTorrent[] = []
      for (const result of results) {
        if (result.status === "fulfilled") allTorrents.push(...result.value)
      }
      return allTorrents
    }
  )
}

export async function GET() {
  const auth = await authenticate()
  if (auth instanceof NextResponse) return auth
  const key = decodeKey(auth)

  const [allTrackers, clients] = await Promise.all([
    db.select({ qbtTag: trackers.qbtTag }).from(trackers).where(eq(trackers.isActive, true)),
    db.select().from(downloadClients).where(eq(downloadClients.enabled, true)),
  ])

  const tags = [...new Set(
    allTrackers
      .map((t) => t.qbtTag)
      .filter((t): t is string => t !== null && t.trim() !== "")
      .map((t) => t.trim())
  )]

  if (clients.length === 0 || tags.length === 0) {
    return NextResponse.json({ torrents: [], crossSeedTags: [], clientErrors: [], clientCount: 0 })
  }

  const clientErrors: string[] = []
  const torrentLists: QbtTorrent[][] = []
  const crossSeedClients: { crossSeedTags: string[] }[] = []

  const results = await Promise.allSettled(
    clients.map(async (client) => ({
      clientName: client.name,
      crossSeedTags: parseCrossSeedTags(client.crossSeedTags),
      torrents: await fetchClientTorrents(client, tags, key),
    }))
  )

  for (let i = 0; i < results.length; i++) {
    const result = results[i]
    if (result.status === "fulfilled") {
      torrentLists.push(result.value.torrents)
      crossSeedClients.push({ crossSeedTags: result.value.crossSeedTags })
    } else {
      const message = result.reason instanceof Error ? result.reason.message : "Unknown error"
      clientErrors.push(`${clients[i].name}: ${message}`)
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
