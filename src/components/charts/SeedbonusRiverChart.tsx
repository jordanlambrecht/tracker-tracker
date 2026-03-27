// src/components/charts/SeedbonusRiverChart.tsx
//
// Functions: buildRiverData, buildRiverOption, SeedbonusRiverChart

"use client"

import type { EChartsOption } from "echarts"
import type { TrackerSnapshotSeries } from "@/types/charts"
import { ChartECharts } from "./lib/ChartECharts"
import { ChartEmptyState } from "./lib/ChartEmptyState"
import { buildAxisPointer, buildThemeRiverSingleAxis } from "./lib/chart-helpers"
import { carryForwardValues } from "./lib/chart-transforms"
import {
  CHART_THEME,
  chartTooltip,
  chartTooltipHeader,
  chartTooltipRow,
  formatChartTimestamp,
} from "./lib/theme"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SeedbonusRiverChartProps {
  trackerData: TrackerSnapshotSeries[]
  height?: number
}

// ---------------------------------------------------------------------------
// Data builder
// ---------------------------------------------------------------------------

function buildRiverData(trackerData: TrackerSnapshotSeries[]): [string, number, string][] {
  // Collect all timestamps across all trackers (only from non-null seedbonus snaps)
  const allTs = new Set<string>()
  const trackerMaps: Map<string, number>[] = []

  for (const tracker of trackerData) {
    const map = new Map<string, number>()
    const sorted = [...tracker.snapshots]
      .filter((s) => s.seedbonus !== null)
      .sort((a, b) => new Date(a.polledAt).getTime() - new Date(b.polledAt).getTime())
    for (const s of sorted) {
      allTs.add(s.polledAt)
      map.set(s.polledAt, s.seedbonus as number)
    }
    trackerMaps.push(map)
  }

  const sortedTs = [...allTs].sort((a, b) => new Date(a).getTime() - new Date(b).getTime())

  // Carry forward per-tracker seedbonus values (O(T) per tracker instead of O(T*N))
  const carriedSeries = trackerMaps.map((map) => carryForwardValues(sortedTs, map, 0))

  const data: [string, number, string][] = []
  for (let t = 0; t < sortedTs.length; t++) {
    for (let i = 0; i < trackerData.length; i++) {
      data.push([sortedTs[t], carriedSeries[i][t] ?? 0, trackerData[i].name])
    }
  }

  return data
}

// ---------------------------------------------------------------------------
// Chart option builder
// ---------------------------------------------------------------------------

function buildRiverOption(
  trackerData: TrackerSnapshotSeries[],
  riverData: [string, number, string][]
): EChartsOption {
  const colors = trackerData.map((t) => t.color)

  return {
    backgroundColor: "transparent",
    color: colors,
    tooltip: chartTooltip("axis", {
      axisPointer: buildAxisPointer(),
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
        const formattedDate = rawDate ? formatChartTimestamp(new Date(rawDate).getTime()) : ""

        const rows = items
          .filter((item) => item.value && item.value[1] !== undefined)
          .map((item) => {
            const trackerName = item.value[2]
            const bon = item.value[1]
            const display = `${bon.toLocaleString()} BON`
            return chartTooltipRow(item.color, trackerName, display)
          })
          .join("<br/>")

        return chartTooltipHeader(formattedDate) + rows
      },
    }),
    singleAxis: buildThemeRiverSingleAxis(),
    series: [
      {
        type: "themeRiver",
        data: riverData,
        label: {
          show: true,
          color: CHART_THEME.textSecondary,
          fontFamily: CHART_THEME.fontMono,
          fontSize: CHART_THEME.fontSizeCompact,
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

function SeedbonusRiverChart({ trackerData, height = 320 }: SeedbonusRiverChartProps) {
  const hasData = trackerData.some((t) => t.snapshots.some((s) => s.seedbonus !== null))

  if (!hasData) {
    return <ChartEmptyState height={height} message="No seedbonus data available" />
  }

  const riverData = buildRiverData(trackerData)

  return (
    <ChartECharts
      option={buildRiverOption(trackerData, riverData)}
      style={{ height, width: "100%" }}
    />
  )
}

export type { SeedbonusRiverChartProps }
export { SeedbonusRiverChart }
