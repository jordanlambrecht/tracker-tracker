// src/lib/fleet.ts
//
// Functions: parseTorrentTags, computeFleetStats, extractTagsFromSnapshots

import { CHART_THEME } from "@/components/charts/theme"

/** Raw torrent data from qBittorrent — shared by fleet charts */
export interface TorrentRaw {
  hash: string
  name: string
  state: string
  tags: string
  category: string
  uploaded: number
  downloaded: number
  ratio: number
  size: number
  seeding_time: number
  time_active: number
  added_on: number
  completion_on: number
  last_activity: number
  amount_left: number
  num_seeds: number
  num_leechs: number
  num_complete: number
  num_incomplete: number
  upspeed: number
  dlspeed: number
  availability: number
  progress: number
  client_name: string
}

/** Tracker tag with display metadata — shared by fleet charts */
export interface TrackerTag {
  tag: string
  name: string
  color: string
}

/** Parse comma-separated qBT tag string into normalized lowercase array */
export function parseTorrentTags(rawTags: string): string[] {
  return rawTags
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length > 0)
}

/** Parsed clientSnapshot row for fleet historical charts */
export interface FleetSnapshot {
  clientId: number
  clientName: string
  polledAt: string
  totalSeedingCount: number | null
  totalLeechingCount: number | null
  uploadSpeedBytes: string | null
  downloadSpeedBytes: string | null
  tagStats: { tag: string; seedingCount: number; leechingCount: number; uploadSpeed: number; downloadSpeed: number }[] | null
}

/** Extract sorted unique tag names from fleet snapshots */
export function extractTagsFromSnapshots(snapshots: FleetSnapshot[]): string[] {
  const tagSet = new Set<string>()
  for (const snap of snapshots) {
    if (!snap.tagStats) continue
    for (const stat of snap.tagStats) {
      tagSet.add(stat.tag)
    }
  }
  return Array.from(tagSet).sort()
}

/** Ratio bucket definitions — shared with TorrentsTab */
export const RATIO_BUCKETS = [
  { label: "<0.5", max: 0.5, color: CHART_THEME.scale[0] },
  { label: "0.5–1", max: 1, color: CHART_THEME.scale[1] },
  { label: "1–2", max: 2, color: CHART_THEME.scale[2] },
  { label: "2–5", max: 5, color: CHART_THEME.scale[3] },
  { label: "5–10", max: 10, color: CHART_THEME.scale[4] },
  { label: "10+", max: Infinity, color: CHART_THEME.scale[5] },
] as const

/** Seed time bucket definitions — shared with TorrentsTab */
export const SEED_TIME_BUCKETS = [
  { label: "<1d", maxSeconds: 86_400, color: CHART_THEME.scale[0] },
  { label: "1–7d", maxSeconds: 604_800, color: CHART_THEME.scale[1] },
  { label: "7–30d", maxSeconds: 2_592_000, color: CHART_THEME.scale[2] },
  { label: "30–90d", maxSeconds: 7_776_000, color: CHART_THEME.scale[3] },
  { label: "90d+", maxSeconds: Infinity, color: CHART_THEME.scale[4] },
] as const

export interface FleetStats {
  totalSeeding: number
  totalLeeching: number
  fleetUploadSpeed: number
  fleetDownloadSpeed: number
  totalLibrarySize: number
  crossSeedPercent: number
  staleCount: number
}

export const SEEDING_STATES = new Set(["uploading", "stalledUP", "forcedUP", "queuedUP", "pausedUP"])
export const LEECHING_STATES = new Set(["downloading", "stalledDL", "forcedDL", "queuedDL", "metaDL"])
const STALE_THRESHOLD_MS = 30 * 24 * 60 * 60 * 1000

export function computeFleetStats(
  torrents: { state: string; upspeed: number; dlspeed: number; size: number; last_activity: number; tags: string }[],
  crossSeedTags: string[]
): FleetStats {
  const csTagSet = new Set(crossSeedTags.map((t) => t.toLowerCase()))
  const now = Date.now()
  let totalSeeding = 0
  let totalLeeching = 0
  let fleetUploadSpeed = 0
  let fleetDownloadSpeed = 0
  let totalLibrarySize = 0
  let crossSeeded = 0
  let staleCount = 0

  for (const t of torrents) {
    if (SEEDING_STATES.has(t.state)) totalSeeding++
    else totalLeeching++
    fleetUploadSpeed += t.upspeed
    fleetDownloadSpeed += t.dlspeed
    totalLibrarySize += t.size
    if (t.last_activity > 0 && now - t.last_activity * 1000 > STALE_THRESHOLD_MS) staleCount++
    if (csTagSet.size > 0) {
      if (parseTorrentTags(t.tags).some((tag) => csTagSet.has(tag))) crossSeeded++
    }
  }

  return {
    totalSeeding,
    totalLeeching,
    fleetUploadSpeed,
    fleetDownloadSpeed,
    totalLibrarySize,
    crossSeedPercent: torrents.length > 0 ? (crossSeeded / torrents.length) * 100 : 0,
    staleCount,
  }
}
