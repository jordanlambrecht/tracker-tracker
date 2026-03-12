// src/components/charts/TorrentRatioDistribution.tsx

"use client"

import type { EChartsOption } from "echarts"
import ReactECharts from "echarts-for-react"
import { CHART_THEME } from "@/components/charts/theme"
import type { TorrentInfo } from "@/lib/torrent-utils"

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface TorrentRatioDistributionProps {
  torrents: TorrentInfo[]
  accentColor: string
}

export function TorrentRatioDistribution({
  torrents,
  accentColor,
}: TorrentRatioDistributionProps) {
  const buckets = [
    { label: "< 0.5", min: 0, max: 0.5, color: CHART_THEME.scale[0] },
    { label: "0.5-1", min: 0.5, max: 1, color: CHART_THEME.scale[1] },
    { label: "1-2", min: 1, max: 2, color: CHART_THEME.scale[2] },
    { label: "2-5", min: 2, max: 5, color: accentColor },
    { label: "5-10", min: 5, max: 10, color: CHART_THEME.scale[4] },
    { label: "10+", min: 10, max: Infinity, color: CHART_THEME.scale[5] },
  ]

  const counts = buckets.map((b) => ({
    ...b,
    count: torrents.filter((t) => t.ratio >= b.min && t.ratio < b.max).length,
  }))

  const option: EChartsOption = {
    backgroundColor: "transparent",
    tooltip: {
      trigger: "axis",
      backgroundColor: CHART_THEME.tooltipBg,
      borderColor: CHART_THEME.tooltipBorder,
      borderWidth: 1,
      textStyle: {
        color: CHART_THEME.textPrimary,
        fontFamily: CHART_THEME.fontMono,
        fontSize: 11,
      },
    },
    grid: { left: 40, right: 16, top: 8, bottom: 28 },
    xAxis: {
      type: "category",
      data: counts.map((c) => c.label),
      axisLabel: {
        color: CHART_THEME.textTertiary,
        fontFamily: CHART_THEME.fontMono,
        fontSize: 10,
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
    series: [
      {
        type: "bar",
        data: counts.map((c) => ({
          value: c.count,
          itemStyle: { color: c.color, borderRadius: [4, 4, 0, 0] },
          emphasis: { itemStyle: { shadowBlur: 8, shadowColor: c.color } },
        })),
        barWidth: "60%",
      },
    ],
  }

  return (
    <ReactECharts
      option={option}
      style={{ height: 200, width: "100%" }}
      opts={{ renderer: "canvas" }}
      notMerge
      lazyUpdate
    />
  )
}
