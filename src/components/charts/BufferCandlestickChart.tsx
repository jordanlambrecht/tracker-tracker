// src/components/charts/BufferCandlestickChart.tsx
//
// Functions: computeCandlestickData, buildCandlestickOption, BufferCandlestickChart

"use client"

import type { CandlestickSeriesOption, EChartsOption } from "echarts"
import { useState } from "react"
import { bytesToGiB, hexToRgba } from "@/lib/formatters"
import type { Snapshot } from "@/types/api"
import type { TrackerSnapshotSeries } from "@/types/charts"
import { ChartECharts } from "./ChartECharts"
import { ChartEmptyState } from "./ChartEmptyState"
import { fmtNum } from "./chart-helpers"
import { LogScaleToggle } from "./LogScaleToggle"
import { CHART_THEME, chartAxisLabel, chartDot, chartGrid, chartLegend, chartTooltip, chartTooltipHeader, escHtml, shouldUseLogScale } from "./theme"

interface BufferCandlestickChartProps {
  trackerData: TrackerSnapshotSeries[]
  height?: number
}

interface CandlestickResult {
  days: string[]
  ohlc: [number, number, number, number][] // [open, close, low, high]
}

/**
 * Groups snapshots by calendar day (YYYY-MM-DD) and computes
 * open/high/low/close buffer values in GiB. Returns the day labels
 * and OHLC array in ECharts candlestick format [open, close, low, high].
 */
function computeCandlestickData(
  snapshots: Snapshot[],
  divisor: number
): CandlestickResult {
  if (snapshots.length === 0) return { days: [], ohlc: [] }

  const sorted = [...snapshots].sort(
    (a, b) => new Date(a.polledAt).getTime() - new Date(b.polledAt).getTime()
  )

  // Group by calendar day (YYYY-MM-DD)
  const byDay = new Map<string, Snapshot[]>()
  for (const snap of sorted) {
    const day = snap.polledAt.slice(0, 10)
    const existing = byDay.get(day)
    if (existing) {
      existing.push(snap)
    } else {
      byDay.set(day, [snap])
    }
  }

  const days: string[] = []
  const ohlc: [number, number, number, number][] = []

  for (const [day, snaps] of byDay) {
    const values = snaps.map(
      (s) => bytesToGiB(s.bufferBytes) / divisor
    )
    const open = values[0]
    const close = values[values.length - 1]
    const high = Math.max(...values)
    const low = Math.min(...values)
    days.push(day)
    ohlc.push([open, close, low, high])
  }

  return { days, ohlc }
}

/**
 * Builds the ECharts option object for a multi-tracker buffer candlestick chart.
 */
function buildCandlestickOption(
  trackerData: TrackerSnapshotSeries[],
  forceLog: boolean | null = null
): EChartsOption {
  // Collect all GiB values across all trackers to decide GiB vs TiB
  let maxGiB = 0
  for (const tracker of trackerData) {
    for (const snap of tracker.snapshots) {
      const gib = bytesToGiB(snap.bufferBytes)
      if (gib > maxGiB) maxGiB = gib
    }
  }
  const useTiB = maxGiB >= 1024
  const divisor = useTiB ? 1024 : 1
  const unit = useTiB ? "TiB" : "GiB"

  // Build per-tracker candlestick data
  const trackerResults = trackerData.map((tracker) =>
    computeCandlestickData(tracker.snapshots, divisor)
  )

  // Build unified sorted day axis from the union of all trackers' days
  const allDaysSet = new Set<string>()
  for (const result of trackerResults) {
    for (const day of result.days) {
      allDaysSet.add(day)
    }
  }
  const allDays = Array.from(allDaysSet).sort()

  // Collect all OHLC values to decide linear vs log
  const allValues: number[] = []
  for (const result of trackerResults) {
    for (const [open, close, low, high] of result.ohlc) {
      allValues.push(open, close, low, high)
    }
  }
  const autoLog = shouldUseLogScale(allValues)
  const useLog = forceLog ?? autoLog

  // Compute explicit min/max for log axis from positive data values
  let logMin: number | undefined
  let logMax: number | undefined
  if (useLog) {
    const positiveValues = allValues.filter((v) => v > 0)
    if (positiveValues.length > 0) {
      logMin = Math.min(...positiveValues) * 0.5
      logMax = Math.max(...positiveValues) * 2
    }
  }

  const barMaxWidth = 20

  // Build one candlestick series per tracker, mapped to the unified day axis.
  // Days with no data for a tracker use a doji-style placeholder so ECharts
  // doesn't choke on sparse data — we pass a CandlestickDataItemOption with
  // value set to undefined which the library treats as a gap.
  const series: CandlestickSeriesOption[] = trackerData.map((tracker, idx) => {
    const result = trackerResults[idx]
    const dayToOhlc = new Map<string, [number, number, number, number]>()
    for (let i = 0; i < result.days.length; i++) {
      dayToOhlc.set(result.days[i], result.ohlc[i])
    }

    // CandlestickDataValue is [open, close, lowest, highest]
    const data: CandlestickSeriesOption["data"] = allDays.map((day) => {
      const entry = dayToOhlc.get(day)
      if (!entry) {
        // Represent missing days as an item with no value (renders as gap)
        return { value: undefined as unknown as [number, number, number, number] }
      }
      return entry
    })

    return {
      name: tracker.name,
      type: "candlestick",
      data,
      barMaxWidth,
      itemStyle: {
        color: tracker.color,
        color0: hexToRgba(tracker.color, 0.4),
        borderColor: tracker.color,
        borderColor0: tracker.color,
      },
    } satisfies CandlestickSeriesOption
  })

  return {
    backgroundColor: "transparent",
    grid: chartGrid({ right: 16, left: 72 }),
    legend: chartLegend(),
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
          value: [number, number, number, number, number] | null
          color: string
          axisValueLabel: string
        }>
        if (!items || items.length === 0) return ""

        const date = items[0].axisValueLabel
        const header = chartTooltipHeader(date)

        const rows = items
          .filter((item) => item.value !== null && item.value !== undefined)
          .map((item) => {
            // Axis-trigger candlestick value: [categoryIndex, open, close, low, high]
            const [, open, close, low, high] = item.value as [
              number,
              number,
              number,
              number,
              number,
            ]
            const change = close - open
            const changeAbs = Math.abs(change)
            const changeSign = change >= 0 ? "+" : "-"
            const arrow = change >= 0 ? "▲" : "▼"
            const changeColor = change >= 0 ? CHART_THEME.positive : CHART_THEME.negative

            const swatch = chartDot(item.color)
            const name = `<span style="color:${CHART_THEME.textSecondary};font-weight:600;">${escHtml(item.seriesName)}:</span>`
            const indent = `<span style="display:inline-block;width:14px;"></span>`
            const openLine = `${indent}<span style="color:${CHART_THEME.textTertiary};">Open:</span> <span style="color:${CHART_THEME.textPrimary};">${fmtNum(open)} ${unit}</span>`
            const closeLine = `${indent}<span style="color:${CHART_THEME.textTertiary};">Close:</span> <span style="color:${CHART_THEME.textPrimary};">${fmtNum(close)} ${unit}</span>`
            const highLine = `${indent}<span style="color:${CHART_THEME.textTertiary};">High:</span> <span style="color:${CHART_THEME.textPrimary};">${fmtNum(high)} ${unit}</span>`
            const lowLine = `${indent}<span style="color:${CHART_THEME.textTertiary};">Low:</span> <span style="color:${CHART_THEME.textPrimary};">${fmtNum(low)} ${unit}</span>`
            const changeLine = `${indent}<span style="color:${CHART_THEME.textTertiary};">Change:</span> <span style="color:${changeColor};font-weight:600;">${changeSign}${fmtNum(changeAbs)} ${unit} (${arrow})</span>`

            return `<div style="margin-bottom:8px;">${swatch}${name}<br/>${openLine}&nbsp;&nbsp;${closeLine}<br/>${highLine}&nbsp;&nbsp;${lowLine}<br/>${changeLine}</div>`
          })
          .join("")

        return `<div style="font-family:${CHART_THEME.fontMono};font-size:11px;">${header}${rows}</div>`
      },
    }),
    xAxis: {
      type: "category",
      data: allDays.map((d) => {
        const date = new Date(`${d}T12:00:00`)
        return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
      }),
      boundaryGap: true,
      axisLine: { lineStyle: { color: CHART_THEME.gridLine } },
      axisTick: { show: false },
      axisLabel: chartAxisLabel({ rotate: 30, interval: "auto" }),
      splitLine: { show: false },
    },
    yAxis: {
      type: useLog ? "log" : "value",
      name: useLog ? `${unit} (log)` : unit,
      ...(useLog ? { min: logMin, max: logMax } : { scale: true }),
      nameTextStyle: {
        color: CHART_THEME.textTertiary,
        fontFamily: CHART_THEME.fontMono,
        fontSize: 10,
      },
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: chartAxisLabel({
        formatter: useLog
          ? (val: number) => {
              if (val >= 1000) return `${fmtNum(val / 1000, 1)}k`
              if (val >= 1) return fmtNum(val, val < 10 ? 1 : 0)
              return fmtNum(val, 2)
            }
          : (val: number) => fmtNum(val, 1),
      }),
      splitLine: {
        lineStyle: {
          color: CHART_THEME.gridLine,
          width: 1,
        },
      },
    },
    series: series as EChartsOption["series"],
  }
}

/**
 * Renders daily buffer values as candlestick series (one per tracker).
 * Each candle represents open/high/low/close buffer for a calendar day.
 * Shows empty state if no tracker has at least 2 days of data.
 */
function BufferCandlestickChart({
  trackerData,
  height = 360,
}: BufferCandlestickChartProps) {
  const [logOverride, setLogOverride] = useState<boolean | null>(null)

  const hasEnoughDays = trackerData.some((tracker) => {
    const uniqueDays = new Set(
      tracker.snapshots.map((s) => s.polledAt.slice(0, 10))
    )
    return uniqueDays.size >= 2
  })

  if (!hasEnoughDays) {
    return (
      <ChartEmptyState
        height={height}
        message="Need at least 2 days of snapshots for candlestick view"
      />
    )
  }

  // Compute auto-detect for toggle label
  const allValues: number[] = []
  for (const tracker of trackerData) {
    let maxGiB = 0
    for (const snap of tracker.snapshots) {
      const gib = bytesToGiB(snap.bufferBytes)
      if (gib > maxGiB) maxGiB = gib
    }
    const divisor = maxGiB >= 1024 ? 1024 : 1
    for (const snap of tracker.snapshots) {
      allValues.push(bytesToGiB(snap.bufferBytes) / divisor)
    }
  }
  const autoLog = shouldUseLogScale(allValues)
  const effectiveLog = logOverride ?? autoLog

  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-end">
        <LogScaleToggle
          effectiveLog={effectiveLog}
          isAuto={logOverride === null}
          onToggle={() => setLogOverride(logOverride === null ? !autoLog : null)}
        />
      </div>
      <ChartECharts
        option={buildCandlestickOption(trackerData, logOverride)}
        style={{ height, width: "100%" }}
        opts={{ renderer: "canvas" }}
        notMerge
        lazyUpdate
      />
    </div>
  )
}

export type { BufferCandlestickChartProps }
export { BufferCandlestickChart }
