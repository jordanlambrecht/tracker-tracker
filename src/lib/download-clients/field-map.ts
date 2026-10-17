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

/**
 * Every non-optional number on TorrentRecord. A field left out of this set has
 * no gate, so a string from the host becomes NaN in the arithmetic and null in
 * cachedTorrents after a JSON round trip.
 */
const REQUIRED_NUMERIC = new Set([
  "uploadSpeed",
  "downloadSpeed",
  "size",
  "ratio",
  "uploaded",
  "downloaded",
  // Satisfaction divides by this. An undefined value yields NaN, which
  // reads as unsatisfied but renders as a completed progress bar.
  "seedingTime",
  "progress",
  "seedCount",
  "leechCount",
  "swarmSeeders",
  "swarmLeechers",
  "availability",
  "remaining",
  "addedAt",
  "completedAt",
  "lastActivityAt",
  "activeTime",
  "lastSeenComplete",
])

/**
 * String fields a consumer calls a string method on. parseTorrentTags does
 * `rawTags.split(",")` on `tags` (fleet.ts), so a truthy non-string throws and
 * takes the whole aggregation down. hash, name and state are deliberately
 * absent: those identify the record, and isTorrentRecord drops it rather than
 * inventing them.
 */
const REQUIRED_STRING = new Set(["tags", "category", "tracker", "contentPath", "savePath"])

/** Defaults missing or non-string required fields to "", in place. */
export function coerceRequiredString(result: Record<string, unknown>): void {
  for (const field of REQUIRED_STRING) {
    if (field in result && typeof result[field] !== "string") {
      // The name and the type, never the value: tracker, contentPath and
      // savePath carry passkeys and server paths, which is why fetch.ts strips
      // all three before a torrent leaves this module.
      log.warn(
        { hash: result.hash, field, received: typeof result[field] },
        "coerceRequiredString: non-string field, defaulting to empty"
      )
      result[field] = ""
    }
  }
}

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
  coerceRequiredString(result)
  return result as unknown as TorrentRecord
}

export function mapQbtDelta(partial: Record<string, unknown>): Partial<TorrentRecord> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(partial)) {
    const mapped = FIELD_MAP[key] ?? key
    // A delta is merged over good stored values, so a garbage numeric is
    // dropped rather than coerced to 0, which would clobber them.
    if (REQUIRED_NUMERIC.has(mapped) && typeof value !== "number") {
      // Debug, not warn: this fires per field per torrent per poll, and a
      // client that mistypes one field across a large library would flood.
      log.debug({ field: mapped, value }, "mapQbtDelta: dropped non-numeric field")
      continue
    }
    result[mapped] = value
  }
  return result as Partial<TorrentRecord>
}

/**
 * Returns a partial with every required field whose type is wrong removed, or
 * the same object when they all match. A delta merges over values the client
 * reported in an earlier poll, so coercing here would write a 0 or an empty
 * string over a figure it did report. mapQbtDelta applies the same rule to
 * numerics before a qBittorrent delta ever reaches the store.
 */
export function dropMistypedDeltaFields(partial: Partial<TorrentRecord>): Partial<TorrentRecord> {
  const source = partial as Record<string, unknown>
  let pruned: Record<string, unknown> | null = null
  for (const field of Object.keys(source)) {
    const received = typeof source[field]
    const mistyped =
      (REQUIRED_STRING.has(field) && received !== "string") ||
      (REQUIRED_NUMERIC.has(field) && received !== "number")
    if (!mistyped) continue
    pruned ??= { ...source }
    delete pruned[field]
    // Debug, not warn: a client that mistypes one field across a large library
    // would flood the log with one line per torrent per poll.
    log.debug({ field, received }, "dropMistypedDeltaFields: dropped a field of the wrong type")
  }
  return (pruned ?? partial) as Partial<TorrentRecord>
}
