// src/lib/download-clients/field-map.ts

import { log } from "@/lib/logger"
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

const REQUIRED_NUMERIC = ["uploadSpeed", "downloadSpeed", "size", "ratio", "uploaded", "downloaded"]

export function mapQbtTorrent(raw: Record<string, unknown>): TorrentRecord {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(raw)) {
    result[FIELD_MAP[key] ?? key] = value
  }
  for (const field of REQUIRED_NUMERIC) {
    if (typeof result[field] !== "number") {
      log.warn(
        { hash: result.hash, field, value: result[field] },
        "mapQbtTorrent: missing or non-numeric field, defaulting to 0"
      )
      result[field] = 0
    }
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
