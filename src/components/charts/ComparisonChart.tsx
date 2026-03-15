// src/components/charts/ComparisonChart.tsx
//
// Functions: getValue, buildAverageSeries, buildComparisonOption, ComparisonChart

"use client"

import type { EChartsOption } from "echarts"
import { useState } from "react"
import { Tooltip } from "@/components/ui/Tooltip"
import { bytesToGiB } from "@/lib/formatters"
import type { Snapshot } from "@/types/api"
import type { TrackerSnapshotSeries } from "@/types/charts"
import { ChartECharts } from "./ChartECharts"
import { fmtNum, yAxisPad } from "./chart-helpers"
import { LogScaleToggle } from "./LogScaleToggle"
import { CHART_THEME, chartAxisLabel, chartDot, chartGrid, chartLegend, chartTooltip, chartTooltipHeader, escHtml, shouldUseLogScale } from "./theme"

type ChartMetric = "uploaded" | "ratio" | "buffer" | "seedbonus" | "active"

interface ComparisonChartProps {
  metric: ChartMetric
  trackerData: TrackerSnapshotSeries[]
  height?: number
  enableLogScale?: boolean
  enableAverage?: boolean
}

function getValue(snapshot: Snapshot, metric: ChartMetric): number | null {
  switch (metric) {
    case "uploaded":
      return bytesToGiB(snapshot.uploadedBytes)
    case "ratio":
      return snapshot.ratio
    case "buffer":
      return bytesToGiB(snapshot.bufferBytes)
    case "seedbonus":
      return snapshot.seedbonus
    case "active":
      return snapshot.seedingCount
  }
}

/** Compute a single "Avg" series — mean of all tracker ratios at each timestamp. */
function buildAverageSeries(
  trackerData: TrackerSnapshotSeries[],
  sortedTimestamps: string[],
  metric: ChartMetric,
  divisor: number,
  dotSize: number,
  useLog = false
): EChartsOption["series"] {
  // Index each tracker's snapshots by timestamp
  const trackerMaps = trackerData.map((tracker) => {
    const m = new Map<string, Snapshot>()
    for (const snap of tracker.snapshots) {
      m.set(snap.polledAt, snap)
    }
    return m
  })

  const data = sortedTimestamps.map((ts) => {
    const values: number[] = []
    for (const snapByTs of trackerMaps) {
      const snap = snapByTs.get(ts)
      if (!snap) continue
      const raw = getValue(snap, metric)
      if (raw !== null) values.push(raw / divisor)
    }
    if (values.length === 0) return null
    const avg = values.reduce((a, b) => a + b, 0) / values.length
    if (useLog && avg <= 0) return null
    return Number(avg.toFixed(3))
  })

  return [
    {
      name: "Average",
      type: "line",
      data,
      smooth: true,
      connectNulls: true,
      symbol: "circle",
      symbolSize: dotSize,
      itemStyle: { color: CHART_THEME.accent },
      lineStyle: {
        color: CHART_THEME.accent,
        width: 3,
        shadowColor: CHART_THEME.accent,
        shadowBlur: 12,
      },
      emphasis: {
        lineStyle: { shadowBlur: 20, shadowColor: CHART_THEME.accent },
      },
      areaStyle: {
        color: {
          type: "linear",
          x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: CHART_THEME.accentDim },
            { offset: 1, color: "rgba(0, 212, 255, 0)" },
          ],
        } as unknown as string,
      },
    },
  ]
}

function buildComparisonOption(
  metric: ChartMetric,
  trackerData: TrackerSnapshotSeries[],
  opts?: { logScale?: boolean; averageMode?: boolean }
): EChartsOption {
  const useLog = opts?.logScale ?? false
  const useAvg = opts?.averageMode ?? false

  // Build unified time axis from the union of all polledAt timestamps
  const allTimestamps = new Set<string>()
  for (const tracker of trackerData) {
    for (const snap of tracker.snapshots) {
      allTimestamps.add(snap.polledAt)
    }
  }
  const sortedTimestamps = Array.from(allTimestamps).sort(
    (a, b) => new Date(a).getTime() - new Date(b).getTime()
  )

  const labels = sortedTimestamps.map((ts) =>
    new Date(ts).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
  )

  // Determine unit and divisor per metric type
  let unit = "×"
  let divisor = 1
  if (metric === "seedbonus") {
    unit = "pts"
  } else if (metric === "active") {
    unit = "torrents"
  } else if (metric !== "ratio") {
    const allGiB: number[] = []
    for (const tracker of trackerData) {
      for (const snap of tracker.snapshots) {
        const v = getValue(snap, metric)
        if (v !== null) allGiB.push(v)
      }
    }
    const maxGiB = Math.max(...allGiB, 0)
    const useTiB = maxGiB >= 1024
    divisor = useTiB ? 1024 : 1
    unit = useTiB ? "TiB" : "GiB"
  }

  // Total data points across all trackers — drives adaptive dot size
  const totalPoints = trackerData.reduce((sum, t) => sum + t.snapshots.length, 0)
  const dotSize = totalPoints > 100 ? 2 : totalPoints > 30 ? 4 : 6

  // Build series — either per-tracker or single average line
  let series: EChartsOption["series"]

  if (useAvg) {
    series = buildAverageSeries(trackerData, sortedTimestamps, metric, divisor, dotSize, useLog)
  } else {
    series = trackerData.map((tracker) => {
      const snapByTs = new Map<string, Snapshot>()
      for (const snap of tracker.snapshots) {
        snapByTs.set(snap.polledAt, snap)
      }

      const data = sortedTimestamps.map((ts) => {
        const snap = snapByTs.get(ts)
        if (!snap) return null
        const raw = getValue(snap, metric)
        if (raw === null) return null
        const scaled = raw / divisor
        if (useLog && scaled <= 0) return null
        return Number(scaled.toFixed(3))
      })

      return {
        name: tracker.name,
        type: "line",
        data,
        smooth: true,
        connectNulls: true,
        symbol: "circle",
        symbolSize: dotSize,
        itemStyle: { color: tracker.color },
        lineStyle: {
          color: tracker.color,
          width: 2,
          shadowColor: tracker.color,
          shadowBlur: 8,
        },
        emphasis: {
          lineStyle: {
            shadowBlur: 16,
            shadowColor: tracker.color,
          },
        },
      }
    })
  }

  // yAxis config — log vs linear
  const yAxis: EChartsOption["yAxis"] = useLog
    ? {
        type: "log",
        name: unit,
        logBase: 10,
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
      }
    : {
        type: "value",
        name: unit,
        scale: true,
        min: ((value: { min: number; max: number }) =>
          Math.max(0, Math.floor((value.min - yAxisPad(value)) * 100) / 100)) as unknown as number,
        max: ((value: { min: number; max: number }) =>
          Math.ceil((value.max + yAxisPad(value)) * 100) / 100) as unknown as number,
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
      }

  return {
    backgroundColor: "transparent",
    grid: chartGrid({ right: 16, left: 64 }),
    tooltip: chartTooltip("axis", {
      axisPointer: {
        type: "line",
        lineStyle: {
          color: CHART_THEME.borderMid,
          opacity: 0.8,
          width: 1,
          type: "dashed",
        },
      },
      formatter: (params: unknown) => {
        const items = params as Array<{
          seriesName: string
          value: number | null
          color: string
          axisValueLabel: string
        }>
        if (!items || items.length === 0) return ""
        const time = items[0].axisValueLabel
        const rows = items
          .filter((item) => item.value !== null && item.value !== undefined)
          .map((item) => {
            const val = item.value as number
            const display =
              metric === "ratio"
                ? `${fmtNum(val)} ×`
                : `${fmtNum(val)} ${unit}`
            return (
              chartDot(item.color) +
              `<span style="color:${CHART_THEME.textSecondary};">${escHtml(item.seriesName)}:</span> ` +
              `<span style="color:${CHART_THEME.textPrimary};font-weight:600;">${display}</span>`
            )
          })
          .join("<br/>")
        return chartTooltipHeader(time) + rows
      },
    }),
    legend: useAvg ? { show: false } : chartLegend(),
    xAxis: {
      type: "category",
      data: labels,
      boundaryGap: false,
      axisLine: { lineStyle: { color: CHART_THEME.gridLine } },
      axisTick: { show: false },
      axisLabel: chartAxisLabel({ rotate: 30, interval: "auto" }),
      splitLine: { show: false },
    },
    yAxis,
    dataZoom: [
      { type: "inside", zoomOnMouseWheel: true, moveOnMouseMove: true },
    ],
    series,
  }
}

function ComparisonChart({
  metric,
  trackerData,
  height = 500,
  enableLogScale = false,
  enableAverage = false,
}: ComparisonChartProps) {
  const [logOverride, setLogOverride] = useState<boolean | null>(null)
  const [averageMode, setAverageMode] = useState(false)

  const hasData = trackerData.some((t) => t.snapshots.length > 0)

  // Auto-detect log scale from data spread
  const allValues: number[] = []
  if (enableLogScale) {
    for (const tracker of trackerData) {
      for (const snap of tracker.snapshots) {
        const v = getValue(snap, metric)
        if (v !== null) allValues.push(v)
      }
    }
  }
  const autoLog = enableLogScale ? shouldUseLogScale(allValues) : false
  const effectiveLog = logOverride ?? autoLog

  const showToolbar = enableLogScale || enableAverage

  if (!hasData) {
    return (
      <div
        className="flex items-center justify-center text-tertiary font-mono text-sm"
        style={{ height }}
      >
        No snapshot data yet. Waiting for first polls...
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {showToolbar && (
        <div className="flex justify-end gap-2">
          {enableAverage && (
            <Tooltip content={averageMode ? "Showing fleet average. Click for per-tracker." : "Showing per-tracker. Click for fleet average."}>
              <button
                type="button"
                onClick={() => setAverageMode((v) => !v)}
                className="nm-raised-sm bg-raised px-2.5 py-1 text-[10px] font-mono text-muted hover:text-secondary active:nm-inset-sm active:scale-[0.97] transition-all duration-150 cursor-pointer flex items-center gap-1.5 rounded-nm-sm"
              >
                {averageMode ? "Avg" : "Per-Tracker"}
              </button>
            </Tooltip>
          )}
          {enableLogScale && (
            <LogScaleToggle
              effectiveLog={effectiveLog}
              isAuto={logOverride === null}
              onToggle={() => setLogOverride(logOverride === null ? !autoLog : null)}
            />
          )}
        </div>
      )}
      <ChartECharts
        option={buildComparisonOption(metric, trackerData, {
          logScale: enableLogScale ? effectiveLog : undefined,
          averageMode,
        })}
        style={{ height, width: "100%" }}
        opts={{ renderer: "canvas" }}
        notMerge
        lazyUpdate
      />
    </div>
  )
}

export type { ChartMetric, ComparisonChartProps }
export { buildComparisonOption, ComparisonChart }
