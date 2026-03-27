// src/components/charts/ComparisonChart.tsx
//
// Functions: getValue, buildAverageSeries, buildComparisonOption, ComparisonChart

"use client"

import type { EChartsOption } from "echarts"
import { useState } from "react"
import { TabBar } from "@/components/ui/TabBar"
import { Tooltip } from "@/components/ui/Tooltip"
import { bytesToGiB, hexToRgba } from "@/lib/formatters"
import type { Snapshot } from "@/types/api"
import type { TrackerSnapshotSeries } from "@/types/charts"
import { ChartECharts } from "./lib/ChartECharts"
import { ChartEmptyState } from "./lib/ChartEmptyState"
import {
  adaptiveDotSize,
  autoByteScale,
  buildAxisPointer,
  buildTimeXAxis,
  fmtNum,
  insideZoom,
  yAxisAutoRange,
} from "./lib/chart-helpers"
import {
  buildTimeSeriesData,
  carryForwardTimeSeries,
  collectUnifiedTimestamps,
} from "./lib/chart-transforms"
import { LogScaleToggle } from "./lib/LogScaleToggle"
import {
  CHART_THEME,
  chartAxisLabel,
  chartGrid,
  chartLegend,
  chartTooltip,
  chartTooltipHeader,
  chartTooltipRow,
  formatChartTimestamp,
} from "./lib/theme"
import { useLogScale } from "./lib/useLogScale"

type ChartMetric = "uploaded" | "downloaded" | "ratio" | "buffer" | "seedbonus" | "active"

interface ComparisonChartProps {
  metric: ChartMetric
  trackerData: TrackerSnapshotSeries[]
  height?: number
  enableLogScale?: boolean
  enableAverage?: boolean
  enableStacked?: boolean
}

function getValue(snapshot: Snapshot, metric: ChartMetric): number | null {
  switch (metric) {
    case "uploaded":
      return bytesToGiB(snapshot.uploadedBytes)
    case "downloaded":
      return bytesToGiB(snapshot.downloadedBytes)
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

/** Compute a single "Avg" series — mean of all tracker values at each unified timestamp. */
function buildAverageSeries(
  trackerData: TrackerSnapshotSeries[],
  allTimestamps: number[],
  metric: ChartMetric,
  divisor: number,
  dotSize: number,
  useLog = false
): EChartsOption["series"] {
  // Index each tracker's snapshots by ms timestamp
  const trackerMaps = trackerData.map((tracker) => {
    const m = new Map<number, Snapshot>()
    for (const snap of tracker.snapshots) {
      m.set(new Date(snap.polledAt).getTime(), snap)
    }
    return m
  })

  const data: [number, number][] = []
  for (const ts of allTimestamps) {
    const values: number[] = []
    for (const snapByTs of trackerMaps) {
      const snap = snapByTs.get(ts)
      if (!snap) continue
      const raw = getValue(snap, metric)
      if (raw !== null) values.push(raw / divisor)
    }
    if (values.length === 0) continue
    const avg = values.reduce((a, b) => a + b, 0) / values.length
    if (useLog && avg <= 0) continue
    data.push([ts, Number(avg.toFixed(3))])
  }

  return [
    {
      name: "Average",
      type: "line",
      data,
      smooth: true,
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
          x: 0,
          y: 0,
          x2: 0,
          y2: 1,
          colorStops: [
            { offset: 0, color: CHART_THEME.accentDim },
            { offset: 1, color: hexToRgba(CHART_THEME.accent, 0) },
          ],
        } as unknown as string,
      },
    },
  ]
}

function buildComparisonOption(
  metric: ChartMetric,
  trackerData: TrackerSnapshotSeries[],
  opts?: { logScale?: boolean; averageMode?: boolean; stacked?: boolean; totalOnly?: boolean }
): EChartsOption {
  const useLog = opts?.logScale ?? false
  const useAvg = opts?.averageMode ?? false
  const useStacked = opts?.stacked ?? false
  const useTotalOnly = opts?.totalOnly ?? false

  // Collect unified ms timestamps from the union of all polledAt values
  const allTimestamps = collectUnifiedTimestamps(trackerData)

  // Determine unit and divisor per metric type
  let unit = "x"
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
    ;({ divisor, unit } = autoByteScale(maxGiB))
  }

  const dotSize = adaptiveDotSize(allTimestamps.length)

  // Build series — either per-tracker or single average line
  let series: EChartsOption["series"]

  if (useTotalOnly) {
    // Carry-forward each tracker onto the unified time axis, then sum at each timestamp
    const perTracker = trackerData.map((tracker) =>
      carryForwardTimeSeries(allTimestamps, tracker.snapshots, (s) => {
        const raw = getValue(s, metric)
        return raw !== null ? raw / divisor : null
      })
    )

    // Build a map of ts → sum across all trackers
    const sumByTs = new Map<number, number>()
    for (const series of perTracker) {
      for (const [ts, val] of series) {
        sumByTs.set(ts, (sumByTs.get(ts) ?? 0) + val)
      }
    }
    const data: [number, number][] = [...sumByTs.entries()]
      .sort(([a], [b]) => a - b)
      .map(([ts, sum]) => [ts, Number(sum.toFixed(3))])

    series = [
      {
        name: "Fleet Total",
        type: "line",
        data,
        smooth: true,
        symbol: "circle",
        symbolSize: dotSize,
        areaStyle: {
          color: {
            type: "linear",
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: CHART_THEME.accentDim },
              { offset: 1, color: hexToRgba(CHART_THEME.accent, 0) },
            ],
          } as unknown as string,
        },
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
      },
    ]
  } else if (useAvg) {
    series = buildAverageSeries(trackerData, allTimestamps, metric, divisor, dotSize, useLog)
  } else {
    series = trackerData.map((tracker) => {
      const fieldFn = (s: Snapshot): number | null => {
        const raw = getValue(s, metric)
        if (raw === null) return null
        const scaled = raw / divisor
        if (useLog && scaled <= 0) return null
        return Number(scaled.toFixed(3))
      }

      // For stacked mode, carry forward the last known value to avoid spike artifacts.
      // For line mode, use sparse [ts, value][] pairs — time axis handles gaps natively.
      let data: [number, number][]
      if (useStacked) {
        data = carryForwardTimeSeries(allTimestamps, tracker.snapshots, fieldFn)
      } else {
        data = buildTimeSeriesData(tracker.snapshots, fieldFn)
      }

      return {
        name: tracker.name,
        type: "line",
        data,
        smooth: true,
        symbol: useStacked ? "none" : "circle",
        symbolSize: dotSize,
        ...(useStacked ? { stack: "total", areaStyle: { opacity: 0.7 }, step: false } : {}),
        itemStyle: { color: tracker.color },
        lineStyle: {
          color: tracker.color,
          width: useStacked ? 1 : 2,
          ...(useStacked ? {} : { shadowColor: tracker.color, shadowBlur: 8 }),
        },
        emphasis: useStacked
          ? { focus: "series" as const }
          : { focus: "series" as const, lineStyle: { shadowBlur: 16, shadowColor: tracker.color } },
      }
    })
  }

  // yAxis config — shared base with log/linear specifics
  const yAxis: EChartsOption["yAxis"] = {
    type: useLog ? "log" : "value",
    name: unit,
    ...(useLog ? { logBase: 10 } : { scale: true, ...yAxisAutoRange() }),
    nameTextStyle: {
      color: CHART_THEME.textTertiary,
      fontFamily: CHART_THEME.fontMono,
      fontSize: CHART_THEME.fontSizeCompact,
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
      axisPointer: buildAxisPointer(CHART_THEME.borderMid, 0.8, 1),
      formatter: (params: unknown) => {
        const items = params as Array<{
          seriesName: string
          value: [number, number]
          color: string
        }>
        if (!items || items.length === 0) return ""
        const time = formatChartTimestamp(items[0].value[0])
        const rows = items
          .filter((item) => item.value != null && item.value[1] != null)
          .map((item) => {
            const val = item.value[1]
            const display = metric === "ratio" ? `${fmtNum(val)} x` : `${fmtNum(val)} ${unit}`
            return chartTooltipRow(item.color, item.seriesName, display)
          })
          .join("<br/>")
        return chartTooltipHeader(time) + rows
      },
    }),
    legend: useAvg || useTotalOnly ? { show: false } : chartLegend(),
    xAxis: buildTimeXAxis(),
    yAxis,
    dataZoom: insideZoom(Math.max(...trackerData.map((t) => t.snapshots.length), 0)),
    series,
  }
}

function ComparisonChart({
  metric,
  trackerData,
  height = 500,
  enableLogScale = false,
  enableAverage = false,
  enableStacked = false,
}: ComparisonChartProps) {
  const [averageMode, setAverageMode] = useState(false)
  const [viewMode, setViewMode] = useState<"lines" | "stacked" | "total">("lines")

  const hasData = trackerData.some((t) => t.snapshots.length > 0)

  // Collect values for log scale detection
  const allValues: number[] = []
  if (enableLogScale) {
    for (const tracker of trackerData) {
      for (const snap of tracker.snapshots) {
        const v = getValue(snap, metric)
        if (v !== null) allValues.push(v)
      }
    }
  }
  const logScale = useLogScale(enableLogScale ? allValues : [])
  const effectiveLog = enableLogScale ? logScale.effectiveLog : false

  const isStacked = viewMode === "stacked"
  const isTotalOnly = viewMode === "total"
  const isNonLineMode = isStacked || isTotalOnly
  const showToolbar = enableLogScale || enableAverage || enableStacked

  if (!hasData) {
    return (
      <ChartEmptyState height={height} message="No snapshot data yet. Waiting for first polls..." />
    )
  }

  const viewModes = enableStacked ? (["lines", "stacked", "total"] as const) : ([] as const)

  return (
    <div className="flex flex-col gap-2">
      {showToolbar && (
        <div className="flex justify-end gap-2">
          {enableAverage && !isNonLineMode && (
            <Tooltip
              content={
                averageMode
                  ? "Showing fleet average. Click for per-tracker."
                  : "Showing per-tracker. Click for fleet average."
              }
            >
              <button
                type="button"
                onClick={() => setAverageMode((v) => !v)}
                className="timestamp nm-raised-sm bg-raised px-2.5 py-1 hover:text-secondary active:nm-inset-sm active:scale-[0.97] transition-all duration-150 cursor-pointer flex items-center gap-1.5 rounded-nm-sm"
              >
                {averageMode ? "Avg" : "Per-Tracker"}
              </button>
            </Tooltip>
          )}
          {enableLogScale && (
            <LogScaleToggle
              effectiveLog={logScale.effectiveLog}
              isAuto={logScale.isAuto}
              onToggle={logScale.onToggle}
            />
          )}
          {viewModes.length > 0 && !averageMode && (
            <TabBar
              compact
              tabs={viewModes.map((m) => ({
                key: m,
                label: { lines: "Per-Tracker", stacked: "Stacked", total: "Total" }[m],
              }))}
              activeTab={viewMode}
              onChange={setViewMode}
            />
          )}
        </div>
      )}
      <ChartECharts
        option={buildComparisonOption(metric, trackerData, {
          logScale: enableLogScale ? effectiveLog : undefined,
          averageMode: averageMode && !isNonLineMode,
          stacked: isStacked,
          totalOnly: isTotalOnly,
        })}
        style={{ height, width: "100%" }}
      />
    </div>
  )
}

export type { ChartMetric, ComparisonChartProps }
export { buildComparisonOption, ComparisonChart }
