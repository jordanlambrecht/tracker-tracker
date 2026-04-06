// src/lib/torrent-utils.ts
//
// Types: AggregatedTorrentsResponse, CategoryStats
//
// Re-exports SEEDING_STATES, LEECHING_STATES from fleet.ts (single source of truth).

import { LEECHING_STATES, parseTorrentTags, SEEDING_STATES, type TorrentRaw } from "@/lib/fleet"

// Re-export constants and utilities from fleet.ts — single source of truth
export { LEECHING_STATES, parseTorrentTags, SEEDING_STATES }

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
