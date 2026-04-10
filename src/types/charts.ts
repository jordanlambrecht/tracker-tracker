// src/types/charts.ts

import type { Snapshot } from "@/types/api"

interface TrackerSnapshotSeries {
  name: string
  color: string
  snapshots: Snapshot[]
}

interface FleetChartProps {
  trackerData: TrackerSnapshotSeries[]
  height?: number
}

type VolumeField = "upload" | "download"

interface StackedAreaSeries {
  name: string
  color: string
  monthMap: Map<string, number>
}

export type { FleetChartProps, StackedAreaSeries, TrackerSnapshotSeries, VolumeField }
