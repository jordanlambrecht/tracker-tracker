// src/components/charts/FleetCompositionChart.tsx

"use client"

import type { EChartsOption } from "echarts"
import { formatCount } from "@/lib/formatters"
import type { FleetChartProps, TrackerSnapshotSeries } from "@/types/charts"
import { ChartECharts } from "./lib/ChartECharts"
import { ChartEmptyState } from "./lib/ChartEmptyState"
import {
  buildAxisPointer,
  buildGlowAreaStyle,
  buildTimeXAxis,
  insideZoom,
} from "./lib/chart-helpers"
import { carryForwardTimeSeries, collectUnifiedTimestamps } from "./lib/chart-transforms"
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

interface FleetCompositionChartProps extends FleetChartProps {}

function buildFleetOption(trackerData: TrackerSnapshotSeries[]): EChartsOption {
  // Collect unified ms timestamps for the time axis
  const allTimestamps = collectUnifiedTimestamps(trackerData)

  const series: EChartsOption["series"] = trackerData.map((tracker) => {
    // Carry forward last known seedingCount to prevent stacked area collapse at gap timestamps
    const data = carryForwardTimeSeries(allTimestamps, tracker.snapshots, (s) => s.seedingCount)

    return {
      name: tracker.name,
      type: "line",
      stack: "fleet",
      data,
      smooth: true,
      symbol: "none",
      lineStyle: {
        color: tracker.color,
        width: 1.5,
      },
      itemStyle: { color: tracker.color },
      areaStyle: buildGlowAreaStyle(tracker.color, 0.6, 0.05),
    }
  })

  return {
    backgroundColor: "transparent",
    grid: chartGrid({ right: 16, left: 64 }),
    legend: chartLegend(),
    tooltip: chartTooltip("axis", {
      axisPointer: buildAxisPointer(CHART_THEME.borderMid, 0.8, 1),
      formatter: (params: unknown) => {
        const items = params as Array<{
          seriesName: string
          value: [number, number] | null
          color: string
        }>
        if (!items?.length) return ""

        const firstValue = items[0]?.value
        if (!firstValue) return ""
        const tsMs = firstValue[0]
        const time = formatChartTimestamp(tsMs)

        const validItems = items.filter((i) => i.value !== null && i.value !== undefined)
        const total = validItems.reduce((sum, i) => sum + (i.value as [number, number])[1], 0)
        const sorted = [...validItems].sort(
          (a, b) => (b.value as [number, number])[1] - (a.value as [number, number])[1]
        )

        const header = chartTooltipHeader(time)
        const totalRow = `<div style="color:${CHART_THEME.textPrimary};font-weight:600;margin-bottom:4px;">Total: ${formatCount(total)} seeding</div>`
        const rows = sorted
          .map((item) => {
            const val = (item.value as [number, number])[1]
            return chartTooltipRow(item.color, item.seriesName, formatCount(val))
          })
          .join("<br/>")

        return header + totalRow + rows
      },
    }),
    xAxis: buildTimeXAxis(),
    yAxis: {
      type: "value",
      name: "Seeding",
      nameTextStyle: {
        color: CHART_THEME.textTertiary,
        fontFamily: CHART_THEME.fontMono,
        fontSize: CHART_THEME.fontSizeCompact,
      },
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: chartAxisLabel({
        formatter: (val: number) => formatCount(val),
      }),
      splitLine: {
        lineStyle: {
          color: CHART_THEME.gridLine,
          width: 1,
        },
      },
    },
    dataZoom: insideZoom(allTimestamps.length),
    series,
  }
}

function FleetCompositionChart({ trackerData, height = 360 }: FleetCompositionChartProps) {
  const hasData = trackerData.some((t) => t.snapshots.some((s) => s.seedingCount !== null))

  if (!hasData) {
    return <ChartEmptyState height={height} message="No fleet data available" />
  }

  return <ChartECharts option={buildFleetOption(trackerData)} style={{ height, width: "100%" }} />
}

export type { FleetCompositionChartProps }
export { FleetCompositionChart }
