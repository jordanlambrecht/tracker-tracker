// src/components/charts/TorrentCategoryAcquisition.tsx

"use client"

import type { EChartsOption } from "echarts"
import ReactECharts from "echarts-for-react"
import { CHART_THEME, chartTooltip } from "@/components/charts/theme"
import { generatePalette } from "@/lib/formatters"
import type { TorrentInfo } from "@/lib/torrent-utils"
import { ChartEmptyState } from "./ChartEmptyState"

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface TorrentCategoryAcquisitionProps {
  torrents: TorrentInfo[]
  accentColor: string
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TorrentCategoryAcquisition({ torrents, accentColor }: TorrentCategoryAcquisitionProps) {
  const withDates = torrents.filter((t) => t.addedOn > 0)
  if (withDates.length < 2) {
    return <ChartEmptyState height={280} message="Need 2+ torrents with dates" />
  }

  // Group by month + category
  const monthCatMap = new Map<string, Map<string, number>>()
  const allCategories = new Set<string>()

  for (const t of withDates) {
    const month = new Date(t.addedOn * 1000).toISOString().slice(0, 7) // YYYY-MM
    const cat = t.category || "Uncategorized"
    allCategories.add(cat)
    if (!monthCatMap.has(month)) monthCatMap.set(month, new Map())
    const catMap = monthCatMap.get(month) ?? new Map<string, number>()
    catMap.set(cat, (catMap.get(cat) ?? 0) + 1)
  }

  const months = [...monthCatMap.keys()].sort()
  const categories = [...allCategories]
  const palette = generatePalette(categories.length, accentColor)

  const series = categories.map((cat, i) => ({
    name: cat,
    type: "bar" as const,
    stack: "total",
    emphasis: { focus: "series" as const },
    barWidth: "60%",
    itemStyle: {
      color: palette[i],
      borderRadius: i === categories.length - 1 ? [2, 2, 0, 0] : undefined,
    },
    data: months.map((m) => monthCatMap.get(m)?.get(cat) ?? 0),
  }))

  const option: EChartsOption = {
    backgroundColor: "transparent",
    tooltip: chartTooltip("axis", { axisPointer: { type: "shadow" } }),
    legend: {
      type: "scroll",
      bottom: 0,
      textStyle: { color: CHART_THEME.textTertiary, fontFamily: CHART_THEME.fontMono, fontSize: 10 },
      pageTextStyle: { color: CHART_THEME.textTertiary },
      pageIconColor: CHART_THEME.textSecondary,
      pageIconInactiveColor: CHART_THEME.textTertiary,
    },
    grid: { left: 48, right: 16, top: 16, bottom: 48 },
    xAxis: {
      type: "category",
      data: months,
      axisLabel: {
        color: CHART_THEME.textTertiary,
        fontFamily: CHART_THEME.fontMono,
        fontSize: 10,
        rotate: months.length > 12 ? 30 : 0,
        interval: "auto",
      },
      axisLine: { lineStyle: { color: CHART_THEME.gridLine } },
      axisTick: { show: false },
    },
    yAxis: {
      type: "value",
      splitLine: { lineStyle: { color: CHART_THEME.gridLine } },
      axisLabel: {
        color: CHART_THEME.textTertiary,
        fontFamily: CHART_THEME.fontMono,
        fontSize: 10,
      },
    },
    series,
  }

  return (
    <ReactECharts
      option={option}
      style={{ height: 280, width: "100%" }}
      opts={{ renderer: "canvas" }}
      notMerge
      lazyUpdate
    />
  )
}
