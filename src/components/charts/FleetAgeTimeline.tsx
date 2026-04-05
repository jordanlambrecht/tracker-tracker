// src/components/charts/FleetAgeTimeline.tsx
"use client"

import type { AgeTimelineEntry } from "@/lib/fleet-aggregation"
import type { StackedAreaSeries } from "@/types/charts"
import { ChartECharts } from "./lib/ChartECharts"
import { ChartEmptyState } from "./lib/ChartEmptyState"
import { buildStackedAreaOption } from "./lib/chart-helpers"

interface FleetAgeTimelineProps {
  data: AgeTimelineEntry[]
  height?: number
}

function FleetAgeTimeline({ data, height = 320 }: FleetAgeTimelineProps) {
  if (data.length === 0) {
    return <ChartEmptyState height={height} message="No torrent addition data available" />
  }

  const allMonths = new Set<string>()
  for (const entry of data) {
    for (const { month } of entry.months) allMonths.add(month)
  }
  const sortedMonths = Array.from(allMonths).sort()

  if (sortedMonths.length === 0) {
    return <ChartEmptyState height={height} message="No torrent addition data available" />
  }

  const series: StackedAreaSeries[] = data.map((entry) => ({
    name: entry.name,
    color: entry.color,
    monthMap: new Map(entry.months.map(({ month, count }) => [month, count])),
  }))

  return (
    <ChartECharts
      option={buildStackedAreaOption(sortedMonths, series, "age")}
      style={{ height, width: "100%" }}
    />
  )
}

export type { FleetAgeTimelineProps }
export { FleetAgeTimeline }
