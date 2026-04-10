// src/components/charts/FleetAgeTimeline.tsx
"use client"

import { useMemo } from "react"
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
  const option = useMemo(() => {
    if (data.length === 0) return null
    const allMonths = new Set<string>()
    for (const entry of data) {
      for (const { month } of entry.months) allMonths.add(month)
    }
    const sortedMonths = Array.from(allMonths).sort()
    if (sortedMonths.length === 0) return null
    const series: StackedAreaSeries[] = data.map((entry) => ({
      name: entry.name,
      color: entry.color,
      monthMap: new Map(entry.months.map(({ month, count }) => [month, count])),
    }))
    return buildStackedAreaOption(sortedMonths, series, "age")
  }, [data])

  if (!option) {
    return <ChartEmptyState height={height} message="No torrent addition data available" />
  }

  return <ChartECharts option={option} style={{ height, width: "100%" }} />
}

export type { FleetAgeTimelineProps }
export { FleetAgeTimeline }
