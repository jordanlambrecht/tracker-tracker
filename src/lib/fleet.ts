// src/lib/fleet.ts
//
// Functions: parseTorrentTags, getRatioBuckets, getSeedTimeBuckets,
// extractTagsFromSnapshots, normalizeCategory, toMonthKey

import { CHART_THEME } from "@/components/charts/lib/theme"

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

/** Tracker tag with display metadata */
export interface TrackerTag {
  tag: string
  name: string
  color: string
}

/** Parse comma-separated qBT tag string into trimmed array */
export function parseTorrentTags(rawTags: string, lowercase = true): string[] {
  if (!rawTags) return []
  return rawTags
    .split(",")
    .map((t) => (lowercase ? t.trim().toLowerCase() : t.trim()))
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
  tagStats:
    | {
        tag: string
        seedingCount: number
        leechingCount: number
        uploadSpeed: number
        downloadSpeed: number
      }[]
    | null
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

export interface Bucket {
  label: string
  max: number
  color: string
}

/** Ratio bucket definitions — shared with TorrentsTab */
export const RATIO_BUCKETS: Bucket[] = [
  { label: "<0.5", max: 0.5, color: CHART_THEME.scale[0] },
  { label: "0.5-1", max: 1, color: CHART_THEME.scale[1] },
  { label: "1-2", max: 2, color: CHART_THEME.scale[2] },
  { label: "2-5", max: 5, color: CHART_THEME.scale[3] },
  { label: "5-10", max: 10, color: CHART_THEME.scale[4] },
  { label: "10+", max: Infinity, color: CHART_THEME.scale[5] },
]

/** Seed time bucket definitions — shared with TorrentsTab */
export const SEED_TIME_BUCKETS: Bucket[] = [
  { label: "<1d", max: 86_400, color: CHART_THEME.scale[0] },
  { label: "1-7d", max: 604_800, color: CHART_THEME.scale[1] },
  { label: "7-30d", max: 2_592_000, color: CHART_THEME.scale[2] },
  { label: "30-90d", max: 7_776_000, color: CHART_THEME.scale[3] },
  { label: "90d+", max: Infinity, color: CHART_THEME.scale[4] },
]

/** Age band bucket definitions for torrent age distribution charts */
export interface AgeBucket {
  label: string
  maxDays: number
}

export const AGE_BUCKETS: readonly AgeBucket[] = [
  { label: "0-30d", maxDays: 30 },
  { label: "1-3mo", maxDays: 90 },
  { label: "3-6mo", maxDays: 180 },
  { label: "6mo-1y", maxDays: 365 },
  { label: "1-2y", maxDays: 730 },
  { label: "2y+", maxDays: Infinity },
]

/** Normalize a qBT category string to a consistent display value */
export function normalizeCategory(raw: string | undefined | null): string {
  const trimmed = raw?.trim()
  return trimmed || "Uncategorized"
}

/** Convert a Unix timestamp (seconds) to a YYYY-MM month key */
export function toMonthKey(addedOnSeconds: number): string {
  const d = new Date(addedOnSeconds * 1000)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`
}

/** Ratio buckets with optional accent color override on the "2-5" range */
export function getRatioBuckets(accentColor?: string): Bucket[] {
  if (!accentColor) return RATIO_BUCKETS
  return RATIO_BUCKETS.map((b, i) => ({
    ...b,
    color: i === 3 ? accentColor : b.color,
  }))
}

/** Seed time buckets with optional accent color override on the "30-90d" range */
export function getSeedTimeBuckets(accentColor?: string): Bucket[] {
  if (!accentColor) return SEED_TIME_BUCKETS
  return SEED_TIME_BUCKETS.map((b, i) => ({
    ...b,
    color: i === 3 ? accentColor : b.color,
  }))
}

export interface FleetStats {
  totalSeeding: number
  totalLeeching: number
  fleetUploadSpeed: number
  fleetDownloadSpeed: number
  totalLibrarySize: number
  crossSeedPercent: number
  staleCount: number
}

export const SEEDING_STATES = new Set([
  "uploading",
  "stalledUP",
  "forcedUP",
  "queuedUP",
  "pausedUP",
])
export const LEECHING_STATES = new Set([
  "downloading",
  "stalledDL",
  "forcedDL",
  "queuedDL",
  "metaDL",
])
export const STALE_THRESHOLD_MS = 30 * 24 * 60 * 60 * 1000
