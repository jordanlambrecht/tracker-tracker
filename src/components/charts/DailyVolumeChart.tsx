// src/components/charts/DailyVolumeChart.tsx
//
// Functions: computePerTrackerDailyDeltas, buildDailyVolumeOption, buildRiverOption, DailyVolumeChart

"use client"

import clsx from "clsx"
import type { EChartsOption } from "echarts"
import { useState } from "react"
import type { Snapshot } from "@/types/api"
import type { TrackerSnapshotSeries } from "@/types/charts"
import { ChartECharts } from "./ChartECharts"
import { ChartEmptyState } from "./ChartEmptyState"
import { fmtNum } from "./chart-helpers"
import { CHART_THEME, chartAxisLabel, chartDot, chartGrid, chartLegend, chartTooltip, chartTooltipHeader, escHtml } from "./theme"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type VolumeMode = "bar" | "river"

interface DailyVolumeChartProps {
  trackerData: TrackerSnapshotSeries[]
  height?: number
}

interface DailyDelta {
  day: string // YYYY-MM-DD
  uploadGiB: number
  downloadGiB: number
}

// ---------------------------------------------------------------------------
// Computation
// ---------------------------------------------------------------------------

function computePerTrackerDailyDeltas(snapshots: Snapshot[]): DailyDelta[] {
  if (snapshots.length === 0) return []

  const sorted = [...snapshots].sort(
    (a, b) => new Date(a.polledAt).getTime() - new Date(b.polledAt).getTime()
  )

  const dayMap = new Map<string, Snapshot>()
  for (const snap of sorted) {
    const day = new Date(snap.polledAt).toISOString().slice(0, 10)
    dayMap.set(day, snap)
  }

  const days = Array.from(dayMap.keys()).sort()
  const deltas: DailyDelta[] = []

  for (let i = 1; i < days.length; i++) {
    const prev = dayMap.get(days[i - 1])
    const curr = dayMap.get(days[i])

    if (!prev || !curr) continue

    const uploadDelta = Number(BigInt(curr.uploadedBytes) - BigInt(prev.uploadedBytes))
    const downloadDelta = Number(BigInt(curr.downloadedBytes) - BigInt(prev.downloadedBytes))

    deltas.push({
      day: days[i],
      uploadGiB: Math.max(0, uploadDelta / 1024 ** 3),
      downloadGiB: Math.max(0, downloadDelta / 1024 ** 3),
    })
  }

  return deltas
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function computeTrackerDeltas(trackerData: TrackerSnapshotSeries[]) {
  const trackerDeltas = trackerData.map((t) => ({
    name: t.name,
    color: t.color,
    deltas: computePerTrackerDailyDeltas(t.snapshots),
  }))

  const allDays = new Set<string>()
  for (const t of trackerDeltas) {
    for (const d of t.deltas) allDays.add(d.day)
  }
  const sortedDays = Array.from(allDays).sort()

  let maxVal = 0
  for (const t of trackerDeltas) {
    for (const d of t.deltas) {
      maxVal = Math.max(maxVal, d.uploadGiB, d.downloadGiB)
    }
  }
  const useTiB = maxVal >= 1024
  const divisor = useTiB ? 1024 : 1
  const unit = useTiB ? "TiB" : "GiB"

  return { trackerDeltas, sortedDays, divisor, unit }
}

// ---------------------------------------------------------------------------
// Bar chart builder (existing)
// ---------------------------------------------------------------------------

function buildDailyVolumeOption(
  trackerData: TrackerSnapshotSeries[]
): EChartsOption {
  const { trackerDeltas, sortedDays, divisor, unit } = computeTrackerDeltas(trackerData)

  if (sortedDays.length === 0) return {}

  const labels = sortedDays.map((d) => {
    const date = new Date(`${d}T12:00:00`)
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
  })

  const series: NonNullable<EChartsOption["series"]> = []

  for (const tracker of trackerDeltas) {
    const deltaMap = new Map<string, DailyDelta>()
    for (const d of tracker.deltas) deltaMap.set(d.day, d)

    series.push({
      name: `${tracker.name}`,
      type: "bar",
      stack: "upload",
      data: sortedDays.map((day) => {
        const d = deltaMap.get(day)
        return d ? Number((d.uploadGiB / divisor).toFixed(3)) : 0
      }),
      itemStyle: { color: tracker.color, borderRadius: [2, 2, 0, 0] },
      emphasis: { itemStyle: { shadowBlur: 8, shadowColor: tracker.color } },
    })

    series.push({
      name: `${tracker.name} ↓`,
      type: "bar",
      stack: "download",
      data: sortedDays.map((day) => {
        const d = deltaMap.get(day)
        return d ? -Number((d.downloadGiB / divisor).toFixed(3)) : 0
      }),
      itemStyle: {
        color: tracker.color,
        opacity: 0.5,
        borderRadius: [0, 0, 2, 2],
      },
      emphasis: { itemStyle: { shadowBlur: 8, shadowColor: tracker.color } },
    })
  }

  return {
    backgroundColor: "transparent",
    tooltip: chartTooltip("axis", {
      axisPointer: { type: "shadow" },
      formatter: (params: unknown) => {
        const items = params as Array<{
          seriesName: string
          value: number
          color: string
          axisValueLabel: string
        }>
        if (!items?.length) return ""

        const day = items[0].axisValueLabel

        const trackerMap = new Map<string, { upload: number; download: number; color: string }>()
        for (const item of items) {
          const isDownload = item.seriesName.endsWith(" ↓")
          const trackerName = isDownload ? item.seriesName.slice(0, -2) : item.seriesName
          const existing = trackerMap.get(trackerName) ?? { upload: 0, download: 0, color: item.color }
          if (isDownload) {
            existing.download = Math.abs(item.value)
          } else {
            existing.upload = item.value
          }
          trackerMap.set(trackerName, existing)
        }

        const rows = Array.from(trackerMap.entries())
          .filter(([, v]) => v.upload > 0 || v.download > 0)
          .map(([name, v]) => {
            return `${chartDot(v.color)}<span style="color:${CHART_THEME.textSecondary};">${escHtml(name)}:</span> <span style="color:${CHART_THEME.textPrimary};font-weight:600;">↑ ${fmtNum(v.upload)} ${unit}</span> <span style="color:${CHART_THEME.textTertiary};">/</span> <span style="color:${CHART_THEME.textPrimary};font-weight:600;">↓ ${fmtNum(v.download)} ${unit}</span>`
          })
          .join("<br/>")

        return `${chartTooltipHeader(day)}${rows}`
      },
    }),
    legend: chartLegend({ data: trackerDeltas.map((t) => t.name) }),
    grid: chartGrid({ right: 16, left: 64 }),
    xAxis: {
      type: "category",
      data: labels,
      axisLine: { lineStyle: { color: CHART_THEME.gridLine } },
      axisTick: { show: false },
      axisLabel: chartAxisLabel({
        rotate: sortedDays.length > 14 ? 30 : 0,
        interval: "auto",
      }),
    },
    yAxis: {
      type: "value",
      name: unit,
      nameTextStyle: {
        color: CHART_THEME.textTertiary,
        fontFamily: CHART_THEME.fontMono,
        fontSize: 10,
      },
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: chartAxisLabel({
        formatter: (val: number) => {
          const abs = Math.abs(val)
          const label = abs.toLocaleString(undefined, {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1,
          })
          return val < 0 ? `↓ ${label}` : val > 0 ? `↑ ${label}` : "0"
        },
      }),
      splitLine: {
        lineStyle: { color: CHART_THEME.gridLine, width: 1 },
      },
    },
    series,
  }
}

// ---------------------------------------------------------------------------
// River (ThemeRiver) chart builder
// ---------------------------------------------------------------------------

function buildRiverOption(
  trackerData: TrackerSnapshotSeries[]
): EChartsOption {
  const { trackerDeltas, sortedDays, divisor, unit } = computeTrackerDeltas(trackerData)

  if (sortedDays.length === 0) return {}

  // Build maps once per tracker, outside the day loop
  const trackerDeltaMaps = trackerDeltas.map((tracker) => {
    const m = new Map<string, DailyDelta>()
    for (const d of tracker.deltas) m.set(d.day, d)
    return m
  })

  // Build themeRiver data: [date, value, trackerName]
  // Upload deltas only (river doesn't support diverging)
  const riverData: [string, number, string][] = []

  for (const day of sortedDays) {
    for (let ti = 0; ti < trackerDeltas.length; ti++) {
      const d = trackerDeltaMaps[ti].get(day)
      const val = d ? Number((d.uploadGiB / divisor).toFixed(3)) : 0
      riverData.push([day, val, trackerDeltas[ti].name])
    }
  }

  const colors = trackerDeltas.map((t) => t.color)

  return {
    backgroundColor: "transparent",
    color: colors,
    tooltip: chartTooltip("axis", {
      axisPointer: {
        type: "line",
        lineStyle: { color: CHART_THEME.borderMid, type: "dashed" },
      },
      formatter: (params: unknown) => {
        const items = params as Array<{
          value: [string, number, string]
          color: string
        }>
        if (!items?.length) return ""

        const day = items[0].value[0]
        const dateLabel = new Date(`${day}T12:00:00`).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        })

        const rows = items
          .filter((item) => item.value[1] > 0)
          .sort((a, b) => b.value[1] - a.value[1])
          .map((item) => {
            return `${chartDot(item.color)}<span style="color:${CHART_THEME.textSecondary};">${escHtml(item.value[2])}:</span> <span style="color:${CHART_THEME.textPrimary};font-weight:600;">${fmtNum(item.value[1])} ${unit}</span>`
          })
          .join("<br/>")

        return `${chartTooltipHeader(dateLabel)}${rows}`
      },
    }),
    singleAxis: {
      type: "time",
      bottom: 40,
      top: 32,
      axisLabel: chartAxisLabel(),
      axisLine: { lineStyle: { color: CHART_THEME.gridLine } },
      axisTick: { show: false },
    },
    series: [
      {
        type: "themeRiver",
        data: riverData,
        label: {
          show: true,
          color: CHART_THEME.textSecondary,
          fontFamily: CHART_THEME.fontMono,
          fontSize: 10,
        },
        emphasis: {
          itemStyle: {
            shadowBlur: 20,
            shadowColor: "rgba(0, 0, 0, 0.4)",
          },
        },
      },
    ],
  } as EChartsOption
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function DailyVolumeChart({ trackerData, height = 360 }: DailyVolumeChartProps) {
  const [mode, setMode] = useState<VolumeMode>("bar")
  const hasData = trackerData.some((t) => t.snapshots.length > 1)

  if (!hasData) {
    return (
      <ChartEmptyState
        height={height}
        message="Need at least 2 days of data to show daily volume."
      />
    )
  }

  const option = mode === "river"
    ? buildRiverOption(trackerData)
    : buildDailyVolumeOption(trackerData)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <div className="nm-inset-sm p-1 flex gap-0.5 rounded-nm-sm">
          {(["bar", "river"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={clsx(
                "px-2.5 py-1 text-xs font-mono transition-all duration-150 cursor-pointer rounded-nm-sm",
                mode === m
                  ? "nm-raised-sm text-primary font-semibold"
                  : "text-tertiary hover:text-secondary",
              )}
            >
              {m === "bar" ? "Bar" : "River"}
            </button>
          ))}
        </div>
      </div>
      <ChartECharts
        option={option}
        style={{ height, width: "100%" }}
        opts={{ renderer: "canvas" }}
        notMerge
        lazyUpdate
      />
    </div>
  )
}

export type { DailyVolumeChartProps }
export { computePerTrackerDailyDeltas, DailyVolumeChart }
