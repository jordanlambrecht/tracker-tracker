// src/components/charts/ComparisonChart.tsx
//
// Functions: getValue, buildAverageSeries, buildComparisonOption, ComparisonChart

"use client"

import type { EChartsOption } from "echarts"
import { useState } from "react"
import { Tooltip } from "@/components/ui/Tooltip"
import { bytesToGiB, hexToRgba } from "@/lib/formatters"
import type { Snapshot } from "@/types/api"
import type { TrackerSnapshotSeries } from "@/types/charts"
import { ChartECharts } from "./ChartECharts"
import { ChartEmptyState } from "./ChartEmptyState"
import {
  adaptiveDotSize,
  autoByteScale,
  buildAxisPointer,
  fmtNum,
  yAxisAutoRange,
} from "./chart-helpers"
import { buildUnifiedTimestampAxis } from "./chart-transforms"
import { LogScaleToggle } from "./LogScaleToggle"
import {
  CHART_THEME,
  chartAxisLabel,
  chartDot,
  chartGrid,
  chartLegend,
  chartTooltip,
  chartTooltipHeader,
  escHtml,
  shouldUseLogScale,
} from "./theme"

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

  // Build unified time axis from the union of all polledAt timestamps
  const { timestamps: sortedTimestamps, labels } = buildUnifiedTimestampAxis(trackerData)

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
    ;({ divisor, unit } = autoByteScale(maxGiB))
  }

  const dotSize = adaptiveDotSize(sortedTimestamps.length)

  // Build series — either per-tracker or single average line
  let series: EChartsOption["series"]

  if (useTotalOnly) {
    // Sum all trackers at each timestamp, carry forward per-tracker last-known values
    const trackerLastValues = trackerData.map(() => 0)
    const trackerMaps = trackerData.map((tracker) => {
      const m = new Map<string, Snapshot>()
      for (const snap of tracker.snapshots) m.set(snap.polledAt, snap)
      return m
    })

    const data = sortedTimestamps.map((ts) => {
      for (let i = 0; i < trackerData.length; i++) {
        const snap = trackerMaps[i].get(ts)
        if (snap) {
          const raw = getValue(snap, metric)
          if (raw !== null) trackerLastValues[i] = raw / divisor
        }
      }
      return Number(trackerLastValues.reduce((a, b) => a + b, 0).toFixed(3))
    })

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
    series = buildAverageSeries(trackerData, sortedTimestamps, metric, divisor, dotSize, useLog)
  } else {
    series = trackerData.map((tracker) => {
      const snapByTs = new Map<string, Snapshot>()
      for (const snap of tracker.snapshots) {
        snapByTs.set(snap.polledAt, snap)
      }

      let lastValue: number | null = null
      const data = sortedTimestamps.map((ts) => {
        const snap = snapByTs.get(ts)
        if (!snap) {
          // For stacked mode, carry forward the last known value to avoid spike artifacts
          // For line mode, keep null so connectNulls draws a straight line
          return useStacked ? lastValue : null
        }
        const raw = getValue(snap, metric)
        if (raw === null) return useStacked ? lastValue : null
        const scaled = raw / divisor
        if (useLog && scaled <= 0) return useStacked ? lastValue : null
        lastValue = Number(scaled.toFixed(3))
        return lastValue
      })

      return {
        name: tracker.name,
        type: "line",
        data,
        smooth: true,
        connectNulls: true,
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
          : { lineStyle: { shadowBlur: 16, shadowColor: tracker.color } },
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
      axisPointer: buildAxisPointer(CHART_THEME.borderMid, 0.8, 1),
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
            const display = metric === "ratio" ? `${fmtNum(val)} ×` : `${fmtNum(val)} ${unit}`
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
    legend: useAvg || useTotalOnly ? { show: false } : chartLegend(),
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
    dataZoom: [{ type: "inside", zoomOnMouseWheel: true, moveOnMouseMove: true }],
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
  const [logOverride, setLogOverride] = useState<boolean | null>(null)
  const [averageMode, setAverageMode] = useState(false)
  const [viewMode, setViewMode] = useState<"lines" | "stacked" | "total">("lines")

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
          {viewModes.length > 0 && !averageMode && (
            <div className="nm-inset-sm p-1 flex gap-0.5 rounded-nm-sm">
              {viewModes.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setViewMode(m)}
                  className={`px-2.5 py-1 text-xs font-mono transition-all duration-150 cursor-pointer rounded-nm-sm ${
                    viewMode === m
                      ? "nm-raised-sm text-primary font-semibold"
                      : "text-tertiary hover:text-secondary"
                  }`}
                >
                  {{ lines: "Per-Tracker", stacked: "Stacked", total: "Total" }[m]}
                </button>
              ))}
            </div>
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
        opts={{ renderer: "canvas" }}
        notMerge
        lazyUpdate
      />
    </div>
  )
}

export type { ChartMetric, ComparisonChartProps }
export { buildComparisonOption, ComparisonChart }
