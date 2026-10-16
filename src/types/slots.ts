// src/types/slots.ts
//
// Functions: (types only)

import type { TrackerRegistryEntry } from "@/data/tracker-registry"
import type { Snapshot, TrackerSummary } from "@/types/api"
import type { PlatformMeta } from "@/types/tracker-stats"

export type SlotCategory = "badge" | "stat-card" | "progress"

export interface SlotContext {
  tracker: TrackerSummary
  latestSnapshot: Snapshot | null
  meta: PlatformMeta | null
  registry: TrackerRegistryEntry | undefined
  accentColor: string
}

export interface ResolvedSlot {
  id: string
  category: SlotCategory
  props: Record<string, unknown>
  priority: number
  span: 1 | 2
}
