// src/components/charts/chart-transforms.ts
//
// Functions: formatSnapshotLabel, buildSmartLabels, buildUnifiedTimestampAxis, buildActivityMatrix, computeDailyDeltas

import { formatChartTimestamp } from "@/components/charts/theme"
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

/** Format an ISO timestamp string into the standard chart label. */
export function formatSnapshotLabel(isoTimestamp: string): string {
  return formatChartTimestamp(new Date(isoTimestamp).getTime())
}

/**
 * Build x-axis labels that show the date only on the first point of each day,
 * then time-only for subsequent points on the same day. Eliminates the
 * repeated "Mar 14, Mar 14, Mar 14..." clutter on dense time axes.
 */
export function buildSmartLabels(isoTimestamps: string[]): string[] {
  let prevDay = ""
  return isoTimestamps.map((iso) => {
    const d = new Date(iso)
    const day = d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
    const time = d.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
    if (day !== prevDay) {
      prevDay = day
      return day
    }
    return time
  })
}

/**
 * Build a unified, sorted timestamp axis from the union of all polledAt values
 * across multiple tracker snapshot series.
 */
export function buildUnifiedTimestampAxis(trackerData: TrackerSnapshotSeries[]): {
  timestamps: string[]
  labels: string[]
} {
  const set = new Set<string>()
  for (const { snapshots } of trackerData) {
    for (const s of snapshots) set.add(s.polledAt as string)
  }
  const timestamps = [...set].sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
  return { timestamps, labels: timestamps.map(formatSnapshotLabel) }
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
