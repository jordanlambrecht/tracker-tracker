// src/components/charts/SeedbonusRiverChart.tsx
//
// Functions: buildRiverData, buildRiverOption, SeedbonusRiverChart

"use client"

import type { EChartsOption } from "echarts"
import ReactECharts from "echarts-for-react"
import type { Snapshot } from "@/types/api"
import { ChartEmptyState } from "./ChartEmptyState"
import { CHART_THEME, chartAxisLabel, chartTooltip } from "./theme"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TrackerSeedbonusSeries {
  name: string
  color: string
  snapshots: Snapshot[]
}

interface SeedbonusRiverChartProps {
  trackerData: TrackerSeedbonusSeries[]
  height?: number
}

// ---------------------------------------------------------------------------
// Data builder
// ---------------------------------------------------------------------------

function buildRiverData(
  trackerData: TrackerSeedbonusSeries[]
): [string, number, string][] {
  // Collect all timestamps across all trackers (only from non-null seedbonus snaps)
  const allTs = new Set<string>()
  const trackerMaps: Map<string, number>[] = []

  for (const tracker of trackerData) {
    const map = new Map<string, number>()
    const sorted = [...tracker.snapshots]
      .filter((s) => s.seedbonus !== null)
      .sort(
        (a, b) => new Date(a.polledAt).getTime() - new Date(b.polledAt).getTime()
      )
    for (const s of sorted) {
      allTs.add(s.polledAt)
      map.set(s.polledAt, s.seedbonus as number)
    }
    trackerMaps.push(map)
  }

  const sortedTs = [...allTs].sort(
    (a, b) => new Date(a).getTime() - new Date(b).getTime()
  )

  const data: [string, number, string][] = []

  for (const ts of sortedTs) {
    for (let i = 0; i < trackerData.length; i++) {
      const map = trackerMaps[i]
      let val = map.get(ts)
      if (val === undefined) {
        // Find most recent known value before this timestamp (forward-fill)
        const tsTime = new Date(ts).getTime()
        let closest = 0
        for (const [key, v] of map) {
          if (new Date(key).getTime() <= tsTime) closest = v
        }
        val = closest
      }
      data.push([ts, val, trackerData[i].name])
    }
  }

  return data
}

// ---------------------------------------------------------------------------
// Chart option builder
// ---------------------------------------------------------------------------

function buildRiverOption(
  trackerData: TrackerSeedbonusSeries[],
  riverData: [string, number, string][]
): EChartsOption {
  const colors = trackerData.map((t) => t.color)

  return {
    backgroundColor: "transparent",
    color: colors,
    tooltip: chartTooltip("axis", {
      axisPointer: {
        type: "line",
        lineStyle: {
          color: CHART_THEME.borderMid,
          type: "dashed",
        },
      },
      formatter: (params: unknown) => {
        // ThemeRiver tooltip params is an array of items, one per tracker stream
        const items = params as Array<{
          seriesName: string
          value: [string, number, string]
          color: string
          data: [string, number, string]
        }>
        if (!items || items.length === 0) return ""

        // The timestamp comes from the first item's value[0]
        const rawDate = items[0]?.value?.[0]
        const formattedDate = rawDate
          ? new Date(rawDate).toLocaleString("en-US", {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            })
          : ""

        const rows = items
          .filter((item) => item.value && item.value[1] !== undefined)
          .map((item) => {
            const trackerName = item.value[2]
            const bon = item.value[1]
            const display = bon.toLocaleString()
            const col = item.color
            return (
              `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${col};margin-right:6px;box-shadow:0 0 6px ${col};"></span>` +
              `<span style="color:${CHART_THEME.textSecondary};">${trackerName}:</span> ` +
              `<span style="color:${CHART_THEME.textPrimary};font-weight:600;">${display} BON</span>`
            )
          })
          .join("<br/>")

        return `<div style="font-family:var(--font-mono),monospace;font-size:11px;color:${CHART_THEME.textTertiary};margin-bottom:4px;">${formattedDate}</div>${rows}`
      },
    }),
    singleAxis: {
      type: "time",
      bottom: 40,
      axisLabel: chartAxisLabel(),
      axisLine: {
        lineStyle: { color: CHART_THEME.gridLine },
      },
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

function SeedbonusRiverChart({
  trackerData,
  height = 320,
}: SeedbonusRiverChartProps) {
  const hasData = trackerData.some((t) =>
    t.snapshots.some((s) => s.seedbonus !== null)
  )

  if (!hasData) {
    return <ChartEmptyState height={height} message="No seedbonus data available" />
  }

  const riverData = buildRiverData(trackerData)

  return (
    <ReactECharts
      option={buildRiverOption(trackerData, riverData)}
      style={{ height, width: "100%" }}
      opts={{ renderer: "canvas" }}
      notMerge
      lazyUpdate
    />
  )
}

export { SeedbonusRiverChart }
export type { SeedbonusRiverChartProps, TrackerSeedbonusSeries }
