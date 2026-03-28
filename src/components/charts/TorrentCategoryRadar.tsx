// src/components/charts/TorrentCategoryRadar.tsx
"use client"

import type { EChartsOption } from "echarts"
import {
  formatBytesNum,
  formatCount,
  formatDuration,
  formatRatio,
  generatePalette,
  hexToRgba,
} from "@/lib/formatters"
import type { CategoryStats } from "@/lib/torrent-utils"
import { ChartECharts } from "./lib/ChartECharts"
import { ChartEmptyState } from "./lib/ChartEmptyState"
import { CHART_THEME, chartTooltip, chartTooltipRow, escHtml } from "./lib/theme"

/** Normalize a value to 0-100 scale for radar chart */
function normalize(value: number, max: number): number {
  if (max === 0) return 0
  return Math.min((value / max) * 100, 100)
}

interface TorrentCategoryRadarProps {
  categories: CategoryStats[]
  accentColor: string
}

function TorrentCategoryRadar({ categories, accentColor }: TorrentCategoryRadarProps) {
  if (categories.length < 2) {
    return <ChartEmptyState height={380} message="Need 2+ categories for radar" />
  }

  const top = categories.slice(0, 6)
  const maxCount = Math.max(...top.map((c) => c.count))
  const maxSize = Math.max(...top.map((c) => c.totalSize))
  const maxRatio = Math.max(...top.map((c) => c.avgRatio))
  const maxSeedTime = Math.max(...top.map((c) => c.avgSeedTime))
  const maxSwarm = Math.max(...top.map((c) => c.avgSwarmSeeds))

  const indicators = [
    { name: "Count", max: 100 },
    { name: "Size", max: 100 },
    { name: "Avg Ratio", max: 100 },
    { name: "Seed Time", max: 100 },
    { name: "Swarm", max: 100 },
  ]

  const palette = generatePalette(top.length, accentColor)

  const series = top.map((cat, i) => ({
    name: cat.name,
    value: [
      normalize(cat.count, maxCount),
      normalize(cat.totalSize, maxSize),
      normalize(cat.avgRatio, maxRatio),
      normalize(cat.avgSeedTime, maxSeedTime),
      normalize(cat.avgSwarmSeeds, maxSwarm),
    ],
    itemStyle: { color: palette[i % palette.length] },
    areaStyle: { color: hexToRgba(palette[i % palette.length], 0.15) },
    lineStyle: {
      width: 2,
      shadowColor: palette[i % palette.length],
      shadowBlur: 6,
    },
  }))

  const option: EChartsOption = {
    backgroundColor: "transparent",
    tooltip: chartTooltip("item", {
      borderColor: accentColor,
      formatter: (params: unknown) => {
        const p = params as { name: string; value: number[]; color: string }
        const cat = top.find((c) => c.name === p.name)
        if (!cat) return ""
        return [
          `<span style="color:${p.color};font-weight:600;">${escHtml(p.name)}</span>`,
          chartTooltipRow(p.color, "Torrents", formatCount(cat.count)),
          chartTooltipRow(CHART_THEME.neutral, "Size", formatBytesNum(cat.totalSize)),
          chartTooltipRow(CHART_THEME.neutral, "Avg Ratio", formatRatio(cat.avgRatio)),
          chartTooltipRow(CHART_THEME.neutral, "Avg Seed Time", formatDuration(cat.avgSeedTime)),
          chartTooltipRow(CHART_THEME.neutral, "Avg Swarm Seeds", cat.avgSwarmSeeds.toFixed(0)),
        ].join("<br/>")
      },
    }),
    legend: {
      bottom: 0,
      textStyle: {
        color: CHART_THEME.textTertiary,
        fontFamily: CHART_THEME.fontMono,
        fontSize: CHART_THEME.fontSizeSmall,
      },
      itemWidth: 14,
      itemHeight: 10,
      itemGap: 16,
    },
    radar: {
      indicator: indicators,
      shape: "polygon",
      center: ["50%", "48%"],
      radius: "70%",
      splitNumber: 4,
      axisName: {
        color: CHART_THEME.textTertiary,
        fontFamily: CHART_THEME.fontMono,
        fontSize: CHART_THEME.fontSizeDense,
      },
      splitLine: { lineStyle: { color: CHART_THEME.gridLine } },
      splitArea: { show: false },
      axisLine: { lineStyle: { color: CHART_THEME.gridLine } },
    },
    series: [
      {
        type: "radar",
        symbol: "circle",
        symbolSize: 5,
        data: series,
      },
    ],
  }

  return <ChartECharts option={option} style={{ height: 380, width: "100%" }} />
}

export type { TorrentCategoryRadarProps }
export { TorrentCategoryRadar }
