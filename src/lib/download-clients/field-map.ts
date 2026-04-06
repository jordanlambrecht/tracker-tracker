// src/lib/download-clients/field-map.ts

import type { TorrentRecord } from "./types"

const FIELD_MAP: Record<string, string> = {
  upspeed: "uploadSpeed",
  dlspeed: "downloadSpeed",
  num_seeds: "seedCount",
  num_leechs: "leechCount",
  num_complete: "swarmSeeders",
  num_incomplete: "swarmLeechers",
  added_on: "addedAt",
  completion_on: "completedAt",
  last_activity: "lastActivityAt",
  seeding_time: "seedingTime",
  time_active: "activeTime",
  seen_complete: "lastSeenComplete",
  amount_left: "remaining",
  content_path: "contentPath",
  save_path: "savePath",
  is_private: "isPrivate",
}

export function mapQbtTorrent(raw: Record<string, unknown>): TorrentRecord {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(raw)) {
    result[FIELD_MAP[key] ?? key] = value
  }
  return result as unknown as TorrentRecord
}

export function mapQbtDelta(partial: Record<string, unknown>): Partial<TorrentRecord> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(partial)) {
    result[FIELD_MAP[key] ?? key] = value
  }
  return result as Partial<TorrentRecord>
}
