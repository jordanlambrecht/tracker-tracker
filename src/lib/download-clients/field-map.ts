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

const REQUIRED_NUMERIC = [
  "uploadSpeed",
  "downloadSpeed",
  "size",
  "ratio",
  "uploaded",
  "downloaded",
  // Satisfaction divides by this. An undefined value yields NaN, which
  // reads as unsatisfied but renders as a completed progress bar.
  "seedingTime",
]

/** Defaults missing or non-numeric required fields to 0, in place. */
export function coerceRequiredNumeric(result: Record<string, unknown>): void {
  for (const field of REQUIRED_NUMERIC) {
    if (typeof result[field] !== "number") {
      log.warn(
        { hash: result.hash, field, value: result[field] },
        "coerceRequiredNumeric: missing or non-numeric field, defaulting to 0"
      )
      result[field] = 0
    }
  }
}

export function mapQbtTorrent(raw: Record<string, unknown>): TorrentRecord {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(raw)) {
    result[FIELD_MAP[key] ?? key] = value
  }
  coerceRequiredNumeric(result)
  return result as unknown as TorrentRecord
}

export function mapQbtDelta(partial: Record<string, unknown>): Partial<TorrentRecord> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(partial)) {
    const mapped = FIELD_MAP[key] ?? key
    // A delta is merged over good stored values, so a garbage numeric is
    // dropped rather than coerced to 0, which would clobber them.
    if (REQUIRED_NUMERIC.includes(mapped) && typeof value !== "number") {
      log.warn({ field: mapped, value }, "mapQbtDelta: dropped non-numeric field")
      continue
    }
    result[mapped] = value
  }
  return result as Partial<TorrentRecord>
}
