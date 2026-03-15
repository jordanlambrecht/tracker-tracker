// src/components/charts/FleetCategoryTimeline.tsx
//
// Functions: groupByCategory, buildCategoryTimelineOption, FleetCategoryTimeline

"use client"

import type { EChartsOption } from "echarts"
import { ChartECharts } from "./ChartECharts"
import { ChartEmptyState } from "./ChartEmptyState"
import { formatDateLabel } from "./chart-helpers"
import { buildTagColors, CHART_THEME, chartAxisLabel, chartDot, chartGrid, chartLegend, chartTooltip, chartTooltipHeader, escHtml } from "./theme"

interface FleetCategoryTimelineProps {
  torrents: { added_on: number; category: string }[]
  height?: number
}

interface CategorySeries {
  name: string
  color: string
  dateMap: Map<string, number>
}

function groupByCategory(
  torrents: { added_on: number; category: string }[]
): { sortedDates: string[]; series: CategorySeries[] } {
  const categoryMaps = new Map<string, Map<string, number>>()
  const allDates = new Set<string>()

  for (const torrent of torrents) {
    if (!torrent.added_on || torrent.added_on <= 0) continue
    const date = new Date(torrent.added_on * 1000).toISOString().slice(0, 10)
    allDates.add(date)

    const cat = torrent.category?.trim() || "Uncategorized"
    if (!categoryMaps.has(cat)) categoryMaps.set(cat, new Map())
    const dateMap = categoryMaps.get(cat) ?? new Map<string, number>()
    dateMap.set(date, (dateMap.get(date) ?? 0) + 1)
  }

  const sortedDates = Array.from(allDates).sort()

  // Sort categories by total torrent count descending
  const entries = Array.from(categoryMaps.entries())
    .map(([name, dateMap]) => {
      let total = 0
      for (const count of dateMap.values()) total += count
      return { name, dateMap, total }
    })
    .sort((a, b) => b.total - a.total)

  const colorMap = buildTagColors(entries.map((e) => e.name))

  const series: CategorySeries[] = entries.map((e) => ({
    name: e.name,
    color: colorMap.get(e.name) ?? CHART_THEME.chartFallback,
    dateMap: e.dateMap,
  }))

  return { sortedDates, series }
}

function buildCategoryTimelineOption(
  sortedDates: string[],
  series: CategorySeries[]
): EChartsOption {
  const labels = sortedDates.map(formatDateLabel)

  const eChartsSeries: NonNullable<EChartsOption["series"]> = series.map((s) => {
    let running = 0
    const data = sortedDates.map((date) => {
      running += s.dateMap.get(date) ?? 0
      return running
    })

    return {
      name: s.name,
      type: "line",
      stack: "categories",
      smooth: true,
      symbol: "none",
      data,
      itemStyle: { color: s.color },
      lineStyle: { color: s.color, width: 1.5 },
      areaStyle: { color: s.color, opacity: 0.3 },
    }
  })

  return {
    backgroundColor: "transparent",
    grid: chartGrid({ right: 16, bottom: 48, left: 56 }),
    tooltip: chartTooltip("axis", {
      axisPointer: {
        type: "line",
        lineStyle: { color: CHART_THEME.borderMid, type: "dashed" },
      },
      formatter: (params: unknown) => {
        const items = params as Array<{
          seriesName: string
          value: number
          color: string
          axisValueLabel: string
        }>
        if (!items?.length) return ""
        const dateLabel = items[0].axisValueLabel
        const rows = items
          .filter((item) => item.value > 0)
          .sort((a, b) => b.value - a.value)
          .map((item) => {
            const dot = chartDot(item.color)
            return `${dot}<span style="color:${CHART_THEME.textSecondary};">${escHtml(item.seriesName)}:</span> <span style="color:${CHART_THEME.textPrimary};font-weight:600;">${item.value.toLocaleString()}</span>`
          })
          .join("<br/>")
        return `${chartTooltipHeader(dateLabel)}${rows}`
      },
    }),
    legend: chartLegend(),
    xAxis: {
      type: "category",
      data: labels,
      boundaryGap: false,
      axisLine: { lineStyle: { color: CHART_THEME.gridLine } },
      axisTick: { show: false },
      axisLabel: chartAxisLabel({ rotate: sortedDates.length > 14 ? 30 : 0, interval: "auto" }),
    },
    yAxis: {
      type: "value",
      name: "Torrents",
      nameTextStyle: {
        color: CHART_THEME.textTertiary,
        fontFamily: CHART_THEME.fontMono,
        fontSize: 10,
      },
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: chartAxisLabel(),
      splitLine: { lineStyle: { color: CHART_THEME.gridLine } },
    },
    dataZoom: [
      { type: "inside", zoomOnMouseWheel: true, moveOnMouseMove: true },
    ],
    series: eChartsSeries,
  }
}

function FleetCategoryTimeline({
  torrents,
  height = 320,
}: FleetCategoryTimelineProps) {
  const validTorrents = torrents.filter((t) => t.added_on && t.added_on > 0)

  if (validTorrents.length === 0) {
    return <ChartEmptyState height={height} message="No torrent data available" />
  }

  const { sortedDates, series } = groupByCategory(validTorrents)

  if (sortedDates.length === 0 || series.length === 0) {
    return <ChartEmptyState height={height} message="No torrent data available" />
  }

  return (
    <ChartECharts
      option={buildCategoryTimelineOption(sortedDates, series)}
      style={{ height, width: "100%" }}
      opts={{ renderer: "canvas" }}
      notMerge
      lazyUpdate
    />
  )
}

export type { FleetCategoryTimelineProps }
export { FleetCategoryTimeline }
