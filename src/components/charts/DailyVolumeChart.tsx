// src/components/charts/DailyVolumeChart.tsx
//
// Functions: computeTrackerDeltas, buildDailyVolumeOption, buildRiverOption, buildAreaOption, buildSumsOption, DailyVolumeChart

"use client"

import type { EChartsOption } from "echarts"
import { useState } from "react"
import { TabBar } from "@/components/ui/TabBar"
import { hexToRgba } from "@/lib/formatters"
import type { TrackerSnapshotSeries } from "@/types/charts"
import { ChartECharts } from "./lib/ChartECharts"
import { ChartEmptyState } from "./lib/ChartEmptyState"
import {
  autoByteScale,
  buildAxisPointer,
  buildThemeRiverSingleAxis,
  buildTimeXAxis,
  fmtNum,
  formatDateLabel,
  insideZoom,
} from "./lib/chart-helpers"
import { computeDailyDeltas } from "./lib/chart-transforms"
import {
  CHART_THEME,
  chartAxisLabel,
  chartDot,
  chartGrid,
  chartLegend,
  chartTooltip,
  chartTooltipHeader,
  chartTooltipRow,
  escHtml,
  formatChartTimestamp,
} from "./lib/theme"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type VolumeMode = "bar" | "river" | "area" | "sums"

interface DailyVolumeChartProps {
  trackerData: TrackerSnapshotSeries[]
  height?: number
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function computeTrackerDeltas(trackerData: TrackerSnapshotSeries[]) {
  const trackerDeltas = trackerData.map((t) => ({
    name: t.name,
    color: t.color,
    deltas: computeDailyDeltas(t.snapshots),
  }))

  const allDays = new Set<string>()
  for (const t of trackerDeltas) {
    for (const d of t.deltas) allDays.add(d.label)
  }
  const sortedDays = Array.from(allDays).sort()
  const dayTimestamps = sortedDays.map((day) => new Date(`${day}T12:00:00`).getTime())

  let maxVal = 0
  for (const t of trackerDeltas) {
    for (const d of t.deltas) {
      // Use abs so negative deltas (tracker corrections) still inform the scale
      maxVal = Math.max(maxVal, Math.abs(d.uploadDelta), Math.abs(d.downloadDelta))
    }
  }
  const { divisor, unit } = autoByteScale(maxVal)

  return { trackerDeltas, sortedDays, dayTimestamps, divisor, unit }
}

// ---------------------------------------------------------------------------
// Bar chart builder (existing)
// ---------------------------------------------------------------------------

function buildDailyVolumeOption(trackerData: TrackerSnapshotSeries[]): EChartsOption {
  const { trackerDeltas, sortedDays, dayTimestamps, divisor, unit } =
    computeTrackerDeltas(trackerData)

  if (sortedDays.length === 0) return {}

  const series: NonNullable<EChartsOption["series"]> = []

  for (const tracker of trackerDeltas) {
    const deltaMap = new Map<string, { uploadDelta: number; downloadDelta: number }>()
    for (const d of tracker.deltas) deltaMap.set(d.label, d)

    series.push({
      name: tracker.name,
      type: "bar",
      stack: "upload",
      barWidth: 12,
      data: sortedDays.map((day, i) => {
        const d = deltaMap.get(day)
        // Clamp for stacked bar display — raw data may have negatives from tracker corrections
        const val = d ? Number((Math.max(0, d.uploadDelta) / divisor).toFixed(3)) : 0
        return [dayTimestamps[i], val] as [number, number]
      }),
      itemStyle: { color: tracker.color, borderRadius: [2, 2, 0, 0] },
      emphasis: { itemStyle: { shadowBlur: 8, shadowColor: tracker.color } },
    })

    series.push({
      name: `${tracker.name} ↓`,
      type: "bar",
      stack: "download",
      barWidth: 12,
      data: sortedDays.map((day, i) => {
        const d = deltaMap.get(day)
        // Clamp for stacked bar display — raw data may have negatives from tracker corrections
        const val = d ? -Number((Math.max(0, d.downloadDelta) / divisor).toFixed(3)) : 0
        return [dayTimestamps[i], val] as [number, number]
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
          value: [number, number]
          color: string
        }>
        if (!items?.length) return ""

        const day = formatChartTimestamp(items[0].value[0])

        const trackerMap = new Map<string, { upload: number; download: number; color: string }>()
        for (const item of items) {
          const isDownload = item.seriesName.endsWith(" ↓")
          const trackerName = isDownload ? item.seriesName.slice(0, -2) : item.seriesName
          const existing = trackerMap.get(trackerName) ?? {
            upload: 0,
            download: 0,
            color: item.color,
          }
          if (isDownload) {
            existing.download = Math.abs(item.value[1])
          } else {
            existing.upload = item.value[1]
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
    xAxis: buildTimeXAxis({ boundaryGap: ["5%", "5%"] }),
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

function buildRiverOption(trackerData: TrackerSnapshotSeries[]): EChartsOption {
  const { trackerDeltas, sortedDays, divisor, unit } = computeTrackerDeltas(trackerData)

  if (sortedDays.length === 0) return {}

  // Build maps once per tracker, outside the day loop
  const trackerDeltaMaps = trackerDeltas.map((tracker) => {
    const m = new Map<string, { uploadDelta: number; downloadDelta: number }>()
    for (const d of tracker.deltas) m.set(d.label, d)
    return m
  })

  // Build themeRiver data: [date, value, trackerName]
  // Upload deltas only (river doesn't support diverging)
  const riverData: [string, number, string][] = []

  for (const day of sortedDays) {
    for (let ti = 0; ti < trackerDeltas.length; ti++) {
      const d = trackerDeltaMaps[ti].get(day)
      // Clamp for stacked bar display — raw data may have negatives from tracker corrections
      const val = d ? Number((Math.max(0, d.uploadDelta) / divisor).toFixed(3)) : 0
      riverData.push([day, val, trackerDeltas[ti].name])
    }
  }

  const colors = trackerDeltas.map((t) => t.color)

  return {
    backgroundColor: "transparent",
    color: colors,
    tooltip: chartTooltip("axis", {
      axisPointer: buildAxisPointer(),
      formatter: (params: unknown) => {
        const items = params as Array<{
          value: [string, number, string]
          color: string
        }>
        if (!items?.length) return ""

        const day = items[0].value[0]
        const dateLabel = formatDateLabel(day)

        const rows = items
          .filter((item) => item.value[1] > 0)
          .sort((a, b) => b.value[1] - a.value[1])
          .map((item) =>
            chartTooltipRow(item.color, item.value[2], `${fmtNum(item.value[1])} ${unit}`)
          )
          .join("<br/>")

        return `${chartTooltipHeader(dateLabel)}${rows}`
      },
    }),
    singleAxis: buildThemeRiverSingleAxis({ top: 32 }),
    graphic: [
      {
        type: "line",
        left: 0,
        right: 0,
        top: "50%",
        shape: { x1: 0, y1: 0, x2: 2000, y2: 0 },
        style: {
          stroke: CHART_THEME.textTertiary,
          lineWidth: 1,
          lineDash: [4, 4],
          opacity: 0.4,
        },
        silent: true,
        z: 10,
      },
    ],
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
// Stacked area chart builder
// ---------------------------------------------------------------------------

function buildAreaOption(trackerData: TrackerSnapshotSeries[]): EChartsOption {
  const { trackerDeltas, sortedDays, dayTimestamps, divisor, unit } =
    computeTrackerDeltas(trackerData)

  if (sortedDays.length === 0) return {}

  const series: NonNullable<EChartsOption["series"]> = trackerDeltas.map((tracker) => {
    const deltaMap = new Map<string, { uploadDelta: number }>()
    for (const d of tracker.deltas) deltaMap.set(d.label, d)

    return {
      name: tracker.name,
      type: "line",
      stack: "upload",
      areaStyle: { opacity: 0.6 },
      smooth: true,
      symbol: "none",
      lineStyle: { width: 1, color: tracker.color },
      itemStyle: { color: tracker.color },
      data: sortedDays.map((day, i) => {
        const d = deltaMap.get(day)
        const val = d ? Number((Math.max(0, d.uploadDelta) / divisor).toFixed(3)) : 0
        return [dayTimestamps[i], val] as [number, number]
      }),
      emphasis: {
        focus: "series" as const,
      },
    }
  })

  return {
    backgroundColor: "transparent",
    tooltip: chartTooltip("axis", {
      axisPointer: buildAxisPointer(),
      formatter: (params: unknown) => {
        const items = params as Array<{
          seriesName: string
          value: [number, number]
          color: string
        }>
        if (!items?.length) return ""

        const day = formatChartTimestamp(items[0].value[0])
        const rows = items
          .filter((item) => item.value[1] > 0)
          .sort((a, b) => b.value[1] - a.value[1])
          .map((item) =>
            chartTooltipRow(item.color, item.seriesName, `${fmtNum(item.value[1])} ${unit}`)
          )
          .join("<br/>")

        return `${chartTooltipHeader(day)}${rows}`
      },
    }),
    legend: chartLegend({ data: trackerDeltas.map((t) => t.name) }),
    grid: chartGrid({ right: 16, left: 64 }),
    xAxis: buildTimeXAxis(),
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
        formatter: (val: number) => fmtNum(val, 1),
      }),
      splitLine: {
        lineStyle: { color: CHART_THEME.gridLine, width: 1 },
      },
    },
    dataZoom: insideZoom(sortedDays.length),
    series,
  }
}

// ---------------------------------------------------------------------------
// Sums line chart builder (total upload + total download as two lines)
// ---------------------------------------------------------------------------

function buildSumsOption(trackerData: TrackerSnapshotSeries[]): EChartsOption {
  const { trackerDeltas, sortedDays, dayTimestamps, divisor, unit } =
    computeTrackerDeltas(trackerData)

  if (sortedDays.length === 0) return {}

  // Pre-build maps once per tracker to avoid O(n*m*k) find() calls
  const trackerMaps = trackerDeltas.map((tracker) => {
    const m = new Map<string, { uploadDelta: number; downloadDelta: number }>()
    for (const d of tracker.deltas) m.set(d.label, d)
    return m
  })

  const uploadSums: [number, number][] = sortedDays.map((day, i) => {
    let total = 0
    for (const m of trackerMaps) {
      const d = m.get(day)
      if (d) total += Math.max(0, d.uploadDelta)
    }
    return [dayTimestamps[i], Number((total / divisor).toFixed(3))]
  })

  const downloadSums: [number, number][] = sortedDays.map((day, i) => {
    let total = 0
    for (const m of trackerMaps) {
      const d = m.get(day)
      if (d) total += Math.max(0, d.downloadDelta)
    }
    return [dayTimestamps[i], Number((total / divisor).toFixed(3))]
  })

  return {
    backgroundColor: "transparent",
    tooltip: chartTooltip("axis", {
      axisPointer: buildAxisPointer(),
      formatter: (params: unknown) => {
        const items = params as Array<{
          seriesName: string
          value: [number, number]
          color: string
        }>
        if (!items?.length) return ""
        const day = formatChartTimestamp(items[0].value[0])
        const rows = items
          .map((item) =>
            chartTooltipRow(item.color, item.seriesName, `${fmtNum(item.value[1])} ${unit}`)
          )
          .join("<br/>")
        return `${chartTooltipHeader(day)}${rows}`
      },
    }),
    legend: chartLegend({ data: ["Upload", "Download"] }),
    grid: chartGrid({ right: 16, left: 64 }),
    xAxis: buildTimeXAxis(),
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
        formatter: (val: number) => fmtNum(val, 1),
      }),
      splitLine: {
        lineStyle: { color: CHART_THEME.gridLine, width: 1 },
      },
    },
    dataZoom: insideZoom(sortedDays.length),
    series: [
      {
        name: "Upload",
        type: "line",
        data: uploadSums,
        smooth: true,
        symbol: "circle",
        symbolSize: 6,
        itemStyle: { color: CHART_THEME.upload },
        lineStyle: {
          color: CHART_THEME.upload,
          width: 3,
          shadowColor: CHART_THEME.upload,
          shadowBlur: 12,
        },
        areaStyle: {
          color: {
            type: "linear",
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: hexToRgba(CHART_THEME.upload, 0.25) },
              { offset: 1, color: hexToRgba(CHART_THEME.upload, 0) },
            ],
          } as unknown as string,
        },
        emphasis: { focus: "series" as const },
      },
      {
        name: "Download",
        type: "line",
        data: downloadSums,
        smooth: true,
        symbol: "circle",
        symbolSize: 6,
        itemStyle: { color: CHART_THEME.download },
        lineStyle: {
          color: CHART_THEME.download,
          width: 3,
          shadowColor: CHART_THEME.download,
          shadowBlur: 12,
        },
        areaStyle: {
          color: {
            type: "linear",
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: hexToRgba(CHART_THEME.download, 0.25) },
              { offset: 1, color: hexToRgba(CHART_THEME.download, 0) },
            ],
          } as unknown as string,
        },
        emphasis: { focus: "series" as const },
      },
    ],
  }
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

  const option =
    mode === "river"
      ? buildRiverOption(trackerData)
      : mode === "area"
        ? buildAreaOption(trackerData)
        : mode === "sums"
          ? buildSumsOption(trackerData)
          : buildDailyVolumeOption(trackerData)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <TabBar
          compact
          tabs={[
            { key: "bar" as const, label: "Bar" },
            { key: "area" as const, label: "Area" },
            { key: "sums" as const, label: "Totals" },
            { key: "river" as const, label: "River" },
          ]}
          activeTab={mode}
          onChange={setMode}
        />
      </div>
      <ChartECharts key={mode} option={option} style={{ height, width: "100%" }} />
    </div>
  )
}

export type { DailyVolumeChartProps }
export { DailyVolumeChart }
