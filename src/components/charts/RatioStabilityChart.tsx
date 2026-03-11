// src/components/charts/RatioStabilityChart.tsx
//
// Functions: computeEmaWithBand, buildRatioStabilityOption, RatioStabilityChart

"use client"

import type { EChartsOption } from "echarts"
import ReactECharts from "echarts-for-react"
import { hexToRgba } from "@/lib/formatters"
import type { Snapshot } from "@/types/api"
import { ChartEmptyState } from "./ChartEmptyState"
import { CHART_THEME, chartAxisLabel, chartGrid, chartTooltip } from "./theme"

interface TrackerRatioSeries {
  name: string
  color: string
  snapshots: Snapshot[]
}

interface RatioStabilityChartProps {
  trackerData: TrackerRatioSeries[]
  height?: number
  emaPeriod?: number
  bandWindow?: number
}

interface EmaWithBandResult {
  timestamps: string[]
  ema: (number | null)[]
  upper: (number | null)[]
  lower: (number | null)[]
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
    return { timestamps: [], ema: [], upper: [], lower: [] }
  }

  const ratios = filtered.map((s) => s.ratio as number)
  const timestamps = filtered.map((s) => s.polledAt)

  const alpha = 2 / (emaPeriod + 1)
  const emaValues: number[] = []
  const upperValues: (number | null)[] = []
  const lowerValues: (number | null)[] = []

  for (let t = 0; t < ratios.length; t++) {
    // Compute EMA
    const emaT = t === 0 ? ratios[0] : alpha * ratios[t] + (1 - alpha) * emaValues[t - 1]
    emaValues.push(emaT)

    // Compute rolling std dev over last bandWindow raw ratio values
    const windowStart = Math.max(0, t + 1 - bandWindow)
    const window = ratios.slice(windowStart, t + 1)
    const n = window.length
    const mean = window.reduce((sum, v) => sum + v, 0) / n
    const variance = window.reduce((sum, v) => sum + (v - mean) ** 2, 0) / n
    const stdDev = Math.sqrt(variance)

    upperValues.push(emaT + stdDev)
    lowerValues.push(Math.max(0, emaT - stdDev))
  }

  return {
    timestamps,
    ema: emaValues,
    upper: upperValues,
    lower: lowerValues,
  }
}

function buildRatioStabilityOption(
  trackerData: TrackerRatioSeries[],
  emaPeriod: number,
  bandWindow: number
): EChartsOption {
  // Build unified time axis from union of all polledAt timestamps
  const allTimestamps = new Set<string>()
  for (const tracker of trackerData) {
    for (const snap of tracker.snapshots) {
      if (snap.ratio !== null) {
        allTimestamps.add(snap.polledAt)
      }
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

  const yAxisPad = (value: { min: number; max: number }) => {
    const range = value.max - value.min
    return Math.max(range * 0.15, (value.max || 1) * 0.001)
  }

  // Pre-compute EMA + band for each tracker, keyed by timestamp
  const trackerComputations = trackerData.map((tracker) => {
    const result = computeEmaWithBand(tracker.snapshots, emaPeriod, bandWindow)

    // Map results back to timestamp keys
    const emaByTs = new Map<string, number | null>()
    const upperByTs = new Map<string, number | null>()
    const lowerByTs = new Map<string, number | null>()
    const stdDevByTs = new Map<string, number>()

    for (let i = 0; i < result.timestamps.length; i++) {
      const ts = result.timestamps[i]
      emaByTs.set(ts, result.ema[i])
      upperByTs.set(ts, result.upper[i])
      lowerByTs.set(ts, result.lower[i])

      const emaVal = result.ema[i]
      const upperVal = result.upper[i]
      if (emaVal !== null && upperVal !== null) {
        stdDevByTs.set(ts, upperVal - emaVal)
      }
    }

    return { tracker, emaByTs, upperByTs, lowerByTs, stdDevByTs }
  })

  // Build legend data (only EMA series)
  const legendData = trackerData.map((t) => t.name)

  // Build ECharts series array: lower base + diff band + EMA line per tracker
  const series: EChartsOption["series"] = []

  for (const { tracker, emaByTs, upperByTs, lowerByTs } of trackerComputations) {
    const stackId = `band-${tracker.name}`

    const emaData = sortedTimestamps.map((ts) => emaByTs.get(ts) ?? null)
    const lowerData = sortedTimestamps.map((ts) => lowerByTs.get(ts) ?? null)
    const upperData = sortedTimestamps.map((ts) => {
      const u = upperByTs.get(ts)
      const l = lowerByTs.get(ts)
      if (u === null || u === undefined || l === null || l === undefined) return null
      return u - l
    })

    // Series 1: lower baseline (invisible, just establishes the stack floor)
    series.push({
      name: `${tracker.name}-lower`,
      type: "line",
      stack: stackId,
      data: lowerData,
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
      data: upperData,
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
      data: emaData,
      symbol: "none",
      smooth: true,
      connectNulls: true,
      lineStyle: {
        color: tracker.color,
        width: 2,
      },
      itemStyle: { color: tracker.color },
    })
  }

  return {
    backgroundColor: "transparent",
    grid: chartGrid({ top: 32, right: 16, left: 64 }),
    legend: {
      top: 0,
      right: 0,
      data: legendData,
      textStyle: {
        color: CHART_THEME.textTertiary,
        fontFamily: CHART_THEME.fontMono,
        fontSize: 11,
      },
      icon: "circle",
      itemWidth: 8,
      itemHeight: 8,
    },
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
          seriesIndex: number
        }>

        if (!items || items.length === 0) return ""

        const time = items[0].axisValueLabel

        // Only show EMA series in tooltip (filter out lower/band series by name suffix)
        const emaItems = items.filter(
          (item) =>
            !item.seriesName.endsWith("-lower") && !item.seriesName.endsWith("-band")
        )

        if (emaItems.length === 0) return ""

        const ts = sortedTimestamps[
          labels.indexOf(time) >= 0 ? labels.indexOf(time) : 0
        ]

        const rows = emaItems
          .filter((item) => item.value !== null && item.value !== undefined)
          .map((item) => {
            const emaVal = item.value as number
            // Look up std dev for this tracker + timestamp
            const computation = trackerComputations.find(
              (c) => c.tracker.name === item.seriesName
            )
            const sigma = computation?.stdDevByTs.get(ts) ?? null

            const sigmaStr =
              sigma !== null
                ? ` <span style="color:${CHART_THEME.textTertiary};">[±${sigma.toFixed(2)} σ]</span>`
                : ""

            return (
              `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${item.color};margin-right:6px;box-shadow:0 0 6px ${item.color};"></span>` +
              `<span style="color:${CHART_THEME.textSecondary};">${item.seriesName}:</span> ` +
              `<span style="color:${CHART_THEME.textPrimary};font-weight:600;">${emaVal.toFixed(2)}×</span>` +
              ` <span style="color:${CHART_THEME.textTertiary};">(EMA)</span>` +
              sigmaStr
            )
          })
          .join("<br/>")

        return `<div style="font-family:${CHART_THEME.fontMono};font-size:11px;color:${CHART_THEME.textTertiary};margin-bottom:4px;">${time}</div>${rows}`
      },
    }),
    xAxis: {
      type: "category",
      data: labels,
      boundaryGap: false,
      axisLine: { lineStyle: { color: CHART_THEME.gridLine } },
      axisTick: { show: false },
      axisLabel: chartAxisLabel({ rotate: 30, interval: "auto" }),
      splitLine: { show: false },
    },
    yAxis: {
      type: "value",
      name: "Ratio",
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
        formatter: (val: number) =>
          val.toLocaleString(undefined, {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1,
          }),
      }),
      splitLine: {
        lineStyle: {
          color: CHART_THEME.gridLine,
          width: 1,
        },
      },
    },
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

  if (!hasEnoughData) {
    return (
      <ChartEmptyState
        height={height}
        message="Not enough data for stability analysis"
      />
    )
  }

  return (
    <ReactECharts
      option={buildRatioStabilityOption(trackerData, emaPeriod, bandWindow)}
      style={{ height, width: "100%" }}
      opts={{ renderer: "canvas" }}
      notMerge
      lazyUpdate
    />
  )
}

export { RatioStabilityChart, computeEmaWithBand }
export type { RatioStabilityChartProps }
