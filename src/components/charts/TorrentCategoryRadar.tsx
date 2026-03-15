// src/components/charts/TorrentCategoryRadar.tsx

"use client"

import type { EChartsOption } from "echarts"
import ReactECharts from "echarts-for-react"
import { CHART_THEME, escHtml } from "@/components/charts/theme"
import { formatBytesNum, formatDuration, generatePalette, hexToRgba } from "@/lib/formatters"
import type { CategoryStats } from "@/lib/torrent-utils"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Normalize a value to 0-100 scale for radar chart */
function normalize(value: number, max: number): number {
  if (max === 0) return 0
  return Math.min((value / max) * 100, 100)
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface TorrentCategoryRadarProps {
  categories: CategoryStats[]
  accentColor: string
}

export function TorrentCategoryRadar({
  categories,
  accentColor,
}: TorrentCategoryRadarProps) {
  if (categories.length < 2) {
    return <p className="text-sm text-muted font-mono py-4">Need 2+ categories for radar</p>
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
    tooltip: {
      trigger: "item",
      backgroundColor: CHART_THEME.tooltipBg,
      borderColor: CHART_THEME.tooltipBorder,
      borderWidth: 1,
      padding: [8, 12],
      textStyle: {
        color: CHART_THEME.textPrimary,
        fontFamily: CHART_THEME.fontMono,
        fontSize: 11,
      },
      formatter: (params: unknown) => {
        const p = params as { name: string; value: number[]; color: string }
        const cat = top.find((c) => c.name === p.name)
        if (!cat) return ""
        return [
          `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.color};margin-right:6px;box-shadow:0 0 6px ${p.color};"></span><span style="color:${p.color};font-weight:600;">${escHtml(p.name)}</span>`,
          `Torrents: ${cat.count}`,
          `Size: ${formatBytesNum(cat.totalSize)}`,
          `Avg Ratio: ${cat.avgRatio.toFixed(2)}`,
          `Avg Seed Time: ${formatDuration(cat.avgSeedTime)}`,
          `Avg Swarm Seeds: ${cat.avgSwarmSeeds.toFixed(0)}`,
        ].join("<br/>")
      },
    },
    legend: {
      bottom: 0,
      textStyle: {
        color: CHART_THEME.textTertiary,
        fontFamily: CHART_THEME.fontMono,
        fontSize: 12,
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
        fontSize: 11,
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

  return (
    <ReactECharts
      option={option}
      style={{ height: 380, width: "100%" }}
      opts={{ renderer: "canvas" }}
      notMerge
      lazyUpdate
    />
  )
}
