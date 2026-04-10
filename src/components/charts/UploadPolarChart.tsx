// src/components/charts/UploadPolarChart.tsx
"use client"

import type { EChartsOption } from "echarts"
import { useState } from "react"
import { TabBar } from "@/components/ui/TabBar"
import { hexToRgba } from "@/lib/color-utils"
import { formatBytesNum } from "@/lib/formatters"
import type { Snapshot } from "@/types/api"
import { ChartECharts } from "./lib/ChartECharts"
import { ChartEmptyState } from "./lib/ChartEmptyState"
import { DAY_LABELS, HOUR_LABELS } from "./lib/chart-helpers"
import { CHART_THEME, chartTooltip, escHtml } from "./lib/theme"

type PolarMode = "upload" | "download"

interface HourDayBucket {
  day: number
  hour: number
  avgBytes: number
  count: number
}

interface UploadPolarChartProps {
  snapshots: Snapshot[]
  accentColor: string
  height?: number
}

// ── Data computation ──

function computeHourlyAverages(snapshots: Snapshot[], mode: PolarMode): HourDayBucket[] {
  if (snapshots.length < 2) return []

  const sorted = [...snapshots].sort(
    (a, b) => new Date(a.polledAt).getTime() - new Date(b.polledAt).getTime()
  )

  const buckets = new Map<string, { total: number; count: number }>()
  const field = mode === "upload" ? "uploadedBytes" : "downloadedBytes"

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]
    const curr = sorted[i]

    const prevBytes = Number(BigInt(prev[field]))
    const currBytes = Number(BigInt(curr[field]))
    const delta = currBytes - prevBytes

    if (delta <= 0) continue

    const date = new Date(curr.polledAt)
    const day = date.getDay()
    const hour = date.getHours()
    const key = `${day}-${hour}`

    const existing = buckets.get(key)
    if (existing) {
      existing.total += delta
      existing.count += 1
    } else {
      buckets.set(key, { total: delta, count: 1 })
    }
  }

  const result: HourDayBucket[] = []
  for (const [key, val] of buckets) {
    const [d, h] = key.split("-").map(Number)
    result.push({ day: d, hour: h, avgBytes: val.total / val.count, count: val.count })
  }
  return result
}

// ── Chart option builder ──

function buildPolarOption(
  buckets: HourDayBucket[],
  accentColor: string,
  mode: PolarMode
): EChartsOption {
  const grid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0))
  let maxVal = 0

  for (const b of buckets) {
    grid[b.day][b.hour] = b.avgBytes
    if (b.avgBytes > maxVal) maxVal = b.avgBytes
  }

  // Flatten the 7x24 grid into [hourIdx, dayIdx, value] triples for the heatmap
  const heatmapData: [number, number, number][] = []
  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      heatmapData.push([hour, day, grid[day][hour]])
    }
  }

  const axisLabelStyle = {
    color: CHART_THEME.textTertiary,
    fontFamily: CHART_THEME.fontMono,
    fontSize: CHART_THEME.fontSizeCompact,
  }

  const ANGLE_STEP = 360 / 24
  const INNER_RADIUS_PCT = 15
  const OUTER_RADIUS_PCT = 88
  const RING_STEP = (OUTER_RADIUS_PCT - INNER_RADIUS_PCT) / 7
  const GAP = 0.6 // degrees gap between wedges

  const dirLabel = mode === "upload" ? "↑" : "↓"

  return {
    backgroundColor: "transparent",
    tooltip: chartTooltip("item", {
      borderColor: accentColor,
      formatter: (params: unknown) => {
        const p = params as { data: [number, number, number] }
        const [hourIdx, dayIdx, val] = p.data
        if (!val || val <= 0) return ""
        const dayName = escHtml(DAY_LABELS[dayIdx] ?? "")
        const hourLabel = escHtml(HOUR_LABELS[hourIdx] ?? "")
        const formatted = formatBytesNum(val)
        return (
          `<div style="font-family:var(--font-mono),monospace;font-size:${CHART_THEME.fontSizeDense}px;` +
          `color:${CHART_THEME.textTertiary};margin-bottom:4px;">${dayName} at ${hourLabel}</div>` +
          `<span style="color:${CHART_THEME.textPrimary};font-weight:600;">${escHtml(formatted)}/hr ${dirLabel}</span>`
        )
      },
    }),
    polar: {
      radius: [`${INNER_RADIUS_PCT}%`, `${OUTER_RADIUS_PCT}%`],
    },
    angleAxis: {
      type: "category",
      data: HOUR_LABELS,
      boundaryGap: true,
      startAngle: 90 + ANGLE_STEP / 2,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: axisLabelStyle,
      splitLine: { show: false },
    },
    radiusAxis: {
      type: "category",
      data: DAY_LABELS,
      z: 10,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        ...axisLabelStyle,
        fontSize: CHART_THEME.fontSizeMicro,
      },
      splitLine: { show: false },
    },
    visualMap: {
      show: false,
      min: 0,
      max: maxVal || 1,
      inRange: {
        color: [
          hexToRgba(accentColor, 0.06),
          hexToRgba(accentColor, 0.2),
          hexToRgba(accentColor, 0.45),
          hexToRgba(accentColor, 0.7),
          hexToRgba(accentColor, 0.95),
        ],
      },
    },
    series: [
      {
        type: "custom",
        coordinateSystem: "polar",
        data: heatmapData,
        renderItem: (_params: unknown, api: unknown) => {
          const a = api as {
            value: (idx: number) => number
            coord: (val: [number, number]) => [number, number]
            size: (val: [number, number]) => [number, number]
            getWidth: () => number
            getHeight: () => number
            visual: (key: string) => string
          }
          const hourIdx = a.value(0)
          const dayIdx = a.value(1)

          // Polar center in pixels
          const cx = a.getWidth() / 2
          const cy = a.getHeight() / 2
          const outerPx = (Math.min(cx, cy) * OUTER_RADIUS_PCT) / 100

          // Angular range for this hour wedge (clockwise from top)
          const startAngle = 90 - hourIdx * ANGLE_STEP + ANGLE_STEP / 2 - GAP / 2
          const endAngle = startAngle - ANGLE_STEP + GAP

          // Radial range for this day ring (innermost = Sun)
          const r0 = ((INNER_RADIUS_PCT + dayIdx * RING_STEP) / OUTER_RADIUS_PCT) * outerPx + 1
          const r1 =
            ((INNER_RADIUS_PCT + (dayIdx + 1) * RING_STEP) / OUTER_RADIUS_PCT) * outerPx - 1

          return {
            type: "sector",
            shape: {
              cx,
              cy,
              r0,
              r: r1,
              startAngle: (startAngle * Math.PI) / 180,
              endAngle: (endAngle * Math.PI) / 180,
            },
            style: {
              fill: a.visual("color"),
            },
            emphasis: {
              style: {
                stroke: accentColor,
                lineWidth: 2,
              },
            },
          }
        },
      },
    ],
  }
}

// ── Component ──

const POLAR_TABS = [
  { key: "upload" as const, label: "Upload" },
  { key: "download" as const, label: "Download" },
]

function UploadPolarChart({
  snapshots,
  accentColor = CHART_THEME.accent,
  height = 380,
}: UploadPolarChartProps) {
  const [mode, setMode] = useState<PolarMode>("upload")

  const hasEnoughSnapshots = snapshots.length >= 2
  const buckets = hasEnoughSnapshots ? computeHourlyAverages(snapshots, mode) : []

  if (!hasEnoughSnapshots) {
    return (
      <ChartEmptyState
        height={height}
        message="Not enough snapshots to compute activity patterns."
      />
    )
  }

  return (
    <div className="flex flex-col gap-1">
      <TabBar compact tabs={POLAR_TABS} activeTab={mode} onChange={setMode} />
      {buckets.length === 0 ? (
        <ChartEmptyState
          height={height}
          message={`No positive ${mode} deltas found in the selected range.`}
        />
      ) : (
        <ChartECharts
          option={buildPolarOption(buckets, accentColor, mode)}
          style={{ height, width: "100%" }}
        />
      )}
    </div>
  )
}

export type { HourDayBucket, PolarMode, UploadPolarChartProps }
export { computeHourlyAverages, UploadPolarChart }
