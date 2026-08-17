// src/lib/download-clients/fetch.ts
import "server-only"

import { isDecryptionError, sanitizeNetworkError } from "@/lib/error-utils"
import { parseTorrentTags } from "@/lib/fleet"
import { createAdapterForClient } from "./factory"
import { aggregateCrossSeedTags, mergeTorrentLists, stampClientNames } from "./merge"
import { buildBaseUrl } from "./qbt/transport"
import {
  getFilteredTorrents,
  getStoredTorrents,
  isStoreFresh,
  STORE_MAX_AGE_MS,
} from "./sync-store"
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
  tags: string[] | null,
  key: Buffer,
  filter?: string
): Promise<TorrentRecord[]> {
  const baseUrl = buildBaseUrl(client.host, client.port, client.useSsl)

  // Fast path: store is warm from scheduler, serve from memory.
  // Falls back to live fetch if store is stale (i.e. scheduler missed 2+ cycles).
  // Skip when filter is requested. Active speeds need live qBT data.
  if (!filter && isStoreFresh(baseUrl, STORE_MAX_AGE_MS)) {
    if (tags === null) return getStoredTorrents(baseUrl)
    // NOTE: this warm-path tag comparison is case-insensitive on both sides while
    // the cold path below hands the tag to qBT verbatim. Callers that pass
    // `tags: null` sidestep the divergence entirely by matching in application
    // code instead (see fetchAndMergeTorrents' `select`); the multi-tag fleet
    // path still has it.
    const tagSet = new Set(tags.map((t) => t.toLowerCase()))
    return getFilteredTorrents(baseUrl, (t) => {
      if (!t.tags) return false
      return parseTorrentTags(t.tags).some((tag) => tagSet.has(tag))
    })
  }

  // Cold path: store not yet populated, stale, or filter requested (i.e. active).
  // Fall back to live per-tag fetch.
  const adapter = createAdapterForClient(client, key)

  // No qBT-side tag filter: the caller narrows the list itself with `select`.
  // `filter` still goes through, so the 5s active poll stays cheap instead of
  // dragging the whole torrent list across on every tick.
  if (tags === null) {
    return adapter.getTorrents({ filter: filter as "active" | undefined })
  }

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
 * @param tags     qBT tag(s) to fetch, or null for no tag filter at all — the
 *                 caller then decides membership itself via `select`, which is
 *                 what the per-tracker route needs since a tracker may have no
 *                 tag, or a tag no torrent carries (issue #152).
 * @param key      AES-256-GCM decryption key derived from the master password.
 * @param filter   Optional qBT filter string (i.e. "active"). Not applied when
 *                 tags has more than one entry.
 * @param select   Optional membership test, applied per client on the raw
 *                 TorrentRecord — before merge, so client stamping stays
 *                 accurate, and before stripping, so it can still read the
 *                 announce URL.
 */
/** Per-client deadline for live fetches (seconds). Keeps the UI responsive
 *  when one client is offline — the online client's data arrives immediately
 *  while the offline one is cut short after this deadline instead of waiting
 *  for the full 30s retry cycle (15s timeout x 2 attempts). */
const CLIENT_DEADLINE_MS = 5_000

export async function fetchAndMergeTorrents(
  clients: DownloadClientRow[],
  tags: string[] | null,
  key: Buffer,
  filter?: string,
  select?: (torrent: TorrentRecord) => boolean
): Promise<MergedResult> {
  const empty: MergedResult = {
    torrents: [],
    crossSeedTags: [],
    clientErrors: [],
    clientCount: 0,
    sessionExpired: false,
  }

  // An empty tag array still means "nothing to ask for" — only an explicit null
  // means "everything, narrowed by select".
  if (clients.length === 0 || (tags !== null && tags.length === 0)) {
    return empty
  }

  const results = await Promise.allSettled(
    clients.map(async (client) => {
      const deadline = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Client deadline exceeded")), CLIENT_DEADLINE_MS)
      )
      const work = (async () => {
        const fetched = await fetchClientTorrents(client, tags, key, filter)
        return {
          clientName: client.name,
          crossSeedTags: client.crossSeedTags ?? [],
          torrents: select ? fetched.filter(select) : fetched,
        }
      })()
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
