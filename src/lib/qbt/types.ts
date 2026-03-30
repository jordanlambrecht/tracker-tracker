// src/lib/qbt/types.ts

// From GET /api/v2/torrents/info
export interface QbtTorrent {
  hash: string
  name: string
  state: string // "uploading", "stalledUP", "downloading", "stalledDL", "pausedUP", "pausedDL", etc.
  tags: string // comma-separated, i.e "aither, cross-seed"
  category: string
  upspeed: number // bytes/sec
  dlspeed: number // bytes/sec
  uploaded: number // total bytes uploaded
  downloaded: number // total bytes downloaded
  ratio: number
  size: number // bytes
  num_seeds: number // connected seeds
  num_leechs: number // connected leechers
  num_complete: number // total seeders in swarm
  num_incomplete: number // total leechers in swarm
  tracker: string // primary tracker URL
  added_on: number // unix timestamp — when torrent was added
  completion_on: number // unix timestamp — when download completed (-1 if incomplete)
  last_activity: number // unix timestamp — last transfer activity
  seeding_time: number // seconds spent seeding
  time_active: number // seconds total active time
  seen_complete: number // unix timestamp — last time a complete copy was seen in swarm
  availability: number // float 0-1, piece availability
  amount_left: number // bytes remaining to download
  progress: number // float 0-1, download progress
  content_path: string // full path to content
  save_path: string // save directory
  is_private?: boolean // qBT API returns this field in snake_case
}

// From GET /api/v2/transfer/info
export interface QbtTransferInfo {
  up_info_speed: number // global upload speed bytes/sec
  dl_info_speed: number // global download speed bytes/sec
  up_info_data: number // session uploaded bytes
  dl_info_data: number // session downloaded bytes
}

// Aggregated output types
export interface TagStats {
  tag: string
  seedingCount: number
  leechingCount: number
  uploadSpeed: number // bytes/sec
  downloadSpeed: number // bytes/sec
}

export interface ClientStats {
  totalSeedingCount: number
  totalLeechingCount: number
  uploadSpeedBytes: number
  downloadSpeedBytes: number
  tagStats: TagStats[]
}

export const VALID_CLIENT_TYPES = ["qbittorrent"] as const

// Spot-checks a single value for the QbtTorrent shape (key fields only).
// Used to validate the first element of a JSONB array before trusting the rest.
export function isQbtTorrent(value: unknown): value is QbtTorrent {
  if (!value || typeof value !== "object") return false
  const t = value as Record<string, unknown>
  return (
    typeof t.hash === "string" &&
    typeof t.name === "string" &&
    typeof t.state === "string" &&
    typeof t.size === "number" &&
    typeof t.ratio === "number"
  )
}

/** Response from GET /api/v2/sync/maindata?rid=N */
export interface QbtMaindataResponse {
  rid: number
  full_update?: boolean
  torrents?: Record<string, Partial<QbtTorrent>>
  torrents_removed?: string[]
  server_state?: Partial<QbtTransferInfo> & Record<string, unknown>
  tags?: string[]
  tags_removed?: string[]
  categories?: Record<string, { name: string; savePath: string }>
  categories_removed?: string[]
}

/** Spot-checks a sync/maindata response for basic structural validity. */
export function isQbtMaindataResponse(value: unknown): value is QbtMaindataResponse {
  if (!value || typeof value !== "object") return false
  return typeof (value as Record<string, unknown>).rid === "number"
}
