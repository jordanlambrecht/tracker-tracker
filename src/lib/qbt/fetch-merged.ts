// src/lib/qbt/fetch-merged.ts
//
// Functions: fetchAndMergeTorrents

import "server-only"

import { decryptClientCredentials } from "@/lib/client-decrypt"
import { sanitizeNetworkError } from "@/lib/error-utils"
import {
  getTorrents,
  parseCrossSeedTags,
  type QbtTorrent,
  stripSensitiveTorrentFields,
  withSessionRetry,
} from "@/lib/qbt"
import { aggregateCrossSeedTags, mergeTorrentLists } from "@/lib/qbt/merge"

export interface ClientRow {
  name: string
  host: string
  port: number
  useSsl: boolean
  encryptedUsername: string
  encryptedPassword: string
  crossSeedTags: string[] | null
}

export interface MergedResult {
  torrents: (Omit<QbtTorrent, "tracker" | "content_path" | "save_path"> & {
    client_name: string
  })[]
  crossSeedTags: string[]
  clientErrors: string[]
  clientCount: number
}

async function fetchClientTorrents(
  client: ClientRow,
  tags: string[],
  key: Buffer,
  filter?: string
): Promise<QbtTorrent[]> {
  const { username, password } = decryptClientCredentials(client, key)
  return withSessionRetry(
    client.host,
    client.port,
    client.useSsl,
    username,
    password,
    async (baseUrl, sid) => {
      if (tags.length === 1) {
        return getTorrents(baseUrl, sid, tags[0], filter)
      }
      // Multiple tags: fetch all in parallel, ignore per-tag failures
      const results = await Promise.allSettled(tags.map((tag) => getTorrents(baseUrl, sid, tag)))
      const allTorrents: QbtTorrent[] = []
      for (const result of results) {
        if (result.status === "fulfilled") allTorrents.push(...result.value)
      }
      return allTorrents
    }
  )
}

/**
 * Fetch torrents from all provided clients for the given tags, merge and
 * deduplicate by hash, aggregate cross-seed tags, strip sensitive fields,
 * and stamp each merged torrent with the originating client name(s).
 *
 * @param clients  Enabled download client rows (credentials encrypted).
 * @param tags     qBT tag(s) to fetch. Single-tag callers may also pass filter.
 * @param key      AES-256-GCM decryption key derived from the master password.
 * @param filter   Optional qBT filter string (e.g. "active"). Only applied when
 *                 tags has exactly one entry.
 */
export async function fetchAndMergeTorrents(
  clients: ClientRow[],
  tags: string[],
  key: Buffer,
  filter?: string
): Promise<MergedResult> {
  const empty: MergedResult = {
    torrents: [],
    crossSeedTags: [],
    clientErrors: [],
    clientCount: 0,
  }

  if (clients.length === 0 || tags.length === 0) {
    return empty
  }

  const results = await Promise.allSettled(
    clients.map(async (client) => ({
      clientName: client.name,
      crossSeedTags: parseCrossSeedTags(client.crossSeedTags),
      torrents: await fetchClientTorrents(client, tags, key, filter),
    }))
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
      const raw = result.reason instanceof Error ? result.reason.message : "Unknown error"
      const message = /decrypt|crypt|EVP_/i.test(raw)
        ? "Credential decryption failed"
        : sanitizeNetworkError(raw)
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
  const torrents = merged.map((t) => ({
    ...stripSensitiveTorrentFields(t),
    client_name: (hashClients.get(t.hash) ?? []).join(", "),
  }))

  return {
    torrents,
    crossSeedTags,
    clientErrors,
    clientCount: clients.length,
  }
}
