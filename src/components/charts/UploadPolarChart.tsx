// src/components/charts/UploadPolarChart.tsx
//
// Functions: computeHourlyUploadAverages, buildPolarOption, UploadPolarChart

"use client"

import type { EChartsOption } from "echarts"
import ReactECharts from "echarts-for-react"
import { formatBytesNum, hexToRgba } from "@/lib/formatters"
import type { Snapshot } from "@/types/api"
import { ChartEmptyState } from "./ChartEmptyState"
import { CHART_THEME, chartTooltip } from "./theme"

// ── Types ──

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

// ── Constants ──

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

const HOUR_LABELS = Array.from({ length: 24 }, (_, i) => {
  if (i === 0) return "12a"
  if (i < 12) return `${i}a`
  if (i === 12) return "12p"
  return `${i - 12}p`
})

// ── Data computation ──

export function computeHourlyUploadAverages(snapshots: Snapshot[]): HourDayBucket[] {
  if (snapshots.length < 2) return []

  const sorted = [...snapshots].sort(
    (a, b) => new Date(a.polledAt).getTime() - new Date(b.polledAt).getTime()
  )

  const buckets = new Map<string, { total: number; count: number }>()

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]
    const curr = sorted[i]

    const prevBytes = Number(BigInt(prev.uploadedBytes))
    const currBytes = Number(BigInt(curr.uploadedBytes))
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

function buildPolarOption(buckets: HourDayBucket[], accentColor: string): EChartsOption {
  const grid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0))
  let maxVal = 0

  for (const b of buckets) {
    grid[b.day][b.hour] = b.avgBytes
    if (b.avgBytes > maxVal) maxVal = b.avgBytes
  }

  const axisLabelStyle = {
    color: CHART_THEME.textTertiary,
    fontFamily: CHART_THEME.fontMono,
    fontSize: 10,
  }

  return {
    backgroundColor: "transparent",
    tooltip: chartTooltip("item", {
      formatter: (params: unknown) => {
        const p = params as { data: number[] }
        const hour = p.data[0]
        const day = p.data[1]
        const val = p.data[2]
        if (val <= 0) return ""
        const dayName = DAY_LABELS[day]
        const hourLabel = HOUR_LABELS[hour]
        const formatted = formatBytesNum(val)
        return (
          `<div style="font-family:var(--font-mono),monospace;font-size:11px;` +
          `color:${CHART_THEME.textTertiary};margin-bottom:4px;">${dayName} ${hourLabel}</div>` +
          `<span style="color:${CHART_THEME.textPrimary};font-weight:600;">` +
          `Avg upload delta: ${formatted}</span>`
        )
      },
    }),
    polar: {
      radius: ["15%", "90%"],
    },
    angleAxis: {
      type: "category",
      data: HOUR_LABELS,
      boundaryGap: true,
      startAngle: 97.5,
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
      axisLabel: axisLabelStyle,
      splitLine: { show: false },
    },
    visualMap: {
      show: false,
      min: 0,
      max: maxVal || 1,
      inRange: {
        color: [
          hexToRgba(accentColor, 0.05),
          hexToRgba(accentColor, 0.2),
          hexToRgba(accentColor, 0.45),
          hexToRgba(accentColor, 0.7),
          hexToRgba(accentColor, 0.95),
        ],
      },
    },
    series: DAY_LABELS.map((_, dayIdx) => ({
      type: "bar" as const,
      coordinateSystem: "polar" as const,
      name: DAY_LABELS[dayIdx],
      data: HOUR_LABELS.map((__, hourIdx) => grid[dayIdx][hourIdx]),
      stack: "days",
      itemStyle: {
        color: (params: unknown) => {
          const val = (params as { data: number }).data as number
          const ratio = maxVal > 0 ? val / maxVal : 0
          return hexToRgba(accentColor, Math.max(0.05, ratio * 0.9 + 0.05))
        },
        borderColor: CHART_THEME.surface,
        borderWidth: 1,
      },
      emphasis: {
        itemStyle: {
          borderColor: accentColor,
          borderWidth: 2,
        },
      },
    })),
  }
}

// ── Component ──

function UploadPolarChart({
  snapshots,
  accentColor = CHART_THEME.accent,
  height = 380,
}: UploadPolarChartProps) {
  if (snapshots.length < 2) {
    return (
      <ChartEmptyState
        height={height}
        message="Not enough snapshots to compute upload patterns."
      />
    )
  }

  const buckets = computeHourlyUploadAverages(snapshots)

  if (buckets.length === 0) {
    return (
      <ChartEmptyState
        height={height}
        message="No positive upload deltas found in the selected range."
      />
    )
  }

  return (
    <ReactECharts
      option={buildPolarOption(buckets, accentColor)}
      style={{ height, width: "100%" }}
      opts={{ renderer: "canvas" }}
      notMerge
      lazyUpdate
    />
  )
}

export { UploadPolarChart }
export type { UploadPolarChartProps, HourDayBucket }
