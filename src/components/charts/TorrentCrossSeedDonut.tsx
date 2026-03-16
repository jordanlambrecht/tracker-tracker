// src/components/charts/TorrentCrossSeedDonut.tsx

"use client"

import type { EChartsOption } from "echarts"
import ReactECharts from "echarts-for-react"
import { CHART_THEME, chartTooltip, escHtml } from "@/components/charts/theme"
import { getComplementaryColor, hexToRgba } from "@/lib/formatters"

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface TorrentCrossSeedDonutProps {
  crossSeeded: number
  unique: number
  accentColor: string
}

export function TorrentCrossSeedDonut({
  crossSeeded,
  unique,
  accentColor,
}: TorrentCrossSeedDonutProps) {
  const secondaryColor = getComplementaryColor(accentColor)
  const total = crossSeeded + unique

  const option: EChartsOption = {
    backgroundColor: "transparent",
    tooltip: chartTooltip("item"),
    series: [
      {
        type: "pie",
        radius: ["45%", "72%"],
        center: ["50%", "50%"],
        avoidLabelOverlap: true,
        itemStyle: {
          borderRadius: 4,
          borderColor: CHART_THEME.surface,
          borderWidth: 2,
        },
        label: {
          show: true,
          position: "outside",
          color: CHART_THEME.textSecondary,
          fontFamily: CHART_THEME.fontMono,
          fontSize: 12,
          formatter: (params: unknown) => {
            const p = params as { name: string; value: number }
            const pct = total > 0 ? ((p.value / total) * 100).toFixed(1) : "0"
            return `${escHtml(p.name)}: ${p.value} (${pct}%)`
          },
        },
        labelLine: {
          lineStyle: { color: CHART_THEME.borderMid },
          length: 14,
          length2: 10,
        },
        emphasis: {
          label: { show: true, fontWeight: "bold", color: CHART_THEME.textPrimary },
          itemStyle: { shadowBlur: 12, shadowColor: hexToRgba(accentColor, 0.5) },
        },
        data: [
          {
            name: "Cross-seeded",
            value: crossSeeded,
            itemStyle: { color: accentColor },
            emphasis: { itemStyle: { shadowBlur: 12, shadowColor: accentColor } },
          },
          {
            name: "Unique",
            value: unique,
            itemStyle: { color: secondaryColor },
            emphasis: { itemStyle: { shadowBlur: 12, shadowColor: secondaryColor } },
          },
        ],
      },
    ],
  }

  return (
    <ReactECharts
      option={option}
      style={{ height: 300, width: "100%" }}
      opts={{ renderer: "canvas" }}
      notMerge
      lazyUpdate
    />
  )
}
