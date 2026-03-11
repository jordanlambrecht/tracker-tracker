// src/components/charts/VolumeSurface3D.tsx
//
// Functions: computeDailyGrid, bucketGrid, buildSurfaceOption, VolumeSurface3D

"use client"

import ReactECharts from "echarts-for-react"
import "echarts-gl"
import type { Snapshot } from "@/types/api"
import { ChartEmptyState } from "./ChartEmptyState"
import { CHART_THEME, chartAxisLabel, chartTooltip } from "./theme"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TrackerVolumeSeries {
  name: string
  color: string
  snapshots: Snapshot[]
}

interface VolumeSurface3DProps {
  trackerData: TrackerVolumeSeries[]
  height?: number
}

interface GridResult {
  bucketLabels: string[]
  trackerNames: string[]
  trackerColors: string[]
  uploadGrid: number[][] // [trackerIdx][bucketIdx] = GiB
  downloadGrid: number[][] // [trackerIdx][bucketIdx] = GiB
  granularity: "day" | "week" | "month"
}

// ---------------------------------------------------------------------------
// Grid computation
// ---------------------------------------------------------------------------

function computeDailyGrid(trackerData: TrackerVolumeSeries[]): {
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
      const day = new Date(snap.polledAt).toISOString().slice(0, 10)
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
function getBucketKey(day: string, granularity: "day" | "week" | "month"): string {
  if (granularity === "day") return day
  if (granularity === "month") return day.slice(0, 7) // "YYYY-MM"
  // ISO week: find Monday of the week
  const d = new Date(`${day}T12:00:00`)
  const dow = d.getDay()
  const monday = new Date(d)
  monday.setDate(d.getDate() - ((dow + 6) % 7))
  return monday.toISOString().slice(0, 10)
}

/** Format a bucket key into a human-readable label. */
function formatBucketLabel(key: string, granularity: "day" | "week" | "month"): string {
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
function bucketGrid(daily: ReturnType<typeof computeDailyGrid>): GridResult {
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

// ---------------------------------------------------------------------------
// ECharts option builder
// ---------------------------------------------------------------------------

function buildSurfaceOption(grid: GridResult): Record<string, unknown> {
  if (grid.bucketLabels.length === 0 || grid.trackerNames.length === 0) return {}

  const displayLabels = grid.bucketLabels.map((k) => formatBucketLabel(k, grid.granularity))
  const bucketCount = grid.bucketLabels.length

  // Determine unit
  let maxVal = 0
  for (const row of grid.uploadGrid) {
    for (const v of row) maxVal = Math.max(maxVal, v)
  }
  const useTiB = maxVal >= 1024
  const divisor = useTiB ? 1024 : 1
  const unit = useTiB ? "TiB" : "GiB"

  // Build bar3D data: [bucketIndex, trackerIndex, value]
  const barData: [number, number, number][] = []
  for (let ti = 0; ti < grid.trackerNames.length; ti++) {
    for (let bi = 0; bi < bucketCount; bi++) {
      const val = grid.uploadGrid[ti][bi] / divisor
      if (val > 0) {
        barData.push([bi, ti, Number(val.toFixed(3))])
      }
    }
  }

  // Adaptive bar size — fewer buckets = fatter bars
  const barSize = bucketCount > 40 ? 4 : bucketCount > 20 ? 6 : bucketCount > 10 ? 8 : 10

  // Adaptive box width — wider for more buckets
  const boxWidth = Math.min(300, Math.max(150, bucketCount * 6))

  const periodLabel =
    grid.granularity === "month" ? "Month" : grid.granularity === "week" ? "Week" : "Day"

  return {
    backgroundColor: "transparent",
    tooltip: chartTooltip("item", {
      show: true,
      formatter: (params: { value: number[] }) => {
        const [bi, ti, val] = params.value
        const bucketLabel = displayLabels[bi] ?? "?"
        const tracker = grid.trackerNames[ti] ?? "?"
        const formatted = Math.abs(val).toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
        return `<div style="font-family:var(--font-mono),monospace">` +
          `<div style="color:${CHART_THEME.textTertiary};font-size:11px;margin-bottom:2px">${bucketLabel}</div>` +
          `<div><span style="color:${CHART_THEME.textSecondary}">${tracker}:</span> <b>${formatted} ${unit}</b></div>` +
          `</div>`
      },
    }),
    xAxis3D: {
      type: "category",
      data: displayLabels,
      name: periodLabel,
      nameTextStyle: {
        color: CHART_THEME.textSecondary,
        fontFamily: CHART_THEME.fontMono,
        fontSize: 11,
      },
      axisLabel: chartAxisLabel({
        fontSize: 9,
        interval: Math.max(0, Math.floor(displayLabels.length / 8) - 1),
      }),
      axisLine: { lineStyle: { color: CHART_THEME.borderEmphasis } },
    },
    yAxis3D: {
      type: "category",
      data: grid.trackerNames,
      name: "Tracker",
      nameTextStyle: {
        color: CHART_THEME.textSecondary,
        fontFamily: CHART_THEME.fontMono,
        fontSize: 11,
      },
      axisLabel: chartAxisLabel(),
      axisLine: { lineStyle: { color: CHART_THEME.borderEmphasis } },
    },
    zAxis3D: {
      type: "value",
      name: `Upload (${unit})`,
      nameTextStyle: {
        color: CHART_THEME.textSecondary,
        fontFamily: CHART_THEME.fontMono,
        fontSize: 11,
      },
      axisLabel: chartAxisLabel({ fontSize: 9 }),
      axisLine: { lineStyle: { color: CHART_THEME.borderEmphasis } },
    },
    grid3D: {
      boxWidth,
      boxDepth: 80,
      boxHeight: 80,
      viewControl: {
        projection: "perspective",
        autoRotate: true,
        autoRotateSpeed: 4,
        rotateSensitivity: 2,
        zoomSensitivity: 1.5,
        distance: 250,
        alpha: 25,
        beta: 40,
      },
      light: {
        main: {
          intensity: 1.2,
          shadow: true,
          alpha: 30,
          beta: 40,
        },
        ambient: { intensity: 0.3 },
      },
      environment: "transparent",
    },
    visualMap: {
      show: false,
      min: 0,
      max: maxVal / divisor,
      inRange: {
        color: grid.trackerColors.length > 1
          ? grid.trackerColors
          : [
              CHART_THEME.accentGlow,
              CHART_THEME.accentGlow60,
              CHART_THEME.accent,
            ],
      },
      dimension: 2,
    },
    series: [
      {
        type: "bar3D",
        data: barData,
        shading: "lambert",
        barSize,
        bevelSize: 0.3,
        bevelSmoothness: 2,
        emphasis: {
          itemStyle: { color: CHART_THEME.warn, opacity: 1 },
          label: { show: false },
        },
        itemStyle: {
          opacity: 0.9,
        },
        label: { show: false },
      },
    ],
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function VolumeSurface3D({ trackerData, height = 480 }: VolumeSurface3DProps) {
  const hasData = trackerData.some((t) => t.snapshots.length > 1)

  if (!hasData) {
    return (
      <ChartEmptyState
        height={height}
        message="Need at least 2 days of data across trackers."
      />
    )
  }

  const daily = computeDailyGrid(trackerData)
  const grid = bucketGrid(daily)
  const option = buildSurfaceOption(grid)

  if (!option.series) {
    return (
      <ChartEmptyState
        height={height}
        message="No daily volume data to display."
      />
    )
  }

  return (
    <ReactECharts
      option={option}
      style={{ height, width: "100%" }}
      opts={{ renderer: "canvas" }}
      notMerge
      lazyUpdate
    />
  )
}

export { VolumeSurface3D, computeDailyGrid }
export type { TrackerVolumeSeries, VolumeSurface3DProps }
