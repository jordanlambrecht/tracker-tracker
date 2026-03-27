// src/components/charts/FleetCategoryBreakdown.tsx
//
// Functions: buildFleetCategoryBreakdownOption, FleetCategoryBreakdown

"use client"

import type { EChartsOption } from "echarts"
import type { TrackerTag } from "@/lib/fleet"
import { parseTorrentTags } from "@/lib/fleet"
import { ChartECharts } from "./lib/ChartECharts"
import { ChartEmptyState } from "./lib/ChartEmptyState"
import { fmtNum } from "./lib/chart-helpers"
import {
  CHART_THEME,
  chartAxisLabel,
  chartDataZoom,
  chartLegend,
  chartTooltip,
  chartTooltipRow,
  escHtml,
} from "./lib/theme"

interface FleetCategoryBreakdownProps {
  torrents: { addedOn: number; tags: string; category: string }[]
  trackerTags: TrackerTag[]
  height?: number
}

function buildFleetCategoryBreakdownOption(
  sortedMonths: string[],
  categories: string[],
  categoryColors: string[],
  // month key → category → count
  data: Map<string, Map<string, number>>
): EChartsOption {
  const series: NonNullable<EChartsOption["series"]> = categories.map((cat, catIndex) => {
    const seriesData: number[] = sortedMonths.map((month) => {
      const monthCats = data.get(month)
      if (!monthCats) return 0
      const total = Array.from(monthCats.values()).reduce((a, b) => a + b, 0)
      const count = monthCats.get(cat) ?? 0
      return total > 0 ? Number(((count / total) * 100).toFixed(1)) : 0
    })

    return {
      name: cat,
      type: "bar",
      stack: "total",
      barWidth: 20,
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
        fontSize: CHART_THEME.fontSizeMicro,
        color: CHART_THEME.textPrimary,
        formatter: (params: unknown) => {
          const p = params as { value: number }
          return p.value >= 5 ? `${fmtNum(p.value, 1)}%` : ""
        },
      },
      data: seriesData,
    }
  })

  return {
    backgroundColor: "transparent",
    tooltip: chartTooltip("axis", {
      formatter: (params: unknown) => {
        const items = params as Array<{
          seriesName: string
          value: number
          axisValueLabel: string
          color: string
        }>
        if (!items?.length) return ""
        const dateLabel = items[0].axisValueLabel
        const rows = items
          .filter((item) => item.value > 0)
          .sort((a, b) => b.value - a.value)
          .map((item) => chartTooltipRow(item.color, item.seriesName, `${fmtNum(item.value, 1)}%`))
          .join("<br/>")
        return `<span style="color:${CHART_THEME.textPrimary};font-weight:600;">${escHtml(dateLabel)}</span><br/>${rows}`
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
      data: sortedMonths.map((m) => {
        const d = new Date(`${m}-15T12:00:00`)
        return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" })
      }),
      axisLine: { lineStyle: { color: CHART_THEME.gridLine } },
      axisTick: { show: false },
      axisLabel: chartAxisLabel(),
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
      sortedMonths.length > 10
        ? [
            ...chartDataZoom(CHART_THEME.accent).map((z) => ({
              ...z,
              start: 0,
              end: Math.min(100, (10 / sortedMonths.length) * 100),
            })),
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

  const tagSet = new Set(trackerTags.map((tt) => tt.tag.toLowerCase()))

  // Build: month → category → count (fleet-wide, filtered to tagged torrents only)
  const data = new Map<string, Map<string, number>>()
  const allCategories = new Set<string>()
  const allMonths = new Set<string>()

  for (const torrent of torrents) {
    if (!torrent.addedOn || torrent.addedOn <= 0) continue

    const tags = parseTorrentTags(torrent.tags)
    const hasTrackerTag = tags.some((tag) => tagSet.has(tag))
    if (!hasTrackerTag) continue

    const d = new Date(torrent.addedOn * 1000)
    const month = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`
    allMonths.add(month)

    const cat = torrent.category?.trim() || "Uncategorized"
    allCategories.add(cat)

    const monthCats = data.get(month) ?? new Map<string, number>()
    monthCats.set(cat, (monthCats.get(cat) ?? 0) + 1)
    data.set(month, monthCats)
  }

  if (data.size === 0) {
    return <ChartEmptyState height={height} message="No tagged torrents found" />
  }

  const sortedMonths = Array.from(allMonths).sort()
  const categories = Array.from(allCategories).sort()
  const categoryColors = categories.map((_, i) => CATEGORY_PALETTE[i % CATEGORY_PALETTE.length])

  return (
    <ChartECharts
      option={buildFleetCategoryBreakdownOption(sortedMonths, categories, categoryColors, data)}
      style={{ height, width: "100%" }}
    />
  )
}

export type { FleetCategoryBreakdownProps }
export { FleetCategoryBreakdown }
