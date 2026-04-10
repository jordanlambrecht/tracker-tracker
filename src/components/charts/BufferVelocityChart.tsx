// src/components/charts/BufferVelocityChart.tsx
//
// Functions: applyMovingAverage, computeBufferVelocity, buildBufferVelocityOption, BufferVelocityChart

"use client"

import type { EChartsOption } from "echarts"
import { useState } from "react"
import { TabBar } from "@/components/ui/TabBar"
import { localDateStr } from "@/lib/formatters"
import type { Snapshot } from "@/types/api"
import type { FleetChartProps } from "@/types/charts"
import { ChartECharts } from "./lib/ChartECharts"
import { ChartEmptyState } from "./lib/ChartEmptyState"
import {
  autoByteScale,
  buildAxisPointer,
  buildTimeXAxis,
  fmtNum,
  insideZoom,
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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type MAWindow = "1" | "3" | "7"

interface BufferVelocityChartProps extends FleetChartProps {}

interface TrackerVelocityData {
  name: string
  color: string
  days: string[]
  velocities: (number | null)[]
}

// ---------------------------------------------------------------------------
// Moving average helper
// ---------------------------------------------------------------------------

function applyMovingAverage(velocities: (number | null)[], window: number): (number | null)[] {
  if (window <= 1) return velocities
  return velocities.map((_, i) => {
    const start = Math.max(0, i - window + 1)
    const slice = velocities.slice(start, i + 1).filter((v): v is number => v !== null)
    if (slice.length === 0) return null
    return slice.reduce((a, b) => a + b, 0) / slice.length
  })
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
    const day = localDateStr(new Date(snap.polledAt))
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
    // Allow negative values
    const velocityGiB = Number(BigInt(curr.bufferBytes) - BigInt(prev.bufferBytes)) / 1024 ** 3

    resultDays.push(days[i])
    velocities.push(velocityGiB)
  }

  return { days: resultDays, velocities }
}

// ---------------------------------------------------------------------------
// Chart builder
// ---------------------------------------------------------------------------

function buildBufferVelocityOption(
  computed: TrackerVelocityData[],
  useLog: boolean
): EChartsOption {
  // Build unified day axis from the union of all tracker day sets
  const allDays = new Set<string>()
  for (const t of computed) {
    for (const d of t.days) allDays.add(d)
  }
  const sortedDays = Array.from(allDays).sort()

  if (sortedDays.length === 0) return {}

  // Convert ISO day strings to noon timestamps to avoid timezone boundary issues
  const dayTimestamps = new Map<string, number>()
  for (const day of sortedDays) {
    dayTimestamps.set(day, new Date(`${day}T12:00:00`).getTime())
  }

  // Determine unit (GiB vs TiB) based on max absolute velocity
  let maxAbsVal = 0
  for (const t of computed) {
    for (const v of t.velocities) {
      if (v !== null) maxAbsVal = Math.max(maxAbsVal, Math.abs(v))
    }
  }
  const { divisor, unit: baseUnit } = autoByteScale(maxAbsVal)
  const unit = `${baseUnit}/day`

  // Detect whether the last day in the unified axis is today (partial day)
  const today = localDateStr()
  const lastDayIsToday = sortedDays[sortedDays.length - 1] === today

  // Build per-tracker series mapped to the unified day axis.
  // Delta charts skip nulls with no carry-forward.
  const series: NonNullable<EChartsOption["series"]> = computed.map((tracker, idx) => {
    const dayVelocityMap = new Map<string, number | null>()
    for (let i = 0; i < tracker.days.length; i++) {
      dayVelocityMap.set(tracker.days[i], tracker.velocities[i])
    }

    const data: (
      | [number, number]
      | { value: [number, number]; itemStyle: object; symbolSize: number }
    )[] = []
    for (const day of sortedDays) {
      const v = dayVelocityMap.get(day)
      if (v === undefined || v === null) continue
      const ts = dayTimestamps.get(day) as number
      data.push([ts, Number((v / divisor).toFixed(4))])
    }

    // Mark today's point as a hollow ring to signal partial/incomplete data
    if (lastDayIsToday && data.length > 0) {
      const lastPoint = data[data.length - 1]
      const todayTs = dayTimestamps.get(today)
      const lastVal = Array.isArray(lastPoint) ? lastPoint : lastPoint.value
      if (lastVal[0] === todayTs) {
        data[data.length - 1] = {
          value: lastVal as [number, number],
          itemStyle: {
            borderWidth: 2,
            borderColor: tracker.color,
            color: CHART_THEME.surface,
          },
          symbolSize: 8,
        }
      }
    }

    return {
      name: tracker.name,
      type: "line",
      sampling: "lttb",
      data,
      smooth: false,
      symbol: "circle",
      symbolSize: 6,
      itemStyle: { color: tracker.color },
      lineStyle: {
        color: tracker.color,
        width: 2,
        shadowColor: tracker.color,
        shadowBlur: 8,
      },
      emphasis: {
        focus: "series" as const,
        lineStyle: {
          shadowBlur: 16,
          shadowColor: tracker.color,
        },
      },
      // Only the first series carries the "Break even" markLine label
      ...(idx === 0
        ? {
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
                    fontSize: CHART_THEME.fontSizeCompact,
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
        : {}),
    }
  })

  return {
    backgroundColor: "transparent",
    grid: chartGrid({ right: 16, left: 72 }),
    tooltip: chartTooltip("axis", {
      axisPointer: buildAxisPointer(CHART_THEME.borderMid, 0.8, 1),
      formatter: (params: unknown) => {
        const items = params as Array<{
          seriesName: string
          value: [number, number] | null
          color: string
        }>
        if (!items || items.length === 0) return ""
        const firstValid = items.find((item) => item.value !== null && item.value !== undefined)
        if (!firstValid?.value) return ""
        const date = formatChartTimestamp(firstValid.value[0])
        const rows = items
          .filter((item) => item.value !== null && item.value !== undefined)
          .map((item) => {
            const val = (item.value as [number, number])[1]
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
    xAxis: buildTimeXAxis(),
    yAxis: {
      type: useLog ? "log" : "value",
      name: useLog ? `${unit} (log)` : unit,
      scale: true,
      nameTextStyle: {
        color: CHART_THEME.textTertiary,
        fontFamily: CHART_THEME.fontMono,
        fontSize: CHART_THEME.fontSizeCompact,
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
    dataZoom: insideZoom(sortedDays.length),
    series,
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const MA_TABS: { key: MAWindow; label: string }[] = [
  { key: "1", label: "Daily" },
  { key: "3", label: "3-day MA" },
  { key: "7", label: "7-day MA" },
]

function BufferVelocityChart({ trackerData, height = 320 }: BufferVelocityChartProps) {
  const [maWindow, setMaWindow] = useState<MAWindow>("1")

  const computed: TrackerVelocityData[] = trackerData.map((t) => {
    const { days, velocities } = computeBufferVelocity(t.snapshots)
    return { name: t.name, color: t.color, days, velocities }
  })

  const hasEnoughData = computed.some((t) => t.days.length >= 1)

  const allVelocities: number[] = []
  for (const t of computed) {
    for (const v of t.velocities) {
      if (v !== null && v > 0) allVelocities.push(v)
    }
  }

  const { effectiveLog, isAuto, onToggle } = useLogScale(allVelocities)

  if (!hasEnoughData) {
    return (
      <ChartEmptyState
        height={height}
        message="Need at least 2 days of data for velocity analysis"
      />
    )
  }

  // Apply moving average before passing to chart builder
  const windowSize = Number(maWindow) as 1 | 3 | 7
  const smoothed = computed.map((t) => ({
    ...t,
    velocities: applyMovingAverage(t.velocities, windowSize),
  }))

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <TabBar compact tabs={MA_TABS} activeTab={maWindow} onChange={setMaWindow} />
        <LogScaleToggle effectiveLog={effectiveLog} isAuto={isAuto} onToggle={onToggle} />
      </div>
      <ChartECharts
        option={buildBufferVelocityOption(smoothed, effectiveLog)}
        style={{ height, width: "100%" }}
      />
    </div>
  )
}

export type { BufferVelocityChartProps }
export { BufferVelocityChart }
