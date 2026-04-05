// src/lib/qbt/qbitmanage-defaults.ts
//
// Functions: QBITMANAGE_TAG_DEFAULTS, QBITMANAGE_KEYS, parseQbitmanageTags

import type { QbitmanageTagConfig } from "@/types/api"

export const QBITMANAGE_TAG_DEFAULTS: QbitmanageTagConfig = {
  issue: { enabled: true, tag: "issue" },
  minTimeNotReached: { enabled: true, tag: "MinTimeNotReached" },
  noHardlinks: { enabled: true, tag: "noHL" },
  minSeedsNotMet: { enabled: true, tag: "MinSeedsNotMet" },
  lastActiveLimitNotReached: { enabled: true, tag: "LastActiveLimitNotReached" },
  lastActiveNotReached: { enabled: true, tag: "LastActiveNotReached" },
}

export const QBITMANAGE_KEYS = Object.keys(QBITMANAGE_TAG_DEFAULTS) as (keyof QbitmanageTagConfig)[]

/** Parse the JSON text column, falling back to defaults if null or invalid. */
export function parseQbitmanageTags(raw: string | null): QbitmanageTagConfig {
  if (!raw) return { ...QBITMANAGE_TAG_DEFAULTS }
  try {
    const parsed = JSON.parse(raw)
    // Merge with defaults to ensure all keys exist
    const result = { ...QBITMANAGE_TAG_DEFAULTS }
    for (const key of QBITMANAGE_KEYS) {
      if (
        parsed[key] &&
        typeof parsed[key].enabled === "boolean" &&
        typeof parsed[key].tag === "string"
      ) {
        result[key] = { enabled: parsed[key].enabled, tag: parsed[key].tag }
      }
    }
    return result
  } catch {
    return { ...QBITMANAGE_TAG_DEFAULTS }
  }
}
