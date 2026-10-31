// src/lib/torrent-utils.ts
//
// Types: AggregatedTorrentsResponse, CategoryStats
//
// Re-exports SEEDING_STATES, LEECHING_STATES from fleet.ts (single source of truth).

import { LEECHING_STATES, parseTorrentTags, SEEDING_STATES, type TorrentRaw } from "@/lib/fleet"
import { formatRatio } from "@/lib/formatters"

// Re-export constants and utilities from fleet.ts. Single source of truth.
export { LEECHING_STATES, parseTorrentTags, SEEDING_STATES }

/**
 * The per-torrent ratio qBittorrent 5.1.1+ sends for an infinite ratio, which
 * means something uploaded with nothing downloaded and no pieces held. Versions
 * 4.1.0 to 5.1.0 never send it and cap the same torrent at 9999. A complete
 * cross-seed has a finite ratio. Storage keeps -1 because JSONB cannot hold
 * Infinity, so read a ratio through torrentRatioValue.
 */
export const INFINITE_TORRENT_RATIO = -1

export function isInfiniteTorrentRatio(ratio: number): boolean {
  return ratio === INFINITE_TORRENT_RATIO
}

/** The per-torrent ratio as a number, with the sentinel read as Infinity. */
export function torrentRatioValue(ratio: number): number {
  return isInfiniteTorrentRatio(ratio) ? Number.POSITIVE_INFINITY : ratio
}

/**
 * Formats a per-torrent ratio for display, the sentinel as infinity.
 * Account-level ratios have no sentinel; format those with formatRatio.
 */
export function formatTorrentRatio(ratio: number): string {
  return formatRatio(torrentRatioValue(ratio))
}

// ---------------------------------------------------------------------------
// API response shape
// ---------------------------------------------------------------------------

export interface AggregatedTorrentsResponse {
  torrents: TorrentRaw[]
  crossSeedTags: string[]
  clientErrors: string[]
  clientCount: number
  cachedAt?: string | null
}

// ---------------------------------------------------------------------------
// Derived category stats (used by multiple chart/table components)
// ---------------------------------------------------------------------------

export interface CategoryStats {
  name: string
  count: number
  totalSize: number
  avgRatio: number
  avgSeedTime: number
  avgSwarmSeeds: number
}
