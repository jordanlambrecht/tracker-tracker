// src/components/charts/FleetCategoryBreakdown.tsx
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
  trackerNames: string[],
  categories: string[],
  categoryColors: string[],
  // tracker name → category → count
  data: Map<string, Map<string, number>>
): EChartsOption {
  const series: NonNullable<EChartsOption["series"]> = categories.map((cat, catIndex) => {
    const seriesData: number[] = trackerNames.map((tracker) => {
      const trackerCats = data.get(tracker)
      if (!trackerCats) return 0
      const total = Array.from(trackerCats.values()).reduce((a, b) => a + b, 0)
      const count = trackerCats.get(cat) ?? 0
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
      label: { show: false },
      emphasis: {
        itemStyle: {
          shadowBlur: 8,
          shadowColor: "rgba(0,0,0,0.3)",
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
        const trackerLabel = items[0].axisValueLabel
        const rows = items
          .filter((item) => item.value > 0)
          .sort((a, b) => b.value - a.value)
          .map((item) => chartTooltipRow(item.color, item.seriesName, `${fmtNum(item.value, 1)}%`))
          .join("<br/>")
        return `<span style="color:${CHART_THEME.textPrimary};font-weight:600;">${escHtml(trackerLabel)}</span><br/>${rows}`
      },
    }),
    legend: chartLegend({ data: categories }),
    grid: {
      left: 48,
      right: 16,
      top: 48,
      bottom: 16,
      containLabel: true,
    },
    xAxis: {
      type: "category",
      data: trackerNames,
      axisLine: { lineStyle: { color: CHART_THEME.gridLine } },
      axisTick: { show: false },
      axisLabel: chartAxisLabel({ rotate: trackerNames.length > 8 ? 30 : 0 }),
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
    series,
  }
}

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

  const tagSetLower = trackerTags.map((tt) => ({
    tagLower: tt.tag.toLowerCase(),
    name: tt.name,
  }))

  const data = new Map<string, Map<string, number>>()
  const allCategories = new Set<string>()

  for (const torrent of torrents) {
    const torrentTagList = parseTorrentTags(torrent.tags)
    const matched = tagSetLower.find((e) => torrentTagList.includes(e.tagLower))
    if (!matched) continue

    const cat = torrent.category?.trim() || "Uncategorized"
    allCategories.add(cat)

    const trackerCats = data.get(matched.name) ?? new Map<string, number>()
    trackerCats.set(cat, (trackerCats.get(cat) ?? 0) + 1)
    data.set(matched.name, trackerCats)
  }

  if (data.size === 0) {
    return <ChartEmptyState height={height} message="No tagged torrents found" />
  }

  const trackerNames = trackerTags.map((t) => t.name).filter((name) => data.has(name))
  const categories = Array.from(allCategories).sort()
  const categoryColors = categories.map((_, i) => CATEGORY_PALETTE[i % CATEGORY_PALETTE.length])

  return (
    <ChartECharts
      option={buildFleetCategoryBreakdownOption(trackerNames, categories, categoryColors, data)}
      style={{ height, width: "100%" }}
    />
  )
}

export type { FleetCategoryBreakdownProps }
export { FleetCategoryBreakdown }
