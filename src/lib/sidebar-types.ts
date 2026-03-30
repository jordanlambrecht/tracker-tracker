// src/lib/sidebar-types.ts

import type { TrackerSummary } from "@/types/api"

type SortMode = "index" | "alpha" | "custom"

function sortTrackers(trackers: TrackerSummary[], mode: SortMode): TrackerSummary[] {
  const sorted = [...trackers]
  switch (mode) {
    case "alpha":
      return sorted.sort((a, b) => a.name.localeCompare(b.name))
    case "custom":
      return sorted.sort((a, b) => (a.sortOrder ?? Infinity) - (b.sortOrder ?? Infinity))
    default:
      return sorted
  }
}

export type { SortMode }
export { sortTrackers }
