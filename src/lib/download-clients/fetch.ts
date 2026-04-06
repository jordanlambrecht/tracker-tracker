// src/lib/download-clients/fetch.ts
import "server-only"

import { isDecryptionError, sanitizeNetworkError } from "@/lib/error-utils"
import { parseTorrentTags } from "@/lib/fleet"
import { createAdapterForClient } from "./factory"
import { aggregateCrossSeedTags, mergeTorrentLists, stampClientNames } from "./merge"
import { buildBaseUrl } from "./qbt/transport"
import { getFilteredTorrents, isStoreFresh, STORE_MAX_AGE_MS } from "./sync-store"
import type { DownloadClientRow, TorrentRecord } from "./types"

// ---------------------------------------------------------------------------
// Sensitive field stripping
// ---------------------------------------------------------------------------

/**
 * Strips tracker announce URL, contentPath, and savePath from a torrent object.
 * These fields may contain passkeys or expose server filesystem paths.
 */
export function stripSensitiveTorrentFields<
  T extends Pick<TorrentRecord, "tracker" | "contentPath" | "savePath">,
>(torrent: T): Omit<T, "tracker" | "contentPath" | "savePath"> {
  const { tracker: _t, contentPath: _cp, savePath: _sp, ...rest } = torrent
  return rest
}

// ---------------------------------------------------------------------------
// Fetch + merge orchestration
// ---------------------------------------------------------------------------

export interface MergedResult {
  torrents: (Omit<TorrentRecord, "tracker" | "contentPath" | "savePath"> & {
    clientName: string
  })[]
  crossSeedTags: string[]
  clientErrors: string[]
  clientCount: number
  /** True when every client failure was a decryption error, indicating a stale session key. */
  sessionExpired: boolean
}

async function fetchClientTorrents(
  client: DownloadClientRow,
  tags: string[],
  key: Buffer,
  filter?: string
): Promise<TorrentRecord[]> {
  const baseUrl = buildBaseUrl(client.host, client.port, client.useSsl)

  // Fast path: store is warm from scheduler, serve from memory.
  // Falls back to live fetch if store is stale (i.e. scheduler missed 2+ cycles).
  // Skip when filter is requested. Active speeds need live qBT data.
  if (!filter && isStoreFresh(baseUrl, STORE_MAX_AGE_MS)) {
    const tagSet = new Set(tags.map((t) => t.toLowerCase()))
    return getFilteredTorrents(baseUrl, (t) => {
      if (!t.tags) return false
      return parseTorrentTags(t.tags).some((tag) => tagSet.has(tag))
    })
  }

  // Cold path: store not yet populated, stale, or filter requested (i.e. active).
  // Fall back to live per-tag fetch.
  const adapter = createAdapterForClient(client, key)

  if (tags.length === 1) {
    return adapter.getTorrents({ tag: tags[0], filter: filter as "active" | undefined })
  }

  const results = await Promise.allSettled(tags.map((tag) => adapter.getTorrents({ tag })))
  const allTorrents: TorrentRecord[] = []
  for (const result of results) {
    if (result.status === "fulfilled") allTorrents.push(...result.value)
  }
  return allTorrents
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
  clients: DownloadClientRow[],
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
        crossSeedTags: client.crossSeedTags ?? [],
        torrents: await fetchClientTorrents(client, tags, key, filter),
      }))()
      return Promise.race([work, deadline])
    })
  )

  const clientTorrents: { clientName: string; torrents: TorrentRecord[] }[] = []
  const crossSeedClients: { crossSeedTags: string[] }[] = []
  const clientErrors: string[] = []
  let decryptionFailureCount = 0

  for (let i = 0; i < results.length; i++) {
    const result = results[i]
    if (result.status === "fulfilled") {
      clientTorrents.push({
        clientName: result.value.clientName,
        torrents: result.value.torrents,
      })
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
    clients.length > 0 && clientTorrents.length === 0 && decryptionFailureCount === clients.length

  const merged = mergeTorrentLists(clientTorrents.map((c) => c.torrents))
  const crossSeedTags = aggregateCrossSeedTags(crossSeedClients)

  const torrents = stampClientNames(clientTorrents, merged).map((t) => ({
    ...stripSensitiveTorrentFields(t),
  }))

  return {
    torrents,
    crossSeedTags,
    clientErrors,
    clientCount: clients.length,
    sessionExpired,
  }
}
