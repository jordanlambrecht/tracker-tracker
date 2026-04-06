// src/components/charts/FleetCategoryTimeline.tsx

"use client"

import type { CategoryTimelineEntry } from "@/lib/fleet-aggregation"
import type { StackedAreaSeries } from "@/types/charts"
import { ChartECharts } from "./lib/ChartECharts"
import { ChartEmptyState } from "./lib/ChartEmptyState"
import { buildStackedAreaOption } from "./lib/chart-helpers"
import { buildTagColors, CHART_THEME } from "./lib/theme"

interface FleetCategoryTimelineProps {
  data: CategoryTimelineEntry[]
  height?: number
}

function FleetCategoryTimeline({ data, height = 320 }: FleetCategoryTimelineProps) {
  if (data.length === 0) {
    return <ChartEmptyState height={height} message="No torrent data available" />
  }

  const allMonths = new Set<string>()
  for (const entry of data) {
    for (const { month } of entry.months) allMonths.add(month)
  }
  const sortedMonths = Array.from(allMonths).sort()

  if (sortedMonths.length === 0) {
    return <ChartEmptyState height={height} message="No torrent data available" />
  }

  const colorMap = buildTagColors(data.map((e) => e.category))

  const series: StackedAreaSeries[] = data.map((entry) => ({
    name: entry.category,
    color: colorMap.get(entry.category) ?? CHART_THEME.chartFallback,
    monthMap: new Map(entry.months.map(({ month, count }) => [month, count])),
  }))

  return (
    <ChartECharts
      option={buildStackedAreaOption(sortedMonths, series, "categories")}
      style={{ height, width: "100%" }}
    />
  )
}

export type { FleetCategoryTimelineProps }
export { FleetCategoryTimeline }
