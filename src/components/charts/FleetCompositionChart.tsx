// src/components/charts/FleetCompositionChart.tsx
//
// Functions: buildFleetOption, FleetCompositionChart

"use client"

import type { EChartsOption } from "echarts"
import { ChartECharts } from "./ChartECharts"
import { hexToRgba } from "@/lib/formatters"
import type { Snapshot } from "@/types/api"
import type { TrackerSnapshotSeries } from "@/types/charts"
import { ChartEmptyState } from "./ChartEmptyState"
import { CHART_THEME, chartAxisLabel, chartDot, chartGrid, chartLegend, chartTooltip, chartTooltipHeader, escHtml } from "./theme"

interface FleetCompositionChartProps {
  trackerData: TrackerSnapshotSeries[]
  height?: number
}

function buildFleetOption(trackerData: TrackerSnapshotSeries[]): EChartsOption {
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

  const series: EChartsOption["series"] = trackerData.map((tracker) => {
    const snapByTs = new Map<string, Snapshot>()
    for (const snap of tracker.snapshots) {
      snapByTs.set(snap.polledAt, snap)
    }

    const data = sortedTimestamps.map((ts) => {
      const snap = snapByTs.get(ts)
      if (!snap) return null
      return snap.seedingCount ?? null
    })

    return {
      name: tracker.name,
      type: "line",
      stack: "fleet",
      data,
      smooth: true,
      connectNulls: false,
      symbol: "none",
      emphasis: { focus: "series" },
      lineStyle: {
        color: tracker.color,
        width: 1.5,
      },
      itemStyle: { color: tracker.color },
      areaStyle: {
        color: {
          type: "linear",
          x: 0,
          y: 0,
          x2: 0,
          y2: 1,
          colorStops: [
            { offset: 0, color: hexToRgba(tracker.color, 0.6) },
            { offset: 1, color: hexToRgba(tracker.color, 0.05) },
          ],
        },
      },
    }
  })

  return {
    backgroundColor: "transparent",
    grid: chartGrid({ right: 16, left: 64 }),
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
          value: number | null
          color: string
          axisValueLabel: string
        }>
        if (!items?.length) return ""
        const time = items[0].axisValueLabel
        const validItems = items.filter(
          (i) => i.value !== null && i.value !== undefined
        )
        const total = validItems.reduce(
          (sum, i) => sum + (i.value as number),
          0
        )
        const sorted = [...validItems].sort(
          (a, b) => (b.value as number) - (a.value as number)
        )

        const header = chartTooltipHeader(time)
        const totalRow = `<div style="color:${CHART_THEME.textPrimary};font-weight:600;margin-bottom:4px;">Total: ${total.toLocaleString()} seeding</div>`
        const rows = sorted
          .map((item) => {
            return `${chartDot(item.color)}<span style="color:${CHART_THEME.textSecondary};">${escHtml(item.seriesName)}:</span> <span style="color:${CHART_THEME.textPrimary};font-weight:600;">${(item.value as number).toLocaleString()}</span>`
          })
          .join("<br/>")

        return header + totalRow + rows
      },
    }),
    xAxis: {
      type: "category",
      data: labels,
      boundaryGap: false,
      axisLine: { lineStyle: { color: CHART_THEME.gridLine } },
      axisTick: { show: false },
      axisLabel: chartAxisLabel({ rotate: 30, interval: "auto" }),
    },
    yAxis: {
      type: "value",
      name: "Seeding",
      nameTextStyle: {
        color: CHART_THEME.textTertiary,
        fontFamily: CHART_THEME.fontMono,
        fontSize: 10,
      },
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: chartAxisLabel({
        formatter: (val: number) => val.toLocaleString(),
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

function FleetCompositionChart({
  trackerData,
  height = 360,
}: FleetCompositionChartProps) {
  const hasData = trackerData.some((t) =>
    t.snapshots.some((s) => s.seedingCount !== null)
  )

  if (!hasData) {
    return <ChartEmptyState height={height} message="No fleet data available" />
  }

  return (
    <ChartECharts
      option={buildFleetOption(trackerData)}
      style={{ height, width: "100%" }}
      opts={{ renderer: "canvas" }}
      notMerge
      lazyUpdate
    />
  )
}

export { FleetCompositionChart }
export type { FleetCompositionChartProps }
