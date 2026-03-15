// src/lib/slot-types.ts
//
// Functions: (types only)

import type { TrackerRegistryEntry } from "@/data/tracker-registry"
import type { GazellePlatformMeta, GGnPlatformMeta, NebulancePlatformMeta } from "@/lib/adapters/types"
import type { Snapshot, TrackerSummary } from "@/types/api"

export type SlotCategory = "badge" | "stat-card" | "progress"

export interface SlotContext {
  tracker: TrackerSummary
  latestSnapshot: Snapshot | null
  snapshots: Snapshot[]
  meta: GGnPlatformMeta | GazellePlatformMeta | NebulancePlatformMeta | null
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
