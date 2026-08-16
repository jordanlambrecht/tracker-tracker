// src/lib/download-clients/coordinator.ts
//
// Functions: fetchFleetTorrents, fetchTrackerTorrents,
//            fetchFleetAggregation, fetchTrackerTorrentsCached,
//            testClientConnection
//
// Multi-client orchestration layer for fleet and per-tracker torrent data.
// Owns credential queries, tag collection, fan-out, merge, and aggregation.

import "server-only"

import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { downloadClients, trackers } from "@/lib/db/schema"
import { isDecryptionError, sanitizeNetworkError } from "@/lib/error-utils"
import { parseTorrentTags } from "@/lib/fleet"
import { computeFleetAggregation, type FleetAggregation } from "@/lib/fleet-aggregation"
import { trackerHostKey } from "@/lib/tracker-matching"
import type { TagGroup } from "@/types/api"
import { CLIENT_CONNECTION_COLUMNS } from "./credentials"
import { createAdapterForClient } from "./factory"
import type { MergedResult } from "./fetch"
import { fetchAndMergeTorrents } from "./fetch"
import { aggregateCrossSeedTags, mergeTorrentLists, stampClientNames } from "./merge"
import { buildBaseUrl, parseCachedTorrents } from "./qbt/transport"
import { getFilteredTorrents, isStoreFresh, STORE_MAX_AGE_MS } from "./sync-store"
import { type SlimTorrent, slimTorrentForCache } from "./transforms"
import type { TorrentRecord } from "./types"

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** CLIENT_CONNECTION_COLUMNS + crossSeedTags + type (needed by fetchAndMergeTorrents via adapter factory). */
const FETCH_CLIENT_COLUMNS = {
  ...CLIENT_CONNECTION_COLUMNS,
  crossSeedTags: downloadClients.crossSeedTags,
  type: downloadClients.type,
} as const

/** Columns for cached reads (no credentials, includes connection info for sync store lookup). */
const CACHED_CLIENT_COLUMNS = {
  id: downloadClients.id,
  name: downloadClients.name,
  host: downloadClients.host,
  port: downloadClients.port,
  useSsl: downloadClients.useSsl,
  crossSeedTags: downloadClients.crossSeedTags,
  cachedTorrentsAt: downloadClients.cachedTorrentsAt,
} as const

function collectTags(rows: { qbtTag: string | null }[]): string[] {
  return [
    ...new Set(
      rows
        .map((t) => t.qbtTag)
        .filter((t): t is string => t !== null && t.trim() !== "")
        .map((t) => t.trim())
    ),
  ]
}

// ---------------------------------------------------------------------------
// Live fetch (requires encryption key)
// ---------------------------------------------------------------------------

/**
 * Fetch and merge torrents across all enabled clients for all active tracker tags.
 * Used by the fleet torrents page.
 */
export async function fetchFleetTorrents(key: Buffer, filter?: string): Promise<MergedResult> {
  const [allTrackers, clients] = await Promise.all([
    db.select({ qbtTag: trackers.qbtTag }).from(trackers).where(eq(trackers.isActive, true)),
    db.select(FETCH_CLIENT_COLUMNS).from(downloadClients).where(eq(downloadClients.enabled, true)),
  ])

  const tags = collectTags(allTrackers)
  return fetchAndMergeTorrents(clients, tags, key, filter)
}

/**
 * Fetch and merge torrents across all enabled clients for a single tracker's tag.
 * Used by the per-tracker torrent page.
 */
export async function fetchTrackerTorrents(
  trackerId: number,
  key: Buffer,
  filter?: string
): Promise<{ result: MergedResult } | { error: string; status: number }> {
  const [tracker] = await db
    .select({ qbtTag: trackers.qbtTag })
    .from(trackers)
    .where(eq(trackers.id, trackerId))
    .limit(1)

  if (!tracker) {
    return { error: "Tracker not found", status: 404 }
  }

  if (!tracker.qbtTag) {
    return { error: "No qBittorrent tag configured for this tracker", status: 400 }
  }

  const clients = await db
    .select(FETCH_CLIENT_COLUMNS)
    .from(downloadClients)
    .where(eq(downloadClients.enabled, true))

  const tag = tracker.qbtTag.trim()
  const result = await fetchAndMergeTorrents(clients, [tag], key, filter)
  return { result }
}

// ---------------------------------------------------------------------------
// Cached reads (no encryption key needed)
// ---------------------------------------------------------------------------

export interface FleetAggregationResponse extends FleetAggregation {
  clientErrors: string[]
  clientCount: number
  cachedAt: string | null
}

/**
 * Read cached torrent data across all clients, merge, and compute fleet aggregation.
 * Fast path: in-memory sync store. Fallback: Postgres JSONB (cold start only).
 * No live qBT HTTP requests.
 *
 * `tagGroups` is optional: pass it to have the aggregation also count tag-group
 * membership across the fleet (the dashboard's Tag Groups section). Callers that omit
 * it get `tagGroupBreakdowns: []` and the aggregation skips the work entirely.
 */
export async function fetchFleetAggregation(
  options?: { tagGroups?: TagGroup[] }
): Promise<FleetAggregationResponse> {
  const tagGroups = options?.tagGroups ?? []

  const clients = await db
    .select(CACHED_CLIENT_COLUMNS)
    .from(downloadClients)
    .where(eq(downloadClients.enabled, true))

  if (clients.length === 0) {
    return {
      ...computeFleetAggregation([], [], [], tagGroups),
      clientErrors: [],
      clientCount: 0,
      cachedAt: null,
    }
  }

  const trackerTagRows = await db
    .select({
      qbtTag: trackers.qbtTag,
      name: trackers.name,
      color: trackers.color,
      baseUrl: trackers.baseUrl,
    })
    .from(trackers)

  // Only real tags drive the qBittorrent-side tag filter.
  const trackerTagStrings = trackerTagRows
    .map((r) => r.qbtTag)
    .filter((t): t is string => Boolean(t))

  // Untagged trackers are still included, keyed by their announce host, so
  // their torrents can be attributed without any tagging setup (issue #152).
  const trackerTagsWithMeta = trackerTagRows
    .map((r) => {
      const key = r.qbtTag ?? trackerHostKey(r.baseUrl)
      if (!key) return null
      return {
        tag: key,
        name: r.name,
        color: r.color ?? "#01d4ff",
        baseUrl: r.baseUrl,
      }
    })
    .filter((t): t is NonNullable<typeof t> => t !== null)

  const crossSeedTags = aggregateCrossSeedTags(
    clients.map((c) => ({ crossSeedTags: c.crossSeedTags ?? [] }))
  )
  const allTags = [...new Set([...trackerTagStrings, ...crossSeedTags])]
  const tagSet = new Set(allTags.map((t) => t.toLowerCase()))
  // Announce hosts of every tracker we know about, so a torrent from a tracked
  // site is kept even when it carries no recognised tag.
  const knownAnnounceHosts = new Set(
    trackerTagRows
      .map((r) => trackerHostKey(r.baseUrl))
      .filter((h): h is string => h !== null)
  )
  const tagPredicate = (t: TorrentRecord) => {
    if (t.tags && parseTorrentTags(t.tags).some((tag) => tagSet.has(tag))) return true
    const host = trackerHostKey(t.tracker)
    return host !== null && knownAnnounceHosts.has(host)
  }

  const clientTorrents: { clientName: string; torrents: (TorrentRecord | SlimTorrent)[] }[] = []
  const clientErrors: string[] = []
  let oldestCacheAt: Date | null = null

  for (const client of clients) {
    const baseUrl = buildBaseUrl(client.host, client.port, client.useSsl)
    let torrents: TorrentRecord[] | SlimTorrent[]

    if (isStoreFresh(baseUrl, STORE_MAX_AGE_MS)) {
      torrents = getFilteredTorrents(baseUrl, tagPredicate).map(slimTorrentForCache)
    } else {
      const [row] = await db
        .select({ cachedTorrents: downloadClients.cachedTorrents })
        .from(downloadClients)
        .where(eq(downloadClients.id, client.id))
        .limit(1)
      torrents = row ? parseCachedTorrents(row.cachedTorrents) : []
    }

    if (torrents.length === 0) {
      if (client.cachedTorrentsAt) {
        clientErrors.push(`${client.name}: cached data unavailable or corrupt`)
      }
      continue
    }
    clientTorrents.push({ clientName: client.name, torrents })

    if (client.cachedTorrentsAt) {
      if (!oldestCacheAt || client.cachedTorrentsAt < oldestCacheAt) {
        oldestCacheAt = client.cachedTorrentsAt
      }
    }
  }

  const merged = mergeTorrentLists(clientTorrents.map((c) => c.torrents))
  const stamped = stampClientNames(clientTorrents, merged)

  const aggregation = computeFleetAggregation(
    stamped,
    trackerTagsWithMeta,
    crossSeedTags,
    tagGroups
  )

  return {
    ...aggregation,
    clientErrors,
    clientCount: clients.length,
    cachedAt: oldestCacheAt?.toISOString() ?? null,
  }
}

interface CachedTorrentResult {
  torrents: (SlimTorrent & { clientName: string })[]
  crossSeedTags: string[]
  clientErrors: string[]
  clientCount: number
  cachedAt: string | null
}

/**
 * Read cached torrent data for a single tracker from Postgres JSONB.
 * Used as fallback when live qBT connection fails.
 */
export async function fetchTrackerTorrentsCached(
  trackerId: number
): Promise<{ result: CachedTorrentResult } | { error: string; status: number }> {
  const [tracker] = await db
    .select({ qbtTag: trackers.qbtTag })
    .from(trackers)
    .where(eq(trackers.id, trackerId))
    .limit(1)

  if (!tracker) {
    return { error: "Tracker not found", status: 404 }
  }

  if (!tracker.qbtTag) {
    return { error: "No qBittorrent tag configured", status: 400 }
  }

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
    return {
      result: { torrents: [], crossSeedTags: [], clientErrors: [], clientCount: 0, cachedAt: null },
    }
  }

  const tag = tracker.qbtTag.trim().toLowerCase()
  const clientTorrents: { clientName: string; torrents: SlimTorrent[] }[] = []
  const crossSeedClients: { crossSeedTags: string[] }[] = []
  let oldestCacheAt: Date | null = null

  for (const client of clients) {
    const all = parseCachedTorrents(client.cachedTorrents)
    if (all.length === 0) continue

    const filtered = all.filter((t) => parseTorrentTags(t.tags).includes(tag))
    if (filtered.length > 0) {
      clientTorrents.push({ clientName: client.name, torrents: filtered })
    }

    crossSeedClients.push({ crossSeedTags: client.crossSeedTags ?? [] })

    if (client.cachedTorrentsAt) {
      if (!oldestCacheAt || client.cachedTorrentsAt < oldestCacheAt) {
        oldestCacheAt = client.cachedTorrentsAt
      }
    }
  }

  const merged = mergeTorrentLists(clientTorrents.map((c) => c.torrents))
  const crossSeedTags = aggregateCrossSeedTags(crossSeedClients)

  // SlimTorrent already has sensitive fields stripped (done at cache-write time by slimTorrentForCache).
  const stamped = stampClientNames(clientTorrents, merged)

  return {
    result: {
      torrents: stamped,
      crossSeedTags,
      clientErrors: [],
      clientCount: clients.length,
      cachedAt: oldestCacheAt?.toISOString() ?? null,
    },
  }
}

// ---------------------------------------------------------------------------
// Connection testing (adapter-based)
// ---------------------------------------------------------------------------

/**
 * Test a download client connection via the adapter layer.
 * Returns a plain result object (not NextResponse) so route handlers
 * control the HTTP response shape.
 */
export async function testClientConnection(
  clientId: number,
  key: Buffer
): Promise<{ success: true } | { error: string; status: number }> {
  const [client] = await db
    .select({
      ...CLIENT_CONNECTION_COLUMNS,
      type: downloadClients.type,
      crossSeedTags: downloadClients.crossSeedTags,
    })
    .from(downloadClients)
    .where(eq(downloadClients.id, clientId))
    .limit(1)

  if (!client) {
    return { error: "Client not found", status: 404 }
  }

  try {
    const adapter = createAdapterForClient(client, key)
    await adapter.testConnection()
    return { success: true }
  } catch (error) {
    if (isDecryptionError(error)) {
      return { error: "Session expired. Please log in again", status: 401 }
    }
    const raw = error instanceof Error ? error.message : ""
    return { error: sanitizeNetworkError(raw, "Connection test failed"), status: 422 }
  }
}
