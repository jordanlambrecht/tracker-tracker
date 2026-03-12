// src/types/charts.ts

import type { Snapshot } from "@/types/api"

/** A tracker's color-coded snapshot series — shared by all multi-tracker chart components */
interface TrackerSnapshotSeries {
  name: string
  color: string
  snapshots: Snapshot[]
}

export type { TrackerSnapshotSeries }
