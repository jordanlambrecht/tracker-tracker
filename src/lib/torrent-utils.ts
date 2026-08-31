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
 * Formats a per-torrent ratio for display. qBT reports -1 for an infinite
 * ratio (zero downloads, i.e. a cross-seed), so negatives render as infinity.
 * Account-level ratios have no sentinel; format those with formatRatio.
 */
export function formatTorrentRatio(ratio: number): string {
  return formatRatio(ratio < 0 ? Number.POSITIVE_INFINITY : ratio)
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
