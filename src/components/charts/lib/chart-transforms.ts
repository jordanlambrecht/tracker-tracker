// src/components/charts/lib/chart-transforms.ts
//
// Functions: buildActivityMatrix, computeDailyDeltas, carryForwardValues, buildTimeSeriesData, carryForwardTimeSeries, collectUnifiedTimestamps

import type { Snapshot } from "@/types/api"
import type { TrackerSnapshotSeries } from "@/types/charts"

export interface DailyBucket {
  label: string
  uploadDelta: number
  downloadDelta: number
}

/** Compute per-day upload/download deltas (in GiB) from a sorted snapshot list. */
export function computeDailyDeltas(snapshots: Snapshot[]): DailyBucket[] {
  if (snapshots.length < 2) return []

  const sorted = [...snapshots].sort(
    (a, b) => new Date(a.polledAt).getTime() - new Date(b.polledAt).getTime()
  )

  const bucketMap = new Map<string, { upload: number; download: number }>()

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]
    const curr = sorted[i]

    const uploadDiff = Number(BigInt(curr.uploadedBytes) - BigInt(prev.uploadedBytes))
    const downloadDiff = Number(BigInt(curr.downloadedBytes) - BigInt(prev.downloadedBytes))

    const dayKey = new Date(curr.polledAt).toISOString().slice(0, 10)

    const existing = bucketMap.get(dayKey) ?? { upload: 0, download: 0 }
    existing.upload += uploadDiff
    existing.download += downloadDiff
    bucketMap.set(dayKey, existing)
  }

  return Array.from(bucketMap.entries()).map(([label, { upload, download }]) => ({
    label,
    uploadDelta: upload / 1024 ** 3,
    downloadDelta: download / 1024 ** 3,
  }))
}

/**
 * Build a 7×24 activity matrix from a list of Unix epoch timestamps (seconds).
 * Returns the flattened [hour, day, count] data array and the maximum count.
 */
export function buildActivityMatrix(addedOnSeconds: number[]): {
  data: [number, number, number][]
  maxCount: number
} {
  const grid = Array.from({ length: 7 }, () => Array(24).fill(0) as number[])
  for (const ts of addedOnSeconds) {
    const d = new Date(ts * 1000)
    grid[d.getDay()][d.getHours()]++
  }
  let maxCount = 0
  const data: [number, number, number][] = []
  for (let hour = 0; hour < 24; hour++) {
    for (let day = 0; day < 7; day++) {
      const count = grid[day][hour]
      if (count > maxCount) maxCount = count
      data.push([hour, day, count])
    }
  }
  return { data, maxCount }
}

/**
 * Map a pre-built Map<timestamp, number> onto a string timestamp axis, carrying
 * forward the last known value at timestamps where there is no data.
 * O(T) where T = timestamps.length. Used by charts that pre-index values
 * before mapping to the unified axis (e.g. SeedbonusRiverChart).
 */
export function carryForwardValues(
  timestamps: string[],
  valueMap: Map<string, number>,
  initialValue: number | null = null
): (number | null)[] {
  let lastValue = initialValue
  return timestamps.map((ts) => {
    const val = valueMap.get(ts)
    if (val !== undefined) lastValue = val
    return lastValue
  })
}

/**
 * Build [timestamp_ms, value][] pairs for a time-axis series.
 * Skips snapshots where fieldFn returns null.
 */
export function buildTimeSeriesData(
  snapshots: Snapshot[],
  fieldFn: (s: Snapshot) => number | null
): [number, number][] {
  const result: [number, number][] = []
  for (const s of snapshots) {
    const val = fieldFn(s)
    if (val !== null) result.push([new Date(s.polledAt).getTime(), val])
  }
  return result
}

/**
 * Carry-forward variant for time-axis. Returns [timestamp_ms, value][] pairs
 * where gaps are filled with the last known value from each tracker's own snapshots.
 * Used for stacked/summed multi-tracker charts on a time axis.
 */
export function carryForwardTimeSeries(
  allTimestamps: number[],
  snapshots: Snapshot[],
  fieldFn: (s: Snapshot) => number | null
): [number, number][] {
  const snapByTs = new Map<number, Snapshot>()
  for (const snap of snapshots) {
    snapByTs.set(new Date(snap.polledAt).getTime(), snap)
  }
  let lastValue: number | null = null
  const result: [number, number][] = []
  for (const ts of allTimestamps) {
    const snap = snapByTs.get(ts)
    if (snap) {
      const raw = fieldFn(snap)
      if (raw !== null) lastValue = raw
    }
    if (lastValue !== null) result.push([ts, lastValue])
  }
  return result
}

/**
 * Collect the union of all polledAt timestamps across multiple tracker series,
 * sorted ascending. Returns millisecond timestamps for use with time-axis charts.
 */
export function collectUnifiedTimestamps(trackerData: TrackerSnapshotSeries[]): number[] {
  const set = new Set<number>()
  for (const { snapshots } of trackerData) {
    for (const s of snapshots) set.add(new Date(s.polledAt).getTime())
  }
  return [...set].sort((a, b) => a - b)
}
