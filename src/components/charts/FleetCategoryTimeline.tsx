// src/components/charts/FleetCategoryTimeline.tsx
//
// Functions: groupByCategory, FleetCategoryTimeline

"use client"

import { ChartECharts } from "./lib/ChartECharts"
import { ChartEmptyState } from "./lib/ChartEmptyState"
import { buildStackedAreaOption } from "./lib/chart-helpers"
import { buildTagColors, CHART_THEME } from "./lib/theme"

interface FleetCategoryTimelineProps {
  torrents: { addedOn: number; category: string }[]
  height?: number
}

interface CategorySeries {
  name: string
  color: string
  monthMap: Map<string, number>
}

function groupByCategory(torrents: { addedOn: number; category: string }[]): {
  sortedMonths: string[]
  series: CategorySeries[]
} {
  const categoryMaps = new Map<string, Map<string, number>>()
  const allMonths = new Set<string>()

  for (const torrent of torrents) {
    if (!torrent.addedOn || torrent.addedOn <= 0) continue
    const d = new Date(torrent.addedOn * 1000)
    const month = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`
    allMonths.add(month)

    const cat = torrent.category?.trim() || "Uncategorized"
    let monthMap = categoryMaps.get(cat)
    if (!monthMap) {
      monthMap = new Map<string, number>()
      categoryMaps.set(cat, monthMap)
    }
    monthMap.set(month, (monthMap.get(month) ?? 0) + 1)
  }

  const sortedMonths = Array.from(allMonths).sort()

  // Sort categories by total torrent count descending
  const entries = Array.from(categoryMaps.entries())
    .map(([name, monthMap]) => {
      let total = 0
      for (const count of monthMap.values()) total += count
      return { name, monthMap, total }
    })
    .sort((a, b) => b.total - a.total)

  const colorMap = buildTagColors(entries.map((e) => e.name))

  const series: CategorySeries[] = entries.map((e) => ({
    name: e.name,
    color: colorMap.get(e.name) ?? CHART_THEME.chartFallback,
    monthMap: e.monthMap,
  }))

  return { sortedMonths, series }
}

function FleetCategoryTimeline({ torrents, height = 320 }: FleetCategoryTimelineProps) {
  const validTorrents = torrents.filter((t) => t.addedOn && t.addedOn > 0)

  if (validTorrents.length === 0) {
    return <ChartEmptyState height={height} message="No torrent data available" />
  }

  const { sortedMonths, series } = groupByCategory(validTorrents)

  if (sortedMonths.length === 0 || series.length === 0) {
    return <ChartEmptyState height={height} message="No torrent data available" />
  }

  return (
    <ChartECharts
      option={buildStackedAreaOption(sortedMonths, series, "categories")}
      style={{ height, width: "100%" }}
    />
  )
}

export type { FleetCategoryTimelineProps }
export { FleetCategoryTimeline }
