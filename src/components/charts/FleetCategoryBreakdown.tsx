// src/components/charts/FleetCategoryBreakdown.tsx
//
// Functions: buildFleetCategoryBreakdownOption, FleetCategoryBreakdown

"use client"

import type { EChartsOption } from "echarts"
import ReactECharts from "echarts-for-react"
import type { TorrentRaw, TrackerTag } from "@/lib/fleet"
import { parseTorrentTags } from "@/lib/fleet"
import { ChartEmptyState } from "./ChartEmptyState"
import { fmtNum } from "./chart-helpers"
import {
  CHART_THEME,
  chartAxisLabel,
  chartDataZoom,
  chartDot,
  chartLegend,
  chartTooltip,
  escHtml,
} from "./theme"

interface FleetCategoryBreakdownProps {
  torrents: TorrentRaw[]
  trackerTags: TrackerTag[]
  height?: number
}

function buildFleetCategoryBreakdownOption(
  trackerNames: string[],
  categories: string[],
  categoryColors: string[],
  data: Map<string, Map<string, number>>
): EChartsOption {
  // For each category, build a bar series with normalized values (percentage)
  const series: NonNullable<EChartsOption["series"]> = categories.map((cat, catIndex) => ({
    name: cat,
    type: "bar",
    stack: "total",
    barMaxWidth: 40,
    itemStyle: {
      color: categoryColors[catIndex],
      borderRadius: catIndex === categories.length - 1 ? [2, 2, 0, 0] : 0,
    },
    emphasis: {
      itemStyle: {
        shadowBlur: 8,
        shadowColor: "rgba(0,0,0,0.3)",
      },
    },
    label: {
      show: true,
      position: "inside",
      fontFamily: CHART_THEME.fontMono,
      fontSize: 9,
      color: CHART_THEME.textPrimary,
      formatter: (params: unknown) => {
        const p = params as { value: number }
        return p.value >= 5 ? `${fmtNum(p.value, 1)}%` : ""
      },
    },
    data: trackerNames.map((tracker) => {
      const trackerCats = data.get(tracker)
      if (!trackerCats) return 0
      const total = Array.from(trackerCats.values()).reduce((a, b) => a + b, 0)
      const count = trackerCats.get(cat) ?? 0
      return total > 0 ? Number(((count / total) * 100).toFixed(1)) : 0
    }),
  }))

  return {
    backgroundColor: "transparent",
    tooltip: chartTooltip("axis", {
      formatter: (params: unknown) => {
        const items = params as Array<{
          seriesName: string
          value: number
          color: string
          axisValueLabel: string
        }>
        if (!items?.length) return ""
        const tracker = items[0].axisValueLabel
        const rows = items
          .filter((item) => item.value > 0)
          .sort((a, b) => b.value - a.value)
          .map(
            (item) =>
              `${chartDot(item.color)}<span style="color:${CHART_THEME.textSecondary};">${escHtml(item.seriesName)}:</span> <span style="color:${CHART_THEME.textPrimary};font-weight:600;">${fmtNum(item.value, 1)}%</span>`
          )
          .join("<br/>")
        return `<span style="color:${CHART_THEME.textPrimary};font-weight:600;">${escHtml(tracker)}</span><br/>${rows}`
      },
    }),
    legend: chartLegend({ data: categories }),
    grid: {
      left: 48,
      right: 16,
      top: 48,
      bottom: 48,
    },
    xAxis: {
      type: "category",
      data: trackerNames,
      axisLine: { lineStyle: { color: CHART_THEME.gridLine } },
      axisTick: { show: false },
      axisLabel: chartAxisLabel({
        rotate: trackerNames.length > 8 ? 30 : 0,
        interval: 0,
      }),
    },
    yAxis: {
      type: "value",
      max: 100,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: chartAxisLabel({
        formatter: (val: number) => `${val}%`,
      }),
      splitLine: {
        lineStyle: { color: CHART_THEME.gridLine, width: 1 },
      },
    },
    dataZoom:
      trackerNames.length > 10
        ? [
            ...chartDataZoom(CHART_THEME.accent).map((z) => ({ ...z, startValue: 0, endValue: 9 })),
            { type: "inside", xAxisIndex: 0 },
          ]
        : undefined,
    series,
  }
}

// Deterministic palette for categories — uses CHART_THEME scale colors + extras
const CATEGORY_PALETTE = [
  CHART_THEME.accent,
  CHART_THEME.warn,
  CHART_THEME.danger,
  CHART_THEME.success,
  ...CHART_THEME.scale,
]

function FleetCategoryBreakdown({
  torrents,
  trackerTags,
  height = 360,
}: FleetCategoryBreakdownProps) {
  if (torrents.length === 0 || trackerTags.length === 0) {
    return <ChartEmptyState height={height} message="No torrent data available" />
  }

  const tagMap = new Map<string, string>()
  for (const tt of trackerTags) tagMap.set(tt.tag.toLowerCase(), tt.name)

  // Build: tracker name → category → count
  const data = new Map<string, Map<string, number>>()
  const allCategories = new Set<string>()

  for (const torrent of torrents) {
    const tags = parseTorrentTags(torrent.tags)
    const cat = torrent.category?.trim() || "Uncategorized"
    allCategories.add(cat)

    for (const tag of tags) {
      const trackerName = tagMap.get(tag)
      if (!trackerName) continue

      const trackerCats = data.get(trackerName) ?? new Map<string, number>()
      trackerCats.set(cat, (trackerCats.get(cat) ?? 0) + 1)
      data.set(trackerName, trackerCats)
    }
  }

  if (data.size === 0) {
    return <ChartEmptyState height={height} message="No tagged torrents found" />
  }

  const trackerNames = trackerTags.map((t) => t.name).filter((name) => data.has(name))

  const categories = Array.from(allCategories).sort()
  const categoryColors = categories.map((_, i) => CATEGORY_PALETTE[i % CATEGORY_PALETTE.length])

  return (
    <ReactECharts
      option={buildFleetCategoryBreakdownOption(trackerNames, categories, categoryColors, data)}
      style={{ height, width: "100%" }}
      opts={{ renderer: "canvas" }}
      notMerge
      lazyUpdate
    />
  )
}

export type { FleetCategoryBreakdownProps }
export { FleetCategoryBreakdown }
