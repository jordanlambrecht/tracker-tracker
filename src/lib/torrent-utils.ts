// src/lib/torrent-utils.ts
//
// Functions: mapTorrent, parseTorrentTags
// Types: QbtTorrentRaw, TorrentInfo, AggregatedTorrentsResponse, CategoryStats
//
// Re-exports SEEDING_STATES, LEECHING_STATES from fleet.ts (single source of truth).
// QbtTorrentRaw is an alias for TorrentRaw from fleet.ts.

import { LEECHING_STATES, SEEDING_STATES, type TorrentRaw } from "@/lib/fleet"

// Re-export constants from fleet.ts — single source of truth
export { SEEDING_STATES, LEECHING_STATES }

// QbtTorrentRaw is the same shape as TorrentRaw (fleet.ts) — aliased here
// for semantic clarity in per-tracker contexts vs fleet-wide contexts.
export type QbtTorrentRaw = TorrentRaw

// ---------------------------------------------------------------------------
// Mapped torrent shape (camelCase for component use)
// ---------------------------------------------------------------------------

export interface TorrentInfo {
  hash: string
  name: string
  state: string
  tags: string
  category: string
  uploaded: number
  downloaded: number
  ratio: number
  size: number
  seedingTime: number
  timeActive: number
  addedOn: number
  completionOn: number
  lastActivity: number
  amountLeft: number
  numSeeds: number
  numLeechs: number
  numComplete: number
  numIncomplete: number
  upspeed: number
  dlspeed: number
  availability: number
  progress: number
  clientName: string
}

// ---------------------------------------------------------------------------
// API response shape
// ---------------------------------------------------------------------------

export interface AggregatedTorrentsResponse {
  torrents: QbtTorrentRaw[]
  crossSeedTags: string[]
  clientErrors: string[]
  clientCount: number
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

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------

export function mapTorrent(raw: QbtTorrentRaw): TorrentInfo {
  return {
    hash: raw.hash,
    name: raw.name,
    state: raw.state,
    tags: raw.tags,
    category: raw.category,
    uploaded: raw.uploaded,
    downloaded: raw.downloaded,
    ratio: raw.ratio,
    size: raw.size,
    seedingTime: raw.seeding_time,
    timeActive: raw.time_active,
    addedOn: raw.added_on,
    completionOn: raw.completion_on,
    lastActivity: raw.last_activity,
    amountLeft: raw.amount_left,
    numSeeds: raw.num_seeds,
    numLeechs: raw.num_leechs,
    numComplete: raw.num_complete,
    numIncomplete: raw.num_incomplete,
    upspeed: raw.upspeed,
    dlspeed: raw.dlspeed,
    availability: raw.availability,
    progress: raw.progress,
    clientName: raw.client_name,
  }
}

/**
 * Split comma-separated qBT tag string into trimmed array.
 * Preserves original case — unlike fleet.ts parseTorrentTags which lowercases.
 * Case-preserving is needed here for per-tracker tag group matching where
 * member.tag casing must match exactly.
 */
export function parseTorrentTags(rawTags: string): string[] {
  return rawTags
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
}
