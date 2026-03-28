// src/components/charts/RatioStabilityChart.tsx
//
// Functions: computeEmaWithBand, buildRatioStabilityOption, RatioStabilityChart

"use client"

import type { EChartsOption } from "echarts"
import { formatRatioDisplay, hexToRgba } from "@/lib/formatters"
import type { Snapshot } from "@/types/api"
import type { TrackerSnapshotSeries } from "@/types/charts"
import { ChartECharts } from "./lib/ChartECharts"
import { ChartEmptyState } from "./lib/ChartEmptyState"
import {
  buildAxisPointer,
  buildTimeXAxis,
  fmtNum,
  insideZoom,
  yAxisAutoRange,
} from "./lib/chart-helpers"
import { LogScaleToggle } from "./lib/LogScaleToggle"
import {
  CHART_THEME,
  chartAxisLabel,
  chartDot,
  chartGrid,
  chartLegend,
  chartTooltip,
  chartTooltipHeader,
  escHtml,
  formatChartTimestamp,
} from "./lib/theme"
import { useLogScale } from "./lib/useLogScale"

interface RatioStabilityChartProps {
  trackerData: TrackerSnapshotSeries[]
  height?: number
  emaPeriod?: number
  bandWindow?: number
}

interface EmaWithBandResult {
  ema: [number, number][]
  upper: [number, number][]
  lower: [number, number][]
  stdDevByTs: Map<number, number>
}

function computeEmaWithBand(
  snapshots: Snapshot[],
  emaPeriod: number,
  bandWindow: number
): EmaWithBandResult {
  const filtered = snapshots
    .filter((s) => s.ratio !== null)
    .sort((a, b) => new Date(a.polledAt).getTime() - new Date(b.polledAt).getTime())

  if (filtered.length === 0) {
    return { ema: [], upper: [], lower: [], stdDevByTs: new Map() }
  }

  const ratios = filtered.map((s) => s.ratio as number)
  const tsMs = filtered.map((s) => new Date(s.polledAt).getTime())

  const alpha = 2 / (emaPeriod + 1)
  const emaPoints: [number, number][] = []
  const upperPoints: [number, number][] = []
  const lowerPoints: [number, number][] = []
  const stdDevByTs = new Map<number, number>()

  for (let t = 0; t < ratios.length; t++) {
    const ts = tsMs[t]

    // Compute EMA
    const emaT = t === 0 ? ratios[0] : alpha * ratios[t] + (1 - alpha) * emaPoints[t - 1][1]

    // Compute rolling std dev over last bandWindow raw ratio values
    const windowStart = Math.max(0, t + 1 - bandWindow)
    const window = ratios.slice(windowStart, t + 1)
    const n = window.length
    const mean = window.reduce((sum, v) => sum + v, 0) / n
    const variance = window.reduce((sum, v) => sum + (v - mean) ** 2, 0) / n
    const stdDev = Math.sqrt(variance)

    const upperT = emaT + stdDev
    const lowerT = Math.max(0, emaT - stdDev)

    emaPoints.push([ts, emaT])
    upperPoints.push([ts, upperT])
    lowerPoints.push([ts, lowerT])
    stdDevByTs.set(ts, stdDev)
  }

  return { ema: emaPoints, upper: upperPoints, lower: lowerPoints, stdDevByTs }
}

function buildRatioStabilityOption(
  trackerData: TrackerSnapshotSeries[],
  emaPeriod: number,
  bandWindow: number,
  useLog: boolean
): EChartsOption {
  // Pre-compute EMA + band for each tracker
  const trackerComputations = trackerData.map((tracker) => {
    const result = computeEmaWithBand(tracker.snapshots, emaPeriod, bandWindow)
    return { tracker, ...result }
  })

  // Build legend data (only EMA series)
  const legendData = trackerData.map((t) => t.name)

  // Build ECharts series array: lower base + diff band + EMA line per tracker
  const series: EChartsOption["series"] = []

  for (const { tracker, ema, upper, lower } of trackerComputations) {
    const stackId = `band-${tracker.name}`

    // Band diff data: upper - lower at each timestamp
    const bandDiffData: [number, number][] = lower.map(([ts, lowerVal], i) => {
      const upperVal = upper[i]?.[1] ?? lowerVal
      return [ts, upperVal - lowerVal]
    })

    // Series 1: lower baseline (invisible, establishes the stack floor)
    series.push({
      name: `${tracker.name}-lower`,
      type: "line",
      stack: stackId,
      data: lower,
      symbol: "none",
      smooth: true,
      legendHoverLink: false,
      lineStyle: { opacity: 0 },
      areaStyle: { opacity: 0 },
      tooltip: { show: false },
    })

    // Series 2: band fill (upper - lower), stacked on top of lower
    series.push({
      name: `${tracker.name}-band`,
      type: "line",
      stack: stackId,
      data: bandDiffData,
      symbol: "none",
      smooth: true,
      legendHoverLink: false,
      lineStyle: { opacity: 0 },
      areaStyle: {
        color: hexToRgba(tracker.color, 0.12),
      },
      tooltip: { show: false },
    })

    // Series 3: EMA line (visible, in legend)
    series.push({
      name: tracker.name,
      type: "line",
      data: ema,
      symbol: "none",
      smooth: true,
      lineStyle: {
        color: tracker.color,
        width: 2,
      },
      itemStyle: { color: tracker.color },
      emphasis: {
        focus: "series" as const,
        lineStyle: { shadowBlur: 16, shadowColor: tracker.color },
      },
    })
  }

  return {
    backgroundColor: "transparent",
    grid: chartGrid({ right: 16, left: 64 }),
    legend: chartLegend({ data: legendData }),
    tooltip: chartTooltip("axis", {
      axisPointer: buildAxisPointer(CHART_THEME.borderMid, 0.8, 1),
      formatter: (params: unknown) => {
        const items = params as Array<{
          seriesName: string
          value: [number, number] | null
          color: string
          seriesIndex: number
        }>

        if (!items || items.length === 0) return ""

        // Extract ms timestamp from the first item's value tuple
        const firstValue = items[0]?.value
        if (!firstValue) return ""
        const tsMs = firstValue[0]
        const time = formatChartTimestamp(tsMs)

        // Only show EMA series in tooltip (filter out lower/band series by name suffix)
        const emaItems = items.filter(
          (item) => !item.seriesName.endsWith("-lower") && !item.seriesName.endsWith("-band")
        )

        if (emaItems.length === 0) return ""

        const rows = emaItems
          .filter((item) => item.value !== null && item.value !== undefined)
          .map((item) => {
            const emaVal = (item.value as [number, number])[1]
            // Look up std dev for this tracker + timestamp
            const computation = trackerComputations.find((c) => c.tracker.name === item.seriesName)
            const sigma = computation?.stdDevByTs.get(tsMs) ?? null

            const sigmaStr =
              sigma !== null
                ? ` <span style="color:${CHART_THEME.textTertiary};">[±${sigma.toFixed(2)} σ]</span>`
                : ""

            return (
              chartDot(item.color) +
              `<span style="color:${CHART_THEME.textSecondary};">${escHtml(item.seriesName)}:</span> ` +
              `<span style="color:${CHART_THEME.textPrimary};font-weight:600;">${formatRatioDisplay(emaVal)}</span>` +
              ` <span style="color:${CHART_THEME.textTertiary};">(EMA)</span>` +
              sigmaStr
            )
          })
          .join("<br/>")

        return chartTooltipHeader(time) + rows
      },
    }),
    xAxis: buildTimeXAxis(),
    yAxis: {
      type: useLog ? "log" : "value",
      name: useLog ? "Ratio (log)" : "Ratio",
      scale: true,
      ...(useLog ? {} : yAxisAutoRange()),
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
        lineStyle: {
          color: CHART_THEME.gridLine,
          width: 1,
        },
      },
    },
    dataZoom: insideZoom(Math.max(...trackerComputations.map((c) => c.ema.length), 0)),
    series,
  }
}

function RatioStabilityChart({
  trackerData,
  height = 360,
  emaPeriod = 7,
  bandWindow = 14,
}: RatioStabilityChartProps) {
  const hasEnoughData = trackerData.some(
    (t) => t.snapshots.filter((s) => s.ratio !== null).length >= 3
  )

  const allRatioValues: number[] = []
  for (const tracker of trackerData) {
    for (const snap of tracker.snapshots) {
      if (snap.ratio !== null && snap.ratio > 0) allRatioValues.push(snap.ratio)
    }
  }
  const logScale = useLogScale(allRatioValues)

  if (!hasEnoughData) {
    return <ChartEmptyState height={height} message="Not enough data for stability analysis" />
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-end">
        <LogScaleToggle
          effectiveLog={logScale.effectiveLog}
          isAuto={logScale.isAuto}
          onToggle={logScale.onToggle}
        />
      </div>
      <ChartECharts
        option={buildRatioStabilityOption(
          trackerData,
          emaPeriod,
          bandWindow,
          logScale.effectiveLog
        )}
        style={{ height, width: "100%" }}
      />
    </div>
  )
}

export type { RatioStabilityChartProps }
export { computeEmaWithBand, RatioStabilityChart }
