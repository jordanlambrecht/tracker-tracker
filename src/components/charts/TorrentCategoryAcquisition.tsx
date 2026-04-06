// src/components/charts/TorrentCategoryAcquisition.tsx
"use client"

import type { EChartsOption } from "echarts"
import { generatePalette } from "@/lib/color-utils"
import type { TorrentRaw } from "@/lib/fleet"
import { localDateStr } from "@/lib/formatters"
import { ChartECharts } from "./lib/ChartECharts"
import { ChartEmptyState } from "./lib/ChartEmptyState"
import { buildTimeXAxis } from "./lib/chart-helpers"
import { CHART_THEME, chartGrid, chartTooltip } from "./lib/theme"

interface TorrentCategoryAcquisitionProps {
  torrents: TorrentRaw[]
  accentColor: string
}

function TorrentCategoryAcquisition({ torrents, accentColor }: TorrentCategoryAcquisitionProps) {
  const withDates = torrents.filter((t) => t.addedAt > 0)
  if (withDates.length < 2) {
    return <ChartEmptyState height={280} message="Need 2+ torrents with dates" />
  }

  // Group by month + category
  const monthCatMap = new Map<string, Map<string, number>>()
  const allCategories = new Set<string>()

  for (const t of withDates) {
    const month = localDateStr(new Date(t.addedAt * 1000)).slice(0, 7) // YYYY-MM
    const cat = t.category || "Uncategorized"
    allCategories.add(cat)
    if (!monthCatMap.has(month)) monthCatMap.set(month, new Map())
    const catMap = monthCatMap.get(month) ?? new Map<string, number>()
    catMap.set(cat, (catMap.get(cat) ?? 0) + 1)
  }

  const months = [...monthCatMap.keys()].sort()
  const categories = [...allCategories]
  const palette = generatePalette(categories.length, accentColor)

  // Convert month keys to timestamps once for reuse across all series
  const monthTimestamps = months.map((m) => new Date(`${m}-15T12:00:00`).getTime())

  const series = categories.map((cat, i) => ({
    name: cat,
    type: "bar" as const,
    stack: "total",
    emphasis: { focus: "series" as const },
    barWidth: 20,
    itemStyle: {
      color: palette[i],
      borderRadius: i === categories.length - 1 ? [2, 2, 0, 0] : undefined,
    },
    data: monthTimestamps.map(
      (ts, idx) => [ts, monthCatMap.get(months[idx])?.get(cat) ?? 0] as [number, number]
    ),
  }))

  const option: EChartsOption = {
    backgroundColor: "transparent",
    tooltip: chartTooltip("axis", { axisPointer: { type: "shadow" } }),
    legend: {
      type: "scroll",
      bottom: 0,
      textStyle: {
        color: CHART_THEME.textTertiary,
        fontFamily: CHART_THEME.fontMono,
        fontSize: CHART_THEME.fontSizeCompact,
      },
      pageTextStyle: { color: CHART_THEME.textTertiary },
      pageIconColor: CHART_THEME.textSecondary,
      pageIconInactiveColor: CHART_THEME.textTertiary,
    },
    grid: chartGrid({ left: 48, right: 16, top: 16, bottom: 48 }),
    xAxis: buildTimeXAxis({ boundaryGap: ["5%", "5%"] }),
    yAxis: {
      type: "value",
      splitLine: { lineStyle: { color: CHART_THEME.gridLine } },
      axisLabel: {
        color: CHART_THEME.textTertiary,
        fontFamily: CHART_THEME.fontMono,
        fontSize: CHART_THEME.fontSizeCompact,
      },
    },
    series,
  }

  return <ChartECharts option={option} style={{ height: 280, width: "100%" }} />
}

export type { TorrentCategoryAcquisitionProps }
export { TorrentCategoryAcquisition }
