// src/components/charts/BufferVelocityChart.tsx
//
// Functions: computeBufferVelocity, buildBufferVelocityOption, BufferVelocityChart

"use client"

import type { EChartsOption } from "echarts"
import { useState } from "react"
import { hexToRgba } from "@/lib/formatters"
import type { Snapshot } from "@/types/api"
import type { TrackerSnapshotSeries } from "@/types/charts"
import { ChartECharts } from "./ChartECharts"
import { ChartEmptyState } from "./ChartEmptyState"
import { LogScaleToggle } from "./LogScaleToggle"
import { CHART_THEME, chartAxisLabel, chartDot, chartGrid, chartLegend, chartTooltip, chartTooltipHeader, escHtml, shouldUseLogScale } from "./theme"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BufferVelocityChartProps {
  trackerData: TrackerSnapshotSeries[]
  height?: number
}

interface TrackerVelocityData {
  name: string
  color: string
  days: string[]
  velocities: (number | null)[]
}

// ---------------------------------------------------------------------------
// Computation
// ---------------------------------------------------------------------------

function computeBufferVelocity(snapshots: Snapshot[]): {
  days: string[]
  velocities: (number | null)[]
} {
  if (snapshots.length === 0) return { days: [], velocities: [] }

  // Sort by polledAt ascending
  const sorted = [...snapshots].sort(
    (a, b) => new Date(a.polledAt).getTime() - new Date(b.polledAt).getTime()
  )

  // Group by calendar day, keep last snapshot per day
  const dayMap = new Map<string, Snapshot>()
  for (const snap of sorted) {
    const day = new Date(snap.polledAt).toISOString().slice(0, 10)
    dayMap.set(day, snap) // last one wins
  }

  const days = Array.from(dayMap.keys()).sort()
  const resultDays: string[] = []
  const velocities: (number | null)[] = []

  for (let i = 1; i < days.length; i++) {
    const prev = dayMap.get(days[i - 1])
    const curr = dayMap.get(days[i])
    // Both entries are guaranteed to exist since days comes from dayMap.keys()
    if (!prev || !curr) continue
    // Allow negative values — this is the whole point
    const velocityGiB =
      Number(BigInt(curr.bufferBytes) - BigInt(prev.bufferBytes)) / 1024 ** 3

    resultDays.push(days[i])
    velocities.push(velocityGiB)
  }

  return { days: resultDays, velocities }
}

// ---------------------------------------------------------------------------
// Chart builder
// ---------------------------------------------------------------------------

function buildBufferVelocityOption(
  trackerData: TrackerSnapshotSeries[],
  forceLog: boolean | null = null
): EChartsOption {
  // Compute per-tracker velocities
  const computed: TrackerVelocityData[] = trackerData.map((t) => {
    const { days, velocities } = computeBufferVelocity(t.snapshots)
    return { name: t.name, color: t.color, days, velocities }
  })

  // Build unified day axis from the union of all tracker day sets
  const allDays = new Set<string>()
  for (const t of computed) {
    for (const d of t.days) allDays.add(d)
  }
  const sortedDays = Array.from(allDays).sort()

  if (sortedDays.length === 0) return {}

  const labels = sortedDays.map((d) => {
    const date = new Date(`${d}T12:00:00`)
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
  })

  // Determine unit (GiB vs TiB) based on max absolute velocity
  let maxAbsVal = 0
  for (const t of computed) {
    for (const v of t.velocities) {
      if (v !== null) maxAbsVal = Math.max(maxAbsVal, Math.abs(v))
    }
  }
  const useTiB = maxAbsVal >= 1024
  const divisor = useTiB ? 1024 : 1
  const unit = useTiB ? "TiB/day" : "GiB/day"

  // Log scale detection (only considers positive velocities)
  const positiveVelocities: number[] = []
  for (const t of computed) {
    for (const v of t.velocities) {
      if (v !== null && v > 0) positiveVelocities.push(v / divisor)
    }
  }
  const autoLog = shouldUseLogScale(positiveVelocities)
  const useLog = forceLog ?? autoLog

  const fmtNum = (v: number, decimals = 2): string =>
    v.toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })

  // Build per-tracker series mapped to the unified day axis
  const series: NonNullable<EChartsOption["series"]> = computed.map((tracker) => {
    const dayVelocityMap = new Map<string, number | null>()
    for (let i = 0; i < tracker.days.length; i++) {
      dayVelocityMap.set(tracker.days[i], tracker.velocities[i])
    }

    const data = sortedDays.map((day) => {
      const v = dayVelocityMap.get(day)
      if (v === undefined || v === null) return null
      return Number((v / divisor).toFixed(4))
    })

    return {
      name: tracker.name,
      type: "line",
      data,
      smooth: true,
      connectNulls: true,
      symbol: "none",
      itemStyle: { color: tracker.color },
      lineStyle: {
        color: tracker.color,
        width: 2,
        shadowColor: tracker.color,
        shadowBlur: 8,
      },
      areaStyle: {
        color: {
          type: "linear",
          x: 0,
          y: 0,
          x2: 0,
          y2: 1,
          colorStops: [
            { offset: 0, color: hexToRgba(tracker.color, 0.2) },
            { offset: 1, color: hexToRgba(tracker.color, 0) },
          ],
        },
      },
      emphasis: {
        lineStyle: {
          shadowBlur: 16,
          shadowColor: tracker.color,
        },
      },
      markLine: {
        silent: true,
        symbol: ["none", "none"],
        data: [
          {
            yAxis: 0,
            label: {
              show: true,
              formatter: "Break even",
              position: "insideEndTop",
              color: CHART_THEME.warn,
              fontFamily: CHART_THEME.fontMono,
              fontSize: 10,
            },
            lineStyle: {
              color: CHART_THEME.warn,
              type: "dashed",
              width: 1.5,
              opacity: 0.8,
            },
          },
        ],
      },
    }
  })

  return {
    backgroundColor: "transparent",
    grid: chartGrid({ right: 16, left: 72 }),
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
        const date = items[0].axisValueLabel
        const rows = items
          .filter((item) => item.value !== null && item.value !== undefined)
          .map((item) => {
            const val = item.value as number
            const sign = val >= 0 ? "+" : ""
            const valueColor = val >= 0 ? CHART_THEME.positive : CHART_THEME.negative
            const display = `${sign}${fmtNum(val)} ${unit}`
            return (
              chartDot(item.color) +
              `<span style="color:${CHART_THEME.textSecondary};">${escHtml(item.seriesName)}:</span> ` +
              `<span style="color:${valueColor};font-weight:600;">${display}</span>`
            )
          })
          .join("<br/>")
        return chartTooltipHeader(date) + rows
      },
    }),
    legend: chartLegend(),
    xAxis: {
      type: "category",
      data: labels,
      boundaryGap: false,
      axisLine: { lineStyle: { color: CHART_THEME.gridLine } },
      axisTick: { show: false },
      axisLabel: chartAxisLabel({
        rotate: sortedDays.length > 14 ? 30 : 0,
        interval: "auto",
      }),
      splitLine: { show: false },
    },
    yAxis: {
      type: useLog ? "log" : "value",
      name: useLog ? `${unit} (log)` : unit,
      scale: true,
      nameTextStyle: {
        color: CHART_THEME.textTertiary,
        fontFamily: CHART_THEME.fontMono,
        fontSize: 10,
      },
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: chartAxisLabel({
        formatter: (val: number) => {
          const sign = val > 0 ? "+" : ""
          return `${sign}${fmtNum(val, 1)}`
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
// Component
// ---------------------------------------------------------------------------

function BufferVelocityChart({
  trackerData,
  height = 320,
}: BufferVelocityChartProps) {
  const [logOverride, setLogOverride] = useState<boolean | null>(null)

  // Need at least 2 days of buffer data per tracker (velocity requires consecutive days)
  const hasEnoughData = trackerData.some((t) => {
    const { days } = computeBufferVelocity(t.snapshots)
    return days.length >= 1
  })

  if (!hasEnoughData) {
    return (
      <ChartEmptyState
        height={height}
        message="Need at least 2 days of data for velocity analysis"
      />
    )
  }

  // Compute auto-detect for toggle label
  const allVelocities: number[] = []
  for (const tracker of trackerData) {
    const { velocities } = computeBufferVelocity(tracker.snapshots)
    for (const v of velocities) {
      if (v !== null && v > 0) allVelocities.push(v)
    }
  }
  const autoLog = shouldUseLogScale(allVelocities)
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
        option={buildBufferVelocityOption(trackerData, logOverride)}
        style={{ height, width: "100%" }}
        opts={{ renderer: "canvas" }}
        notMerge
        lazyUpdate
      />
    </div>
  )
}

export { BufferVelocityChart }
export type { BufferVelocityChartProps }
