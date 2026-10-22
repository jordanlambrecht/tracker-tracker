// src/lib/tracker-overview.ts
//
// Functions: isOverviewPlatform, overviewClass, overviewUsername
//
// A tracker whose polls are account overviews stores no snapshot, so its class
// and username are read from the platform data its last poll stored on the
// tracker row.

import type { PlatformMeta } from "@/types/tracker-stats"

/** Each overview platform's class, read from its platform data. */
const OVERVIEW_CLASS: Partial<Record<string, (meta: PlatformMeta) => string | null>> = {}

export function isOverviewPlatform(platformType: string): boolean {
  return Object.hasOwn(OVERVIEW_CLASS, platformType)
}

export function overviewClass(platformType: string, meta: PlatformMeta | null): string | null {
  const read = OVERVIEW_CLASS[platformType]
  return read && meta ? read(meta) : null
}

/** The username an overview poll stored with its platform data. */
export function overviewUsername(meta: PlatformMeta | null): string | null {
  const value = (meta as { username?: unknown } | null)?.username
  return typeof value === "string" && value !== "" ? value : null
}
