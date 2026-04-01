// src/lib/qbt/fetch-merged.ts
import "server-only"

import { decryptClientCredentials } from "@/lib/client-decrypt"
import { isDecryptionError, sanitizeNetworkError } from "@/lib/error-utils"
import { parseTorrentTags } from "@/lib/fleet"
import {
  buildBaseUrl,
  getFilteredTorrents,
  getTorrents,
  isStoreFresh,
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
  /** True when every client failure was a decryption error, indicating a stale session key. */
  sessionExpired: boolean
}

async function fetchClientTorrents(
  client: ClientRow,
  tags: string[],
  key: Buffer,
  filter?: string
): Promise<QbtTorrent[]> {
  const baseUrl = buildBaseUrl(client.host, client.port, client.useSsl)

  // Fast path: store is warm from scheduler, serve from memory.
  // Falls back to live fetch if store is stale (i.e. scheduler missed 2+ cycles).
  // Skip when filter is requested. Active speeds need live qBT data.
  const STORE_MAX_AGE_MS = 10 * 60 * 1000 // 2× default poll interval
  if (!filter && isStoreFresh(baseUrl, STORE_MAX_AGE_MS)) {
    const tagSet = new Set(tags.map((t) => t.toLowerCase()))
    return getFilteredTorrents(baseUrl, (t) => {
      if (!t.tags) return false
      return parseTorrentTags(t.tags).some((tag) => tagSet.has(tag))
    })
  }

  // Cold path: store not yet populated, stale, or filter requested (i.e. active).
  // Fall back to live per-tag fetch.
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
 * @param filter   Optional qBT filter string (i.e. "active"). Only applied when
 *                 tags has exactly one entry.
 */
/** Per-client deadline for live fetches (seconds). Keeps the UI responsive
 *  when one client is offline — the online client's data arrives immediately
 *  while the offline one is cut short after this deadline instead of waiting
 *  for the full 30s retry cycle (15s timeout x 2 attempts). */
const CLIENT_DEADLINE_MS = 5_000

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
    sessionExpired: false,
  }

  if (clients.length === 0 || tags.length === 0) {
    return empty
  }

  const results = await Promise.allSettled(
    clients.map(async (client) => {
      const deadline = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Client deadline exceeded")), CLIENT_DEADLINE_MS)
      )
      const work = (async () => ({
        clientName: client.name,
        crossSeedTags: parseCrossSeedTags(client.crossSeedTags),
        torrents: await fetchClientTorrents(client, tags, key, filter),
      }))()
      return Promise.race([work, deadline])
    })
  )

  const torrentLists: QbtTorrent[][] = []
  const crossSeedClients: { crossSeedTags: string[] }[] = []
  const clientErrors: string[] = []
  let decryptionFailureCount = 0

  for (let i = 0; i < results.length; i++) {
    const result = results[i]
    if (result.status === "fulfilled") {
      torrentLists.push(result.value.torrents)
      crossSeedClients.push({ crossSeedTags: result.value.crossSeedTags })
    } else {
      const clientName = clients[i].name
      const isDecrypt = isDecryptionError(result.reason)
      if (isDecrypt) decryptionFailureCount++
      const raw = result.reason instanceof Error ? result.reason.message : "Unknown error"
      const message = isDecrypt ? "Credential decryption failed" : sanitizeNetworkError(raw)
      clientErrors.push(`${clientName}: ${message}`)
    }
  }

  // All clients failed with decryption errors. Which means the session key is stale.
  const sessionExpired =
    clients.length > 0 && torrentLists.length === 0 && decryptionFailureCount === clients.length

  // Build hash. Client name lookup before merge flattens provenance
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
    sessionExpired,
  }
}
