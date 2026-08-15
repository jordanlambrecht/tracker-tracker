// src/components/charts/lib/chart-transforms.ts
//
// Pure, side-effect-free chart data transforms. This module must never import
// echarts or echarts-gl: it is shared by statically imported 2D charts and by
// the dynamically imported WebGL charts, and an echarts-gl import here would
// pull WebGL into the main bundle for every consumer.
//
// Functions: buildActivityMatrix, computeDailyDeltas, carryForwardValues, buildTimeSeriesData, carryForwardTimeSeries, collectUnifiedTimestamps, computeDailyGrid, getBucketKey, formatBucketLabel, bucketGrid

import { localDateStr } from "@/lib/formatters"
import type { Snapshot } from "@/types/api"
import type { TrackerSnapshotSeries } from "@/types/charts"

export interface DailyBucket {
  label: string
  uploadDelta: number
  downloadDelta: number
}

/** Compute per-day upload/download deltas (in GiB) from a sorted snapshot list. */
// INVARIANT: snapshots arrive sorted ascending by polledAt from the API
export function computeDailyDeltas(snapshots: Snapshot[]): DailyBucket[] {
  if (snapshots.length < 2) return []

  const bucketMap = new Map<string, { upload: number; download: number }>()

  for (let i = 1; i < snapshots.length; i++) {
    const prev = snapshots[i - 1]
    const curr = snapshots[i]

    const uploadDiff = Number(BigInt(curr.uploadedBytes) - BigInt(prev.uploadedBytes))
    const downloadDiff = Number(BigInt(curr.downloadedBytes) - BigInt(prev.downloadedBytes))

    const dayKey = localDateStr(new Date(curr.polledAt))

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
 * Build a 7x24 activity matrix from a list of Unix epoch timestamps (seconds).
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

// ---------------------------------------------------------------------------
// Tracker x date-bucket volume grid
//
// Shared by VolumeSurface3D (bar3D) and VolumeSurface2D (2D heatmap), which draw
// the same numbers with different marks.
// ---------------------------------------------------------------------------

export interface GridResult {
  bucketLabels: string[]
  trackerNames: string[]
  trackerColors: string[]
  uploadGrid: number[][] // [trackerIdx][bucketIdx] = GiB
  downloadGrid: number[][] // [trackerIdx][bucketIdx] = GiB
  granularity: "day" | "week" | "month"
}

export function computeDailyGrid(trackerData: TrackerSnapshotSeries[]): {
  days: string[]
  trackerNames: string[]
  trackerColors: string[]
  uploadGrid: number[][]
  downloadGrid: number[][]
} {
  const trackerNames = trackerData.map((t) => t.name)
  const trackerColors = trackerData.map((t) => t.color)

  // For each tracker, group snapshots by day and get last snapshot per day
  const trackerDayMaps: Map<string, Snapshot>[] = trackerData.map((t) => {
    const sorted = [...t.snapshots].sort(
      (a, b) => new Date(a.polledAt).getTime() - new Date(b.polledAt).getTime()
    )
    const dayMap = new Map<string, Snapshot>()
    for (const snap of sorted) {
      const day = localDateStr(new Date(snap.polledAt))
      dayMap.set(day, snap)
    }
    return dayMap
  })

  // Unified day set
  const allDays = new Set<string>()
  for (const dm of trackerDayMaps) {
    for (const day of dm.keys()) allDays.add(day)
  }
  const days = Array.from(allDays).sort()

  // Compute daily deltas for each tracker
  const uploadGrid: number[][] = []
  const downloadGrid: number[][] = []

  for (let ti = 0; ti < trackerData.length; ti++) {
    const dayMap = trackerDayMaps[ti]
    const uploads: number[] = []
    const downloads: number[] = []

    for (let di = 0; di < days.length; di++) {
      const curr = dayMap.get(days[di])
      let prev: Snapshot | undefined
      for (let pi = di - 1; pi >= 0; pi--) {
        prev = dayMap.get(days[pi])
        if (prev) break
      }

      if (curr && prev) {
        const upDelta = Number(BigInt(curr.uploadedBytes) - BigInt(prev.uploadedBytes))
        const dlDelta = Number(BigInt(curr.downloadedBytes) - BigInt(prev.downloadedBytes))
        uploads.push(Math.max(0, upDelta / 1024 ** 3))
        downloads.push(Math.max(0, dlDelta / 1024 ** 3))
      } else {
        uploads.push(0)
        downloads.push(0)
      }
    }

    uploadGrid.push(uploads)
    downloadGrid.push(downloads)
  }

  return { days, trackerNames, trackerColors, uploadGrid, downloadGrid }
}

/** Assign each YYYY-MM-DD to a bucket key based on granularity. */
export function getBucketKey(day: string, granularity: "day" | "week" | "month"): string {
  if (granularity === "day") return day
  if (granularity === "month") return day.slice(0, 7) // "YYYY-MM"
  // ISO week: find Monday of the week
  const d = new Date(`${day}T12:00:00`)
  const dow = d.getDay()
  const monday = new Date(d)
  monday.setDate(d.getDate() - ((dow + 6) % 7))
  return localDateStr(monday)
}

/** Format a bucket key into a human-readable label. */
export function formatBucketLabel(key: string, granularity: "day" | "week" | "month"): string {
  if (granularity === "month") {
    const [y, m] = key.split("-")
    const date = new Date(Number(y), Number(m) - 1, 1)
    return date.toLocaleDateString("en-US", { month: "short", year: "2-digit" })
  }
  const date = new Date(`${key}T12:00:00`)
  if (granularity === "week") {
    return `Wk ${date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
  }
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

/** Aggregate daily grids into buckets (weekly/monthly) by summing deltas. */
export function bucketGrid(daily: ReturnType<typeof computeDailyGrid>): GridResult {
  const dayCount = daily.days.length
  const granularity: "day" | "week" | "month" =
    dayCount <= 45 ? "day" : dayCount <= 180 ? "week" : "month"

  if (granularity === "day") {
    return {
      bucketLabels: daily.days,
      trackerNames: daily.trackerNames,
      trackerColors: daily.trackerColors,
      uploadGrid: daily.uploadGrid,
      downloadGrid: daily.downloadGrid,
      granularity,
    }
  }

  // Map each day index to its bucket key
  const dayBucketKeys = daily.days.map((d) => getBucketKey(d, granularity))

  // Ordered unique bucket keys
  const seen = new Set<string>()
  const orderedBucketKeys: string[] = []
  for (const key of dayBucketKeys) {
    if (!seen.has(key)) {
      seen.add(key)
      orderedBucketKeys.push(key)
    }
  }

  const bucketIndex = new Map<string, number>()
  for (let i = 0; i < orderedBucketKeys.length; i++) {
    bucketIndex.set(orderedBucketKeys[i], i)
  }

  const bucketCount = orderedBucketKeys.length
  const uploadGrid: number[][] = []
  const downloadGrid: number[][] = []

  for (let ti = 0; ti < daily.trackerNames.length; ti++) {
    const uploads = new Array<number>(bucketCount).fill(0)
    const downloads = new Array<number>(bucketCount).fill(0)

    for (let di = 0; di < daily.days.length; di++) {
      const bi = bucketIndex.get(dayBucketKeys[di])
      if (bi === undefined) continue
      uploads[bi] += daily.uploadGrid[ti][di]
      downloads[bi] += daily.downloadGrid[ti][di]
    }

    uploadGrid.push(uploads)
    downloadGrid.push(downloads)
  }

  return {
    bucketLabels: orderedBucketKeys,
    trackerNames: daily.trackerNames,
    trackerColors: daily.trackerColors,
    uploadGrid,
    downloadGrid,
    granularity,
  }
}
